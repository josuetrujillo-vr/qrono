import { formatInTimeZone } from 'date-fns-tz';
import { format, parseISO, startOfWeek } from 'date-fns';
import type { EffectiveEvent, TimeEvent, Correction } from './types';
export const localDay = (iso: string, zone: string) => formatInTimeZone(iso, zone, 'yyyy-MM-dd');
export const localTime = (iso: string, zone: string) => formatInTimeZone(iso, zone, 'HH:mm:ss');
export const localDateTime = (iso: string, zone: string) => formatInTimeZone(iso, zone, 'dd/MM/yyyy HH:mm:ss');
export function compareTimestamp(a: string,b: string): number { return Date.parse(a)-Date.parse(b) || Number((a.match(/\.(\d+)/)?.[1]??'').padEnd(9,'0'))-Number((b.match(/\.(\d+)/)?.[1]??'').padEnd(9,'0')); }
export const compareEvents = (a: EffectiveEvent,b: EffectiveEvent) => compareTimestamp(a.occurred_at,b.occurred_at)||compareTimestamp(a.created_at,b.created_at)||a.id.localeCompare(b.id);
export interface Shift { member_id: string; day: string; entry: EffectiveEvent | null; exit: EffectiveEvent | null; hours: number | null; status: 'completo' | 'incompleto'; corrected: boolean }
export function pairShifts(events: EffectiveEvent[], zone: string): Shift[] {
  const result: Shift[] = []; const pending = new Map<string, EffectiveEvent>();
  const push = (entry: EffectiveEvent | null, exit: EffectiveEvent | null) => result.push({
    member_id: (entry ?? exit)!.member_id, day: localDay((entry ?? exit)!.occurred_at, zone), entry, exit,
    hours: entry && exit ? (Date.parse(exit.occurred_at) - Date.parse(entry.occurred_at)) / 3600000 : null,
    status: entry && exit ? 'completo' : 'incompleto',
    corrected: [entry, exit].some(e => e?.source === 'correccion' || e?.corrected === true),
  });
  for (const e of [...events].sort(compareEvents)) {
    const entry = pending.get(e.member_id);
    if (e.event_type === 'in') { if (entry) push(entry, null); pending.set(e.member_id, e); }
    else { push(entry ?? null, e); pending.delete(e.member_id); }
  }
  for (const entry of pending.values()) push(entry, null);
  return result.sort((a, b) => a.day.localeCompare(b.day) || a.member_id.localeCompare(b.member_id));
}
export const shiftsInRange = (shifts: Shift[], from: string, to: string) => shifts.filter(s => s.day >= from && s.day <= to);
export function applyCorrections(events: TimeEvent[], corrections: Correction[], zone: string): EffectiveEvent[] {
  const originals: EffectiveEvent[] = events.map(e => ({ ...e, source: 'original', event_id: e.id, folio: e.hash.slice(0, 8).toUpperCase() }));
  const voidIds = new Set(corrections.filter(c => c.kind === 'void').map(c => c.target_event_id));
  const impacted = new Set<string>();
  // Señala también el extremo conservado de un turno cuya otra marca fue anulada.
  for (const s of pairShifts(originals, zone)) if (voidIds.has(s.entry?.id ?? '') || voidIds.has(s.exit?.id ?? '')) {
    if (s.entry) impacted.add(s.entry.id); if (s.exit) impacted.add(s.exit.id);
  }
  return [...originals.filter(e => !voidIds.has(e.id)).map(e => ({ ...e, corrected: impacted.has(e.id) })),
    ...corrections.filter(c => c.kind === 'insert' && !voidIds.has(c.id)).map(c => ({ id: c.id, org_id: c.org_id, member_id: c.member_id,
      event_type: c.event_type!, occurred_at: c.occurred_at!, source: 'correccion' as const, correction_id: c.id,
      reason: c.reason, created_at: c.created_at, folio: c.id.replace(/-/g, '').slice(0, 8).toUpperCase(), corrected: true }))];
}
export function weeklySummary(shifts: Shift[], startsOn: number, limits: Record<number, number>) {
  const groups = new Map<string, { member_id: string; week: string; year: number; hours: number; limit: number | null; incomplete: number }>();
  for (const shift of shifts) {
    const year = Number(shift.day.slice(0, 4));
    const week = format(startOfWeek(parseISO(shift.day), { weekStartsOn: startsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6 }), 'yyyy-MM-dd');
    // Una semana que cruza año se separa: el límite aplicable depende del año del día de entrada.
    const key = `${shift.member_id}:${week}:${year}`;
    const row = groups.get(key) ?? { member_id: shift.member_id, week, year, hours: 0, limit: limits[year] ?? null, incomplete: 0 };
    row.hours += shift.hours ?? 0; if (shift.status === 'incompleto') row.incomplete++;
    groups.set(key, row);
  }
  return [...groups.values()];
}
