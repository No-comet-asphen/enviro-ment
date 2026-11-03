// supabase/functions/_shared/response.ts
import { corsHeaders } from "./cors.ts";

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  request_id: string;
}

export function successResponse<T>(data: T, status: number = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    request_id: crypto.randomUUID()
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export function errorResponse(code: string, message: string, status: number = 400): Response {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: { code, message },
    request_id: crypto.randomUUID()
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
