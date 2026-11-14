import { getDb } from './supabase';
import type { TimeEvent, Correction } from './types';
export async function rpc<T = void>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getDb().rpc(name, args); if (error) throw new Error(error.message); return data as T;
}
export async function edge<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getDb().functions.invoke(name, { body });
  if (error) {
    let message = 'No se pudo conectar. Compruebe su conexión e intente de nuevo.';
    if (error.context instanceof Response) { try { message = (await error.context.json()).error ?? message; } catch { /* respuesta sin JSON */ } }
    throw new Error(message);
  }
  return data as T;
}
type Filters = { org_id?: string; member_id?: string; user_id?: string };
export async function readAll<T>(table: string, filters: Filters = {}, order = 'id'): Promise<T[]> {
  const result: T[] = [];
  let cursor: string | number | undefined;
  for (;;) {
    let query = getDb().from(table).select('*').order(order, { ascending: true }).limit(1000);
    if(cursor!==undefined) query=query.gt(order,cursor);
    for (const [key, value] of Object.entries(filters)) if (value) query = query.eq(key, value);
    const { data, error } = await query; if (error) throw new Error(error.message);
    result.push(...data as T[]); if (data.length < 1000) return result; cursor=data[data.length-1][order] as string | number;
  }
}
export async function loadLedger(orgId: string, memberId?: string) {
  void orgId;
  return rpc<{ events: TimeEvent[]; corrections: Correction[]; members: import('./types').Member[]; limits: {year:number;hours:number}[]; snapshot_at:string }>('get_ledger',{p_member_id:memberId??null});
}
