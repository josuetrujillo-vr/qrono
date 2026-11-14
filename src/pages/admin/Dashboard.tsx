import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useLedger } from '../../hooks/useLedger';
import { localDay, localDateTime, compareEvents } from '../../lib/attendance';
import { eventLabel } from '../../lib/types';
import { PageTitle, Loading, Notice, Empty } from '../../components/UI';
export default function Dashboard() {
  const { org } = useAuth(); const query = useLedger(); const data = query.data;
  const today = localDay(new Date().toISOString(), org!.timezone);
  const latest = new Map([...data?.effective ?? []].sort(compareEvents).map(e => [e.member_id, e]));
  const inside = data?.members.filter(m => m.role === 'employee' && latest.get(m.user_id)?.event_type === 'in') ?? [];
  const daily = data?.events.filter(e => localDay(e.occurred_at, org!.timezone) === today).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) ?? [];
  const incomplete = data?.shifts.filter(s => s.status === 'incompleto') ?? [];
  const memberMap = new Map(data?.members.map(m => [m.user_id, m]));
  return <><PageTitle eyebrow="SU EQUIPO, HOY" title="Resumen de jornada"><button className="button secondary small" onClick={query.reload} disabled={query.loading}><RefreshCw size={16} />Actualizar</button></PageTitle><p className="lead">{org?.name} · {today.split('-').reverse().join('/')}</p>
    {query.loading ? <Loading /> : query.error ? <Notice>{query.error}</Notice> : <>
      <div className="stats-grid"><div className="stat"><p className="stat-label">Dentro ahora</p><div className="stat-value">{inside.length}</div><p className="stat-foot">Según la última marca efectiva</p></div><div className="stat"><p className="stat-label">Marcas de hoy</p><div className="stat-value">{daily.length}</div><p className="stat-foot">Entradas y salidas originales</p></div><div className="stat"><p className="stat-label">Turnos incompletos</p><div className="stat-value">{incomplete.length}</div><p className="stat-foot">Incluye las entradas abiertas</p></div></div>
      <div className="two-columns"><section className="card"><div className="section-heading"><h2>Quién está dentro</h2><span className="badge success">{inside.length} personas</span></div>{inside.length === 0 ? <Empty>No hay entradas abiertas.</Empty> : <ul className="event-list">{inside.map(m => <li key={m.user_id}><div className="avatar">{m.full_name[0]}</div><div><strong>{m.full_name}</strong><small>N.º {m.employee_number}{!m.active ? ' · Cuenta inactiva' : ''}</small></div><time>{localDateTime(latest.get(m.user_id)!.occurred_at, org!.timezone)}</time></li>)}</ul>}</section>
      <section className="card"><div className="section-heading"><h2>Para revisar</h2><Link to="/admin/registros">Ver registros <ArrowRight size={16} /></Link></div>{incomplete.length === 0 ? <Empty>Todos los turnos están emparejados.</Empty> : <ul className="event-list">{incomplete.slice(-8).reverse().map((s, i) => <li key={i}><span className="badge warning">Incompleto</span><div><strong>{memberMap.get(s.member_id)?.full_name}</strong><small>{s.day} · {s.entry ? 'Entrada sin salida' : 'Salida sin entrada'}{s.corrected ? ' · Corregido' : ''}</small></div></li>)}</ul>}</section></div>
      <section className="card table-card"><div className="section-heading"><h2>Actividad de hoy</h2><Link to="/admin/registros">Ver todo <ArrowRight size={16} /></Link></div>{daily.length === 0 ? <Empty>Las marcas del equipo aparecerán aquí.</Empty> : <div className="table-scroll"><table><thead><tr><th>Empleado</th><th>Marca</th><th>Fecha y hora</th><th>Método</th><th>Folio</th></tr></thead><tbody>{daily.slice(0, 15).map(e => <tr key={e.id}><td className="person-name">{memberMap.get(e.member_id)?.full_name}</td><td><span className={`badge ${e.event_type === 'in' ? 'success' : ''}`}>{eventLabel(e.event_type)}</span></td><td className="date-data">{localDateTime(e.occurred_at, org!.timezone)}</td><td>{e.method === 'qr' ? 'QR' : 'PIN'}</td><td><code>{e.hash.slice(0, 8).toUpperCase()}</code></td></tr>)}</tbody></table></div>}</section>
    </>}</>;
}
