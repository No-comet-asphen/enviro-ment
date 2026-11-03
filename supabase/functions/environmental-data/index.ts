// supabase/functions/environmental-data/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { successResponse } from "../_shared/response.ts";

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  return successResponse({
    measurements: [
      {
        id: crypto.randomUUID(),
        station_name: "Anand Vihar CAAQMS Station",
        parameter: "PM2.5",
        value: 142.5,
        unit: "µg/m³",
        measured_at: new Date().toISOString(),
        latitude: 28.6469,
        longitude: 77.3160,
        source_name: "CPCB Open Environmental Portal",
        source_url: "https://cpcb.nic.in/caaqms/",
        quality_flag: "valid"
      }
    ]
  });
});
