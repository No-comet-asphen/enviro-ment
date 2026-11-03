// backend/src/services/incident.service.ts
import { db } from "../store.ts";
import type { Incident, Report, TimelineEvent } from "../types.ts";
import crypto from "node:crypto";

export interface CreateReportInput {
  description: string;
  category?: string;
  title?: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  observed_at?: string;
  attachment_ids?: string[];
  user_id?: string | null;
}

export function handleCreateReport(input: CreateReportInput) {
  const reportId = crypto.randomUUID();
  const category = input.category || detectCategory(input.description);
  const title = input.title || generateTitle(input.description, category);
  const now = new Date().toISOString();

  // Step 1: Find matching open incident within 5km radius and matching category
  const nearby = db.findNearbyIncidents(input.location.latitude, input.location.longitude, 5.0, category);
  let linkedIncident: Incident;
  let isNewIncident = false;

  if (nearby.length > 0) {
    linkedIncident = nearby[0];
    linkedIncident.last_updated_at = now;
  } else {
    // Create new incident
    isNewIncident = true;
    linkedIncident = {
      id: crypto.randomUUID(),
      title,
      summary: `Initial report: ${input.description.slice(0, 150)}`,
      category,
      status: "investigating",
      severity: "unknown",
      evidence_confidence: "low",
      escalation: "unknown",
      latitude: input.location.latitude,
      longitude: input.location.longitude,
      location_name: input.location.name,
      first_reported_at: input.observed_at || now,
      last_updated_at: now,
      created_at: now
    };
    db.incidents.set(linkedIncident.id, linkedIncident);
  }

  // Step 2: Store citizen report
  const report: Report = {
    id: reportId,
    user_id: input.user_id || null,
    title,
    description: input.description,
    category,
    location_name: input.location.name,
    latitude: input.location.latitude,
    longitude: input.location.longitude,
    observed_at: input.observed_at || now,
    status: "submitted",
    incident_id: linkedIncident.id,
    created_at: now
  };
  db.reports.set(reportId, report);

  // Step 3: Record timeline event
  const timelineEvent: TimelineEvent = {
    id: crypto.randomUUID(),
    incident_id: linkedIncident.id,
    event_type: "report_received",
    message: isNewIncident
      ? `Citizen report received at ${input.location.name}. New incident created.`
      : `Additional citizen observation linked to ongoing incident from ${input.location.name}.`,
    metadata: { report_id: reportId, category },
    created_at: now
  };
  db.timeline.set(timelineEvent.id, timelineEvent);

  return {
    report_id: reportId,
    incident_id: linkedIncident.id,
    report_status: report.status,
    incident_status: linkedIncident.status,
    analysis_status: "queued"
  };
}

function detectCategory(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("water") || d.includes("tap") || d.includes("supply") || d.includes("pressure") || d.includes("pipeline")) {
    return "water_supply";
  }
  if (d.includes("dirty") || d.includes("smell") || d.includes("turbid") || d.includes("drinking") || d.includes("contamination")) {
    return "water_quality";
  }
  if (d.includes("air") || d.includes("aqi") || d.includes("smog") || d.includes("smoke") || d.includes("breath") || d.includes("pm2.5")) {
    return "air_pollution";
  }
  if (d.includes("garbage") || d.includes("waste") || d.includes("dump") || d.includes("trash")) {
    return "waste_accumulation";
  }
  if (d.includes("noise") || d.includes("loud") || d.includes("decibel") || d.includes("speaker") || d.includes("generator")) {
    return "noise_pollution";
  }
  if (d.includes("flood") || d.includes("waterlogging") || d.includes("drain")) {
    return "flooding";
  }
  return "environmental_concern";
}

function generateTitle(description: string, category: string): string {
  const words = description.split(" ").slice(0, 8).join(" ");
  if (words.length > 5) return words.charAt(0).toUpperCase() + words.slice(1);
  return `${category.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} report`;
}
