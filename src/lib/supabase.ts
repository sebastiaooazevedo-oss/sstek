import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase (singleton).
 * As variáveis públicas são injetadas pelo Vite a partir do .env do projeto.
 * Nunca criar múltiplas instâncias — reutilize este `supabase` em todo o app.
 */
export const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
export const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});