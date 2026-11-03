// supabase/functions/incident-timeline/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const url = new URL(req.url);
  const incident_id = url.searchParams.get("incident_id");
  if (!incident_id) {
    return errorResponse("VALIDATION_ERROR", "incident_id query parameter required");
  }

  return successResponse({
    events: [
      {
        id: crypto.randomUUID(),
        event_type: "report_received",
        message: "Citizen report was submitted and registered.",
        created_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: crypto.randomUUID(),
        event_type: "evidence_added",
        message: "Relevant municipal notification corroborated the report.",
        created_at: new Date().toISOString()
      }
    ]
  });
});
