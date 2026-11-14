export type Role = 'owner' | 'admin' | 'employee' | 'kiosk';
export type EventType = 'in' | 'out';
export interface Member { user_id: string; org_id: string; role: Role; employee_number: string | null; full_name: string; active: boolean; created_at: string; deactivated_at: string | null }
export interface Organization { id: string; name: string; slug: string; timezone: string; week_starts_on: number; min_interval_seconds: number }
export interface TimeEvent { id: string; org_id: string; member_id: string; event_type: EventType; occurred_at: string; method: 'qr' | 'kiosk_pin'; kiosk_id: string | null; prev_hash: string; hash: string; chain_index: number; created_at: string }
export interface Correction { id: string; org_id: string; member_id: string; kind: 'void' | 'insert'; target_event_id: string | null; event_type: EventType | null; occurred_at: string | null; reason: string; created_by: string; created_at: string }
export interface EffectiveEvent { id: string; org_id?: string; member_id: string; event_type: EventType; occurred_at: string; source: 'original' | 'correccion'; event_id?: string | null; correction_id?: string | null; method?: string | null; hash?: string | null; folio?: string; reason?: string | null; created_at: string; corrected?: boolean }
export interface Policy { id: string; org_id: string; kind: 'aviso_privacidad' | 'acuerdo_registro'; version: number; body_markdown: string; created_at: string }
export interface Receipt { event_id: string; event_type: EventType; occurred_at: string; employee_name: string; folio: string }
export interface QrToken { token: string; server_time: string; expires_at: string; slot_seconds: number }
export const eventLabel = (type: EventType) => type === 'in' ? 'Entrada' : 'Salida';
export const policyLabel = (kind: Policy['kind']) => kind === 'aviso_privacidad' ? 'Aviso de privacidad' : 'Acuerdo de registro electrónico';
