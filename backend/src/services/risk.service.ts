// backend/src/services/risk.service.ts
import { db } from "../store.ts";
import { evaluateRisk } from "../../../supabase/functions/_shared/risk.ts";
import type { RiskAssessmentResult } from "../../../supabase/functions/_shared/risk.ts";

export function handleAssessRisk(measurementId: string, standardId: string): RiskAssessmentResult {
  const measurement = db.measurements.get(measurementId);
  if (!measurement) {
    throw new Error(`Measurement ${measurementId} not found`);
  }

  const standard = db.standards.get(standardId);
  if (!standard) {
    throw new Error(`Standard ${standardId} not found`);
  }

  const result = evaluateRisk(measurement, standard);

  // If tied to an incident, add a risk timeline event
  if (measurement.incident_id) {
    const timelineId = crypto.randomUUID();
    db.timeline.set(timelineId, {
      id: timelineId,
      incident_id: measurement.incident_id,
      event_type: "risk_changed",
      message: `Risk evaluated for ${measurement.parameter}: ${result.comparison_status} against ${standard.standard_name}. Severity: ${result.severity}.`,
      metadata: {
        assessment_id: result.assessment_id,
        severity: result.severity,
        comparison_status: result.comparison_status
      },
      created_at: new Date().toISOString()
    });
  }

  return result;
}
