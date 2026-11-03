// supabase/functions/incidents/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "PATCH") {
    if (!id) return errorResponse("VALIDATION_ERROR", "id param required");
    const body = await req.json();
    return successResponse({
      incident_id: id,
      status: body.status || "monitoring",
      updated_at: new Date().toISOString()
    });
  }

  // GET /incidents
  return successResponse({
    items: [
      {
        id: id || "00000000-0000-0000-0000-000000000001",
        title: "Water supply interruption",
        category: "water_supply",
        status: "investigating",
        severity: "moderate",
        evidence_confidence: "medium",
        escalation: "increasing",
        location_name: "Example Locality",
        latitude: 19.0,
        longitude: 73.1,
        report_count: 12,
        last_updated_at: new Date().toISOString()
      }
    ],
    page: 1,
    limit: 20,
    total: 1
  });
});
