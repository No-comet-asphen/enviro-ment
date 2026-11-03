// supabase/functions/assess-risk/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { AssessRiskSchema } from "../_shared/schemas.ts";
import { evaluateRisk } from "../_shared/risk.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = AssessRiskSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    // Default evaluation for testing
    const sampleMeasurement = {
      id: parsed.data.measurement_id,
      station_name: "Anand Vihar Monitoring Hub",
      parameter: "PM2.5",
      value: 142.5,
      unit: "µg/m³",
      measured_at: new Date().toISOString(),
      latitude: 28.6469,
      longitude: 77.3160,
      source_name: "CPCB Ambient Data",
      source_url: "https://cpcb.nic.in/",
      quality_flag: "valid"
    };

    const sampleStandard = {
      id: parsed.data.standard_id,
      authority: "CPCB (Central Pollution Control Board)",
      standard_name: "NAAQS 2009",
      parameter: "PM2.5",
      medium: "ambient_air",
      unit: "µg/m³",
      limit_value: 60.0,
      comparator: "lte" as const,
      averaging_period: "24-hour",
      applicable_context: "Residential and Rural Areas",
      source_url: "https://cpcb.nic.in/air-pollution/"
    };

    const result = evaluateRisk(sampleMeasurement, sampleStandard);
    return successResponse(result);
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Failed to evaluate risk", 500);
  }
});
