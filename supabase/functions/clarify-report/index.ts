// supabase/functions/clarify-report/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { ClarifyReportSchema } from "../_shared/schemas.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = ClarifyReportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    const desc = (parsed.data.description || "").toLowerCase();
    const answers = parsed.data.answers || [];

    if (answers.length >= 2) {
      return successResponse({
        is_ready: true,
        detected_category: "water_quality",
        questions: []
      });
    }

    return successResponse({
      is_ready: false,
      detected_category: "water_quality",
      questions: [
        {
          id: "water_source",
          question: "Is this tap water, borewell water or another source?",
          input_type: "single_select",
          options: ["tap", "borewell", "other", "unknown"]
        },
        {
          id: "observation",
          question: "What did you notice?",
          input_type: "multi_select",
          options: ["unusual_colour", "unusual_smell", "visible_particles", "unusual_taste", "other"]
        }
      ]
    });
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Failed to clarify report", 500);
  }
});
