// supabase/functions/map-data/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse } from "../_shared/response.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return successResponse({
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [73.1, 19.0] // [longitude, latitude]
        },
        properties: {
          id: "00000000-0000-0000-0000-000000000001",
          kind: "incident",
          title: "Water supply interruption",
          category: "water_supply",
          severity: "moderate",
          status: "investigating",
          report_count: 12
        }
      }
    ]
  });
});
