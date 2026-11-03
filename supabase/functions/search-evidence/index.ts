// supabase/functions/search-evidence/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse, errorResponse } from "../_shared/response.ts";
import { SearchEvidenceSchema } from "../_shared/schemas.ts";
import { getResearchProvider } from "../_shared/research.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "POST required", 405);
  }

  try {
    const body = await req.json();
    const parsed = SearchEvidenceSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", parsed.error.errors[0]?.message || "Invalid input");
    }

    const provider = getResearchProvider();
    const results = await provider.search({
      query: parsed.data.query,
      category: parsed.data.category,
      locationName: parsed.data.location?.name,
      latitude: parsed.data.location?.latitude,
      longitude: parsed.data.location?.longitude,
      dateFrom: parsed.data.date_from,
      dateTo: parsed.data.date_to,
      sourceTypes: parsed.data.source_types
    });

    return successResponse({
      results,
      next_page: null
    });
  } catch (err: any) {
    return errorResponse("SERVER_ERROR", err.message || "Search failed", 500);
  }
});
