// supabase/functions/_shared/supabase.ts

export function getSupabaseEnv() {
  const url =
    (globalThis as any).Deno?.env?.get("SUPABASE_URL") ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://localhost:54321";
  const serviceRoleKey =
    (globalThis as any).Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY") ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "test-service-role-key";
  const anonKey =
    (globalThis as any).Deno?.env?.get("SUPABASE_ANON_KEY") ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "test-anon-key";

  return { url, serviceRoleKey, anonKey };
}
