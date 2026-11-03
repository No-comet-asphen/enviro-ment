// supabase/functions/_shared/risk.ts

export interface StandardRecord {
  id: string;
  authority: string;
  standard_name: string;
  parameter: string;
  medium: string;
  unit: string;
  limit_value: number | null;
  comparator: "gt" | "gte" | "lt" | "lte" | "range" | "categorical";
  averaging_period: string;
  applicable_context: string;
  source_url: string;
}

export interface MeasurementRecord {
  id: string;
  incident_id?: string;
  station_name: string;
  parameter: string;
  value: number;
  unit: string;
  measured_at: string;
  latitude: number;
  longitude: number;
  source_name: string;
  source_url: string;
  quality_flag: string;
}

export interface RiskAssessmentResult {
  assessment_id: string;
  parameter: string;
  measured_value: number;
  unit: string;
  standard_name: string;
  limit_value: number | null;
  averaging_period: string;
  comparison_status: "within_limits" | "potential_exceedance" | "exceedance" | "incomparable";
  severity: "low" | "moderate" | "high" | "critical";
  explanation: string;
  source_url: string;
}

export function evaluateRisk(
  measurement: MeasurementRecord,
  standard: StandardRecord
): RiskAssessmentResult {
  const assessment_id = crypto.randomUUID();

  // Unit and parameter sanity check
  const paramMatch =
    measurement.parameter.toLowerCase().trim() === standard.parameter.toLowerCase().trim();

  if (!paramMatch) {
    return {
      assessment_id,
      parameter: measurement.parameter,
      measured_value: measurement.value,
      unit: measurement.unit,
      standard_name: standard.standard_name,
      limit_value: standard.limit_value,
      averaging_period: standard.averaging_period,
      comparison_status: "incomparable",
      severity: "low",
      explanation: `Cannot compare unlike parameters: measured '${measurement.parameter}' vs standard '${standard.parameter}'.`,
      source_url: standard.source_url
    };
  }

  // Averaging period warning: check if instantaneous vs 24-hour/annual
  const isInstantaneousReading = true; // Sensor readings are usually instantaneous unless aggregated
  const standardRequiresAverage =
    standard.averaging_period.toLowerCase().includes("24-hour") ||
    standard.averaging_period.toLowerCase().includes("annual") ||
    standard.averaging_period.toLowerCase().includes("8-hour");

  let isExceeded = false;
  let ratio = 1.0;

  if (standard.limit_value !== null) {
    ratio = measurement.value / standard.limit_value;

    switch (standard.comparator) {
      case "lte":
      case "lt":
        isExceeded = measurement.value > standard.limit_value;
        break;
      case "gte":
      case "gt":
        isExceeded = measurement.value < standard.limit_value; // e.g. Dissolved Oxygen drops below minimum
        ratio = standard.limit_value / (measurement.value || 0.001);
        break;
      case "range":
        // pH range e.g. 6.5 to 8.5
        if (standard.parameter.toLowerCase() === "ph") {
          isExceeded = measurement.value < 6.5 || measurement.value > 8.5;
        }
        break;
    }
  }

  let status: "within_limits" | "potential_exceedance" | "exceedance" = "within_limits";
  let severity: "low" | "moderate" | "high" | "critical" = "low";
  let explanation = "";

  if (isExceeded) {
    if (standardRequiresAverage && isInstantaneousReading) {
      status = "potential_exceedance";
      explanation = `The observed instantaneous reading (${measurement.value} ${measurement.unit}) is higher than the standard limit (${standard.limit_value} ${standard.unit}). However, because the regulatory standard prescribes a ${standard.averaging_period} averaging window, continuous monitoring is required before a definitive legal non-compliance conclusion.`;
    } else {
      status = "exceedance";
      explanation = `The measured level (${measurement.value} ${measurement.unit}) exceeds the prescribed limit of ${standard.limit_value} ${standard.unit} established by ${standard.authority} for ${standard.applicable_context}.`;
    }

    if (ratio > 2.5) severity = "critical";
    else if (ratio > 1.5) severity = "high";
    else severity = "moderate";
  } else {
    status = "within_limits";
    severity = "low";
    explanation = `The measured value (${measurement.value} ${measurement.unit}) is compliant with the permissible limit (${standard.limit_value} ${standard.unit}) under ${standard.standard_name} for ${standard.averaging_period} period.`;
  }

  return {
    assessment_id,
    parameter: measurement.parameter,
    measured_value: measurement.value,
    unit: measurement.unit,
    standard_name: `${standard.authority} - ${standard.standard_name}`,
    limit_value: standard.limit_value,
    averaging_period: standard.averaging_period,
    comparison_status: status,
    severity,
    explanation,
    source_url: standard.source_url
  };
}
