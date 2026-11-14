import { adminSchema, employeeEmail } from '../_shared/business.ts';
import { serve, service, caller, body, rpc, HttpError } from '../_shared/runtime.ts';
serve(async req => {
  const input = adminSchema.parse(await body(req));
  const db = service(); const actor = await caller(req, db);
  if (!['owner', 'admin'].includes(actor.role)) throw new HttpError(403, 'Se requiere una cuenta administradora');
  if (input.action === 'update' || input.action === 'reset_pin') {
    const safeData = input.action === 'update' ? { full_name: input.full_name, active: input.active } : {};
    // Autoriza y audita antes de modificar Auth; nunca envía el PIN a PostgreSQL.
    await rpc(db, 'admin_save_member', { p_actor_id: actor.user_id, p_user_id: input.user_id, p_action: input.action, p_data: safeData });
    if (input.action === 'reset_pin') {
      const { error } = await db.auth.admin.updateUserById(input.user_id, { password: input.pin });
      const { error: auditError } = await db.from('audit_log').insert({ org_id: actor.org_id, actor_id: actor.user_id,
        action: error ? 'reset_pin_failed' : 'reset_pin_completed', entity: 'members', entity_id: input.user_id });
      if (error || auditError) throw new HttpError(503, 'No se pudo confirmar el cambio de PIN. Revise la cuenta y vuelva a intentar.');
    }
    return { ok: true };
  }
  const { data: org } = await db.from('organizations').select('slug').eq('id', actor.org_id).single();
  if (!org) throw new HttpError(503, 'Empresa no disponible');
  const email = input.action === 'create_employee' ? employeeEmail(org.slug, input.employee_number) : input.email;
  const password = input.action === 'create_employee' ? input.pin : input.password;
  const fullName = input.action === 'create_kiosk' ? input.name : input.full_name;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new HttpError(409, 'No se pudo crear la cuenta. Revise si el número o correo ya está registrado.');
  try {
    await rpc(db, 'admin_save_member', { p_actor_id: actor.user_id, p_user_id: data.user.id, p_action: input.action,
      p_data: { full_name: fullName, employee_number: input.action === 'create_employee' ? input.employee_number : null } });
  } catch (error) { await db.auth.admin.deleteUser(data.user.id); throw error; }
  return { user_id: data.user.id };
});
