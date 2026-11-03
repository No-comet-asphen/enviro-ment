// backend/src/services/monitoring.service.ts
import { db } from "../store.ts";
import { searchAndIngestEvidence } from "./evidence.service.ts";
import crypto from "node:crypto";

export async function runMonitoringJob(incidentIds?: string[], mode: "active" | "all" = "active") {
  let targets: string[] = [];

  if (incidentIds && incidentIds.length > 0) {
    targets = incidentIds;
  } else {
    for (const incident of db.incidents.values()) {
      if (mode === "active" && (incident.status === "investigating" || incident.status === "monitoring" || incident.status === "verified")) {
        targets.push(incident.id);
      } else if (mode === "all") {
        targets.push(incident.id);
      }
    }
  }

  let checked = 0;
  let updated = 0;
  let totalNewEvidence = 0;

  for (const id of targets) {
    const incident = db.incidents.get(id);
    if (!incident) continue;
    checked++;

    const newEvidence = await searchAndIngestEvidence(
      id,
      {
        query: `${incident.title} ${incident.category} status update`,
        category: incident.category,
        locationName: incident.location_name,
        latitude: incident.latitude,
        longitude: incident.longitude
      }
    );

    if (newEvidence.length > 0) {
      totalNewEvidence += newEvidence.length;
      updated++;
      incident.last_updated_at = new Date().toISOString();

      const timelineId = crypto.randomUUID();
      db.timeline.set(timelineId, {
        id: timelineId,
        incident_id: id,
        event_type: "evidence_added",
        message: `Scheduled monitoring detected ${newEvidence.length} new evidence update(s).`,
        metadata: { new_evidence_count: newEvidence.length },
        created_at: new Date().toISOString()
      });
    }
  }

  return {
    checked,
    updated,
    new_evidence: totalNewEvidence
  };
}
