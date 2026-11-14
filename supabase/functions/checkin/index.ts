import { createClient } from '@supabase/supabase-js';
import { checkinSchema, employeeEmail } from '../_shared/business.ts';
import { authenticatePin } from '../_shared/pin.ts';
import { verifyQrToken } from '../_shared/qr.ts';
import { serve, service, caller, body, rpc, env, HttpError } from '../_shared/runtime.ts';
serve(async req => {
  const input = checkinSchema.parse(await body(req));
  const db = service(); const member = await caller(req, db);
  if (input.method === 'qr') {
    if (member.role !== 'employee') throw new HttpError(403, 'Solo un empleado puede marcar con QR');
    const { data: secret } = await db.from('org_secrets').select('qr_secret').eq('org_id', member.org_id).single();
    if (!secret || !await verifyQrToken(input.token, member.org_id, secret.qr_secret)) throw new HttpError(410, 'El código expiró o no pertenece a su empresa, escanee de nuevo');
    return input.dry_run ? await rpc(db, 'propose_time_event', { p_member_id: member.user_id }) :
      await rpc(db, 'record_time_event', { p_member_id: member.user_id, p_kiosk_id: null, p_method: 'qr' });
  }
  if (member.role !== 'kiosk') throw new HttpError(403, 'Solo un quiosco puede registrar con PIN');
  const { data: org } = await db.from('organizations').select('slug').eq('id', member.org_id).single();
  if (!org) throw new HttpError(503, 'Empresa no disponible');
  const employeeId = await authenticatePin({
    begin: () => rpc(db, 'begin_pin_attempt', { p_kiosk_id: member.user_id, p_employee_number: input.employee_number }),
    verify: async () => {
      // Cliente efímero: nunca reemplaza ni persiste la sesión del quiosco.
      const anon = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      const { data, error } = await anon.auth.signInWithPassword({ email: employeeEmail(org.slug, input.employee_number), password: input.pin });
      if (error || !data.user) return null;
      const { data: employee } = await db.from('members').select('user_id').eq('user_id', data.user.id).eq('org_id', member.org_id).eq('role', 'employee').eq('active', true).single();
      // Invalida la sesión efímera para que no quede un refresh token utilizable.
      await anon.auth.signOut({ scope: 'local' });
      return employee?.user_id ?? null;
    },
    finish: async (attemptId, success) => { await rpc(db, 'finish_pin_attempt', { p_attempt_id: attemptId, p_success: success }); },
  });
  return await rpc(db, 'record_time_event', { p_member_id: employeeId, p_kiosk_id: member.user_id, p_method: 'kiosk_pin' });
});
