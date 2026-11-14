import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { HttpError } from './pin.ts';
export { HttpError };
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'El servicio no está configurado. Contacte a la administración.');
  return value;
}
export const service = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
export async function rpc<T>(db: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new HttpError(error.code === '42501' ? 403 : error.code?.startsWith('23') ? 409 : 422,
    error.code?.startsWith('23') ? 'Los datos no son válidos o ya existe un registro con ese número.' : error.message);
  return data as T;
}
export async function caller(req: Request, db: SupabaseClient) {
  const jwt = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!jwt) throw new HttpError(401, 'Inicie sesión para continuar');
  const { data: { user }, error } = await db.auth.getUser(jwt);
  if (error || !user) throw new HttpError(401, 'La sesión expiró. Inicie sesión de nuevo.');
  const { data: member, error: memberError } = await db.from('members').select('*').eq('user_id', user.id).single();
  if (memberError || !member?.active) throw new HttpError(403, 'La cuenta no está activa');
  return member as { user_id: string; org_id: string; role: string; full_name: string };
}
export async function body(req: Request): Promise<unknown> {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415, 'Se requiere contenido JSON');
  const text = await req.text();
  if (text.length > 8192) throw new HttpError(413, 'La solicitud es demasiado grande');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'El contenido JSON no es válido'); }
}
export function serve(handler: (req: Request) => Promise<unknown>) {
  Deno.serve(async req => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    try {
      const origin = new URL(env('APP_URL')).origin;
      if (req.headers.get('origin') && req.headers.get('origin') !== origin) throw new HttpError(403, 'Origen no permitido');
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido');
      return new Response(JSON.stringify(await handler(req)), { status: 200, headers });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : error instanceof ZodError ? 400 : 500;
      const message = error instanceof HttpError ? error.message : error instanceof ZodError ? 'Revise los datos: ' + error.issues.map(i => i.message).join('. ') : 'No se pudo completar la operación. Intente de nuevo.';
      // No se registra el cuerpo: puede contener PIN, contraseña o datos personales.
      if (status === 429) headers['Retry-After'] = '900';
      return new Response(JSON.stringify({ error: message }), { status, headers });
    }
  });
}
