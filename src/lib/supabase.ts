import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The Supabase URL and publishable key are safe to expose in the browser:
// the database's Row Level Security rules decide what each user can see.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// null when Supabase isn't configured yet; the app then works without accounts.
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
