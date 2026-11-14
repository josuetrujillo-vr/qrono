import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null;
export function getDb() {
  if (!supabase) throw new Error('El servicio aún no está disponible. Contacte a la administración.');
  return supabase;
}
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la operación. Intente de nuevo.'; }
