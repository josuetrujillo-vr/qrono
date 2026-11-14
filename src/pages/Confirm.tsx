import { useSearchParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useQuery';
import { edge } from '../lib/api';
import type { Receipt, EventType } from '../lib/types';
import { useOnline } from '../hooks/useOnline';
import { ReceiptCard } from '../components/ReceiptCard';
import { Loading, Notice, useAction, PageTitle } from '../components/UI';
export default function Confirm() {
  const [params] = useSearchParams(); const token = params.get('t') ?? ''; const { org, refresh } = useAuth(); const online = useOnline(); const action = useAction(); const [receipt, setReceipt] = useState<Receipt>();
  const proposal = useQuery(async () => { if (!token) throw new Error('Falta el código QR. Escanee de nuevo el quiosco.'); try { return await edge<{ event_type: EventType }>('checkin', { method: 'qr', token, dry_run: true }); } catch(e) { if(e instanceof Error && e.message.includes('Debe aceptar')) await refresh(); throw e; } }, [token]);
  return <><PageTitle eyebrow="CONFIRMACIÓN" title={receipt ? 'Su marca quedó registrada' : 'Revise su próxima marca'} />
    {receipt ? <><ReceiptCard receipt={receipt} timezone={org!.timezone} /><Link className="button" to="/">Volver a mi jornada</Link></> : proposal.loading ? <Loading>Validando código…</Loading> : proposal.error ? <><Notice>{proposal.error}</Notice><Link className="button" to="/">Escanear de nuevo</Link></> : <section className="card confirm-card"><p>Va a registrar</p><h2 className="confirm-type">{proposal.data?.event_type === 'in' ? 'ENTRADA' : 'SALIDA'}</h2><p className="muted">La hora se asignará al confirmar, usando el servidor de su empresa.</p>{action.feedback}
      <button className="button full" disabled={action.busy || !online} onClick={() => action.run(async () => { try { setReceipt(await edge<Receipt>('checkin', { method: 'qr', token })); } catch(e) { if(e instanceof Error && e.message.includes('Debe aceptar')) await refresh(); throw e; } })}>{action.busy ? 'Registrando…' : 'Confirmar marca'}</button><Link to="/" className="text-button">Cancelar</Link></section>}</>;
}
