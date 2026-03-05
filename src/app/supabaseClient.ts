import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase env vars ausentes: NEXT_PUBLIC_SUPABASE_URL e/ou NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
