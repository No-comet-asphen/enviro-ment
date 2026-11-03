// supabase/functions/create-report/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { CreateReportSchema } from "../_shared/schemas.ts";
import { extractAuthUser } from "../_shared/auth.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = CreateReportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    const user = extractAuthUser(req);
    const report_id = crypto.randomUUID();
    const incident_id = crypto.randomUUID();

    // Edge function response matching contract
    return successResponse({
      report_id,
      incident_id,
      report_status: "submitted",
      incident_status: "investigating",
      analysis_status: "queued"
    }, 201);
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Failed to process report", 500);
  }
});
