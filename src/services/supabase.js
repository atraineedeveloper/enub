import { createClient } from "@supabase/supabase-js";

/** @type {import('./types/supabase').Database} */ // Esto ayuda a la IA a leer el esquema
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined in environment variables",
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
