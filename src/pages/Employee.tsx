import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, ArrowRight, Clock3 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useQuery';
import { readAll } from '../lib/api';
import type { EffectiveEvent } from '../lib/types';
import { eventLabel } from '../lib/types';
import { localDateTime, localTime, compareEvents } from '../lib/attendance';
import { Loading, Notice, PageTitle, Empty } from '../components/UI';
import { useOnline } from '../hooks/useOnline';
const Scanner = lazy(() => import('../components/Scanner'));
export default function Employee() {
  const { member, org, needsAcceptance } = useAuth(); const [scanning, setScanning] = useState(false); const online = useOnline();
  const query = useQuery(() => readAll<EffectiveEvent>('v_effective_events', { member_id: member!.user_id }), [member!.user_id]);
  const events = [...query.data ?? []].sort((a,b)=>compareEvents(b,a)); const last = events[0]; const inside = last?.event_type === 'in';
  return <><PageTitle eyebrow="MI JORNADA" title={`Hola, ${member?.full_name.split(' ')[0]}`} /><p className="lead">Su tiempo de trabajo, en un solo lugar.</p>{!member?.active && <Notice>Su cuenta está inactiva. Puede consultar su historial; contacte a la administración para registrar marcas.</Notice>}
    {query.loading ? <Loading /> : query.error ? <Notice>{query.error}<button className="text-button" onClick={query.reload}>Volver a intentar</button></Notice> : <>
    <section className={`status-card ${inside ? 'inside' : ''}`}><div className="status-copy"><p className="eyebrow">ESTADO ACTUAL</p><div className="status-label"><i />{inside ? `Dentro desde las ${localTime(last.occurred_at, org!.timezone).slice(0, 5)}` : 'Fuera de jornada'}</div><p>{inside ? 'Al terminar, escanee el QR para registrar su salida.' : 'Escanee el QR del quiosco para registrar su próxima entrada.'}</p></div><Clock3 size={80} strokeWidth={1} aria-hidden="true" /></section>
    <button className="button scan-button" disabled={!online || !member?.active || needsAcceptance} onClick={() => setScanning(true)}><ScanLine size={30} /><span>Escanear QR<small>Confirme su entrada o salida</small></span><ArrowRight /></button>
    {scanning && <Suspense fallback={<Loading>Abriendo cámara…</Loading>}><Scanner close={() => setScanning(false)} /></Suspense>}
    <section className="card"><div className="section-heading"><h2>Últimas marcas</h2><Link to="/historial">Ver historial <ArrowRight size={16} /></Link></div>
    {events.length === 0 ? <Empty>Aún no hay marcas. Su primera entrada aparecerá aquí.</Empty> : <ul className="event-list">{events.slice(0, 5).map(e => <li key={e.id}><span className={`event-icon ${e.event_type}`}>{e.event_type === 'in' ? '↙' : '↗'}</span><div><strong>{eventLabel(e.event_type)}</strong><small>{e.source === 'correccion' ? 'Corregido' : 'Registro original'} · Folio {e.folio}</small></div><time>{localDateTime(e.occurred_at, org!.timezone)}</time></li>)}</ul>}</section></>}
  </>;
}
