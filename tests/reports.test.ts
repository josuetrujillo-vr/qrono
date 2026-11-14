import { describe,it,expect } from 'vitest';
import { pairShifts, weeklySummary, shiftsInRange, localDay, applyCorrections, compareTimestamp } from '../src/lib/attendance';
import type { TimeEvent, Correction } from '../src/lib/types';
const event=(event_type:'in'|'out',occurred_at:string,id=occurred_at)=>({id,member_id:'m',event_type,occurred_at,source:'original' as const,created_at:occurred_at});
describe('turnos por secuencia',()=>{
 it('día normal',()=>{const [s]=pairShifts([event('in','2026-11-09T15:00:00Z'),event('out','2026-11-09T23:00:00Z')],'America/Mexico_City');expect(s.hours).toBe(8);expect(s.day).toBe('2026-11-09');expect(s.status).toBe('completo')});
 it('medianoche se atribuye a entrada',()=>{const [s]=pairShifts([event('in','2026-11-10T04:00:00Z'),event('out','2026-11-10T12:00:00Z')],'America/Mexico_City');expect(s.hours).toBe(8);expect(s.day).toBe('2026-11-09')});
 it('entrada y salida huérfanas',()=>{expect(pairShifts([event('in','2026-11-09T15:00:00Z')],'UTC')[0].status).toBe('incompleto');expect(pairShifts([event('out','2026-11-09T15:00:00Z')],'UTC')[0].status).toBe('incompleto')});
 it('dos entradas conservan la primera incompleta',()=>expect(pairShifts([event('in','2026-11-09T15:00:00Z'),event('in','2026-11-09T16:00:00Z'),event('out','2026-11-09T17:00:00Z')],'UTC').map(s=>s.status)).toEqual(['incompleto','completo']));
 it('no mezcla empleados',()=>expect(pairShifts([event('in','2026-11-09T15:00:00Z'),{...event('out','2026-11-09T17:00:00Z'),member_id:'otro'}],'UTC').every(s=>s.status==='incompleto')).toBe(true));
 it('mantiene turnos al filtrar después de emparejar',()=>{const shifts=pairShifts([event('in','2026-11-09T23:00:00Z'),event('out','2026-11-10T08:00:00Z')],'UTC');expect(shiftsInRange(shifts,'2026-11-09','2026-11-09')).toHaveLength(1);expect(shiftsInRange(shifts,'2026-11-10','2026-11-10')).toHaveLength(0)});
 it('semana usa año de cada día y límite informativo',()=>{const shifts=pairShifts([event('in','2027-01-04T08:00:00Z'),event('out','2027-01-04T16:00:00Z')],'UTC');const [w]=weeklySummary(shifts,1,{2027:46});expect(w.hours).toBe(8);expect(w.limit).toBe(46);expect(w.week).toBe('2027-01-04')});
 it('año desconocido no inventa límite',()=>{const shifts=pairShifts([event('in','2031-01-04T08:00:00Z'),event('out','2031-01-04T16:00:00Z')],'UTC');expect(weeklySummary(shifts,1,{2030:40})[0].limit).toBeNull()});
 it('fecha local respeta zona',()=>expect(localDay('2026-11-10T02:00:00Z','America/Mexico_City')).toBe('2026-11-09'));
 it('ordena timestamps con fracciones omitidas por PostgreSQL',()=>{const [s]=pairShifts([event('out','2026-11-14T10:00:00.123+00:00'),event('in','2026-11-14T10:00:00+00:00')],'UTC');expect(s.status).toBe('completo');expect(s.hours).toBeGreaterThan(0)});
 it('conserva precisión de microsegundos en empates de milisegundo',()=>expect(compareTimestamp('2026-11-14T10:00:00.123001Z','2026-11-14T10:00:00.123002+00:00')).toBeLessThan(0));
 it('permite corregir una inserción equivocada sin modificarla',()=>{const c={id:'corregida',member_id:'m',kind:'insert',event_type:'in',occurred_at:'2026-11-09T15:00:00Z',created_at:'2026-11-10T15:00:00Z',reason:'Entrada equivocada'} as Correction;const v={...c,id:'anulacion',kind:'void',target_event_id:c.id,event_type:null,occurred_at:null} as Correction;expect(applyCorrections([] as TimeEvent[],[c,v],'UTC')).toHaveLength(0)});
});
