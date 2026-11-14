import { subDays } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useQuery';
import { loadLedger } from '../lib/api';
import { localDateTime, localDay } from '../lib/attendance';
import { eventLabel } from '../lib/types';
import { Loading, Notice, PageTitle, Empty } from '../components/UI';
export default function History() {
  const { member, org } = useAuth(); const query = useQuery(() => loadLedger(org!.id, member!.user_id), [member!.user_id]);
  const since = localDay(subDays(new Date(), 60).toISOString(), org!.timezone); const ledger = query.data;
  const voids = new Map(ledger?.corrections.filter(c => c.kind === 'void').map(c => [c.target_event_id, c]));
  const rows = [...ledger?.events.map(e => ({ id: e.id, at: e.occurred_at, type: e.event_type, folio: e.hash.slice(0, 8).toUpperCase(), label: voids.has(e.id) ? 'Anulado · corregido' : 'Original', reason: voids.get(e.id)?.reason ?? '', method: e.method === 'qr' ? 'QR' : 'PIN en quiosco' })) ?? [],
    ...ledger?.corrections.filter(c => c.kind === 'insert').map(c => ({ id: c.id, at: c.occurred_at!, type: c.event_type!, folio: c.id.replace(/-/g, '').slice(0, 8).toUpperCase(), label: 'Agregado · corregido', reason: c.reason, method: 'Corrección administrativa' })) ?? []].filter(e => localDay(e.at, org!.timezone) >= since).sort((a, b) => b.at.localeCompare(a.at));
  return <><PageTitle eyebrow="MIS REGISTROS" title="Historial de jornada" /><p className="lead">Últimos 60 días · {org!.timezone}. Los originales y las correcciones se conservan.</p>
    {query.loading ? <Loading /> : query.error ? <Notice>{query.error}<button className="text-button" onClick={query.reload}>Volver a intentar</button></Notice> : rows.length === 0 ? <div className="card"><Empty>No hay marcas en los últimos 60 días.</Empty></div> : <div className="history-grid">{rows.map(e => <article className="card history-card" key={e.id}><div className="section-heading"><h2>{eventLabel(e.type)}</h2><span className={`badge ${e.label === 'Original' ? '' : 'warning'}`}>{e.label}</span></div><p className="history-time">{localDateTime(e.at, org!.timezone)}</p><p className="muted">{e.method}</p>{e.reason && <p className="correction-reason">Motivo: {e.reason}</p>}<div className="folio-line">FOLIO <strong>{e.folio}</strong></div></article>)}</div>}</>;
}
