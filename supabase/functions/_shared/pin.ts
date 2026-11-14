export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Reservation = { blocked: boolean; attempt_id?: string; retry_at?: string };
export async function authenticatePin(deps: {
  begin: () => Promise<Reservation>; verify: () => Promise<string | null>;
  finish: (attemptId: string, success: boolean) => Promise<void>;
}): Promise<string> {
  const reservation = await deps.begin();
  if (reservation.blocked) throw new HttpError(429, 'Demasiados intentos. Espere 15 minutos antes de volver a intentar.');
  if (!reservation.attempt_id) throw new HttpError(503, 'No se pudo registrar el intento. Intente de nuevo.');
  let user: string | null = null;
  try { user = await deps.verify(); } finally { await deps.finish(reservation.attempt_id, user !== null); }
  if (!user) throw new HttpError(401, 'Número o PIN incorrectos');
  return user;
}
