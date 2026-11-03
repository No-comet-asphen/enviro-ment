// backend/src/services/grok.service.ts
import { db } from "../store.ts";
import { GrokAnalysisOutputSchema } from "../../../supabase/functions/_shared/schemas.ts";
import type { GrokAnalysisOutput } from "../../../supabase/functions/_shared/schemas.ts";
import { askGrok, synthesizeFallbackAnalysis, SYSTEM_PROMPT } from "../../../supabase/functions/_shared/xai.ts";
import { searchAndIngestEvidence } from "./evidence.service.ts";
import crypto from "node:crypto";

export async function runIncidentAnalysis(incidentId: string, reportId?: string, refresh: boolean = false) {
  const incident = db.incidents.get(incidentId);
  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // 1. Gather or refresh evidence
  let existingEvidence: any[] = [];
  for (const ev of db.evidence.values()) {
    if (ev.incident_id === incidentId) existingEvidence.push(ev);
  }

  if (existingEvidence.length === 0 || refresh) {
    const newEvidence = await searchAndIngestEvidence(
      incidentId,
      {
        query: `${incident.title} ${incident.category}`,
        category: incident.category,
        locationName: incident.location_name,
        latitude: incident.latitude,
        longitude: incident.longitude
      },
      reportId
    );
    existingEvidence = existingEvidence.concat(newEvidence);
  }

  // 2. Gather measurements within 15km
  const nearbyMeasurements = db.findMeasurements(
    incident.latitude,
    incident.longitude,
    15.0
  );

  // 3. Prepare Bounded Evidence Bundle
  const evidenceBundle = {
    incident: {
      id: incident.id,
      title: incident.title,
      category: incident.category,
      location_name: incident.location_name,
      first_reported_at: incident.first_reported_at
    },
    retrieved_evidence: existingEvidence.map(e => ({
      id: e.id,
      title: e.title,
      source_name: e.source_name,
      source_type: e.source_type,
      url: e.url,
      excerpt: e.excerpt,
      published_at: e.published_at,
      stance: e.stance,
      reliability: e.reliability
    })),
    sensor_measurements: nearbyMeasurements.slice(0, 5).map(m => ({
      parameter: m.parameter,
      value: m.value,
      unit: m.unit,
      station_name: m.station_name,
      measured_at: m.measured_at
    }))
  };

  const userPrompt = `Analyze the following incident and evidence bundle:\n\n${JSON.stringify(evidenceBundle, null, 2)}`;

  let analysis: GrokAnalysisOutput;

  try {
    const rawGrok = await askGrok(userPrompt, SYSTEM_PROMPT);
    const cleaned = rawGrok.replace(/```json/g, "").replace(/```/g, "").trim();
    analysis = GrokAnalysisOutputSchema.parse(JSON.parse(cleaned));
  } catch (_e) {
    // Graceful fallback to deterministic analysis engine
    analysis = synthesizeFallbackAnalysis(
      {
        category: incident.category,
        description: incident.summary || incident.title,
        location_name: incident.location_name
      },
      existingEvidence,
      nearbyMeasurements
    );
  }

  // 4. Update incident state
  incident.evidence_confidence = analysis.scores.evidence_confidence;
  incident.severity = analysis.scores.environmental_severity;
  incident.escalation = analysis.scores.incident_escalation;
  incident.summary = analysis.user_facing_summary;
  incident.last_updated_at = new Date().toISOString();

  // If high confidence and verified, update status
  if (analysis.verification.outcome === "verified") {
    incident.status = "verified";
  }

  // 5. Add timeline event
  const timelineId = crypto.randomUUID();
  db.timeline.set(timelineId, {
    id: timelineId,
    incident_id: incidentId,
    event_type: "evidence_added",
    message: `Verification complete: ${analysis.verification.outcome.replace('_', ' ')}. Confidence: ${analysis.scores.evidence_confidence}. Severity: ${analysis.scores.environmental_severity}.`,
    metadata: {
      outcome: analysis.verification.outcome,
      confidence: analysis.scores.evidence_confidence,
      severity: analysis.scores.environmental_severity
    },
    created_at: new Date().toISOString()
  });

  return {
    analysis_id: crypto.randomUUID(),
    status: "completed",
    analysis
  };
}
