// supabase/functions/subscribe-alerts/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { SubscribeAlertsSchema } from "../_shared/schemas.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = SubscribeAlertsSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    return successResponse({
      subscription_id: crypto.randomUUID(),
      enabled: true
    });
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Failed to subscribe alerts", 500);
  }
});
