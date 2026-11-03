// supabase/functions/_shared/auth.ts

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
  is_moderator: boolean;
}

export function extractAuthUser(req: Request): AuthUser | null {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;

  // Check for service role key
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) {
    return {
      id: "00000000-0000-0000-0000-000000000001",
      role: "service_role",
      is_moderator: true
    };
  }

  try {
    // Basic JWT decoding for demo / edge function environment
    const parts = token.split(".");
    if (parts.length === 3) {
      const payloadStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadStr);
      return {
        id: payload.sub ?? payload.id,
        email: payload.email,
        role: payload.role ?? "authenticated",
        is_moderator: payload.app_metadata?.is_moderator === true || payload.role === "service_role"
      };
    }
  } catch (_e) {
    // If not a valid JWT format, treat token as direct test user id
  }

  return {
    id: token.length >= 8 ? token : "00000000-0000-0000-0000-000000000000",
    role: "authenticated",
    is_moderator: false
  };
}
