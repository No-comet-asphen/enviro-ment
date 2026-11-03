// supabase/functions/incident-detail/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return errorResponse("VALIDATION_ERROR", "id param required");

  return successResponse({
    incident: {
      id,
      title: "Water supply interruption",
      summary: "Multiple citizen reports and feeder pipeline maintenance corroborate water outage.",
      category: "water_supply",
      status: "investigating",
      severity: "moderate",
      evidence_confidence: "high",
      escalation: "stable",
      location_name: "Example Locality",
      latitude: 19.0,
      longitude: 73.1,
      first_reported_at: new Date(Date.now() - 7200000).toISOString(),
      last_updated_at: new Date().toISOString()
    },
    report_count: 12,
    evidence: [],
    measurements: [],
    applicable_standards: [],
    timeline: []
  });
});
