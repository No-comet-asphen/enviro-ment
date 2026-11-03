// backend/src/supabase.client.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== "YOUR_SUPABASE_SERVICE_ROLE_KEY"
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key && !url.includes("YOUR_PROJECT_REF")) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: { persistSession: false }
      });
      return supabaseInstance;
    } catch (err: any) {
      console.warn("Could not initialize Supabase client:", err.message);
    }
  }

  return null;
}
