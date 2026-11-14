import { NavLink, Outlet } from 'react-router-dom';
import { Clock3, LogOut, LayoutDashboard, Users, ListChecks, ChartNoAxesCombined, Settings, ScanLine, History } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getDb } from '../lib/supabase';
import { useOnline } from '../hooks/useOnline';
import { Notice, useAction } from './UI';
export default function Shell() {
  const { member, org } = useAuth(); const online = useOnline(); const action = useAction(); const admin = member?.role === 'admin' || member?.role === 'owner';
  const items = admin ? [
    ['/admin', 'Resumen', LayoutDashboard], ['/admin/empleados', 'Personas', Users], ['/admin/registros', 'Registros', ListChecks],
    ['/admin/reportes', 'Reportes', ChartNoAxesCombined], ['/admin/configuracion', 'Configuración', Settings],
  ] as const : [['/', 'Mi jornada', ScanLine], ['/historial', 'Historial', History]] as const;
  return <div className="app-shell"><aside className="sidebar"><NavLink className="brand" to={admin ? '/admin' : '/'}><span className="brand-icon"><Clock3 size={24} /></span>checador<span className="brand-dot">.</span></NavLink>
    <div className="org-label"><span className="eyebrow">CENTRO DE TRABAJO</span><strong>{org?.name}</strong></div>
    <nav aria-label="Navegación principal">{items.map(([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/' || to === '/admin'}><Icon size={20} />{label}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="avatar">{member?.full_name.slice(0, 1)}</div><div><strong>{member?.full_name}</strong><small>{admin ? 'Administración' : `Empleado ${member?.employee_number}`}</small></div>
    <button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" disabled={action.busy} onClick={() => action.run(async () => { const { error } = await getDb().auth.signOut(); if (error) throw error; })}><LogOut size={19} /></button></div>
  </aside><div className="workspace"><div className="topbar"><span>Registro de jornada</span><span className={`connection ${online ? '' : 'offline'}`}><i />{online ? 'En línea' : 'Sin conexión'}</span></div>
    <main id="contenido">{!online && <Notice>Sin conexión: no se pueden registrar marcas. Los registros no se guardan para después.</Notice>}{action.feedback}<Outlet /></main>
    <footer className="app-footer">Cada marca cuenta.<span>{org?.timezone.replace(/_/g, ' ')}</span></footer></div></div>;
}
