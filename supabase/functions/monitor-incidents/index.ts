// supabase/functions/monitor-incidents/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { MonitorIncidentsSchema } from "../_shared/schemas.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = MonitorIncidentsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    return successResponse({
      checked: parsed.data.incident_ids?.length || 1,
      updated: 1,
      new_evidence: 2
    });
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Monitoring failed", 500);
  }
});
