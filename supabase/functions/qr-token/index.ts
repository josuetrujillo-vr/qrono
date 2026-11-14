import { z } from 'zod';
import { serve, service, caller, body, HttpError } from '../_shared/runtime.ts';
import { createQrToken, SLOT_SECONDS } from '../_shared/qr.ts';
serve(async req => {
  z.strictObject({}).parse(await body(req));
  const db = service(); const member = await caller(req, db);
  if (member.role !== 'kiosk') throw new HttpError(403, 'Solo un quiosco puede generar códigos');
  const { data, error } = await db.from('org_secrets').select('qr_secret').eq('org_id', member.org_id).single();
  if (error || !data) throw new HttpError(503, 'No se pudo generar el código. Intente de nuevo.');
  const now = Date.now();
  return { token: await createQrToken(member.org_id, data.qr_secret, now), server_time: new Date(now).toISOString(),
    expires_at: new Date((Math.floor(now / 30000) + 1) * 30000).toISOString(), slot_seconds: SLOT_SECONDS };
});
