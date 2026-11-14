import { z } from 'zod';
export function nextEventType(last: 'in' | 'out' | null): 'in' | 'out' { return last === 'in' ? 'out' : 'in'; }
export function assertInterval(now: number, last: number | null, seconds: number): void {
  if (last !== null && now - last < seconds * 1000) throw new Error(`Espere ${seconds} segundos entre marcas`);
}
export function employeeEmail(slug: string, number: string): string { return `${slug.toLowerCase()}.${number.toLowerCase()}@empleados.checador.app`; }
const number = z.string().regex(/^[a-z0-9-]{1,24}$/, 'Número de empleado no válido');
const pin = z.string().regex(/^\d{6}$/, 'El PIN debe tener exactamente 6 dígitos');
const name = z.string().trim().min(1).max(120);
const userId = z.uuid();
export const checkinSchema = z.discriminatedUnion('method', [
  z.strictObject({ method: z.literal('qr'), token: z.string().min(1).max(100), dry_run: z.boolean().optional() }),
  z.strictObject({ method: z.literal('kiosk_pin'), employee_number: number, pin }),
]);
export const adminSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('create_employee'), employee_number: number, full_name: name, pin }),
  z.strictObject({ action: z.literal('update'), user_id: userId, full_name: name.optional(), active: z.boolean().optional() }),
  z.strictObject({ action: z.literal('reset_pin'), user_id: userId, pin }),
  z.strictObject({ action: z.literal('create_kiosk'), name, email: z.email().max(254), password: z.string().min(12).max(128) }),
  z.strictObject({ action: z.literal('create_admin'), full_name: name, email: z.email().max(254), password: z.string().min(12).max(128) }),
]);
