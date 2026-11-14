import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation, Link } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { getDb } from './lib/supabase';
import type { Role } from './lib/types';
import Shell from './components/Shell';
import { Loading, Notice, PageTitle } from './components/UI';
import Login, { homeFor } from './pages/Login';
const Employee = lazy(() => import('./pages/Employee'));
const Policies = lazy(() => import('./pages/Policies'));
const Confirm = lazy(() => import('./pages/Confirm'));
const History = lazy(() => import('./pages/History'));
const Kiosk = lazy(() => import('./pages/Kiosk'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Members = lazy(() => import('./pages/admin/Members'));
const Records = lazy(() => import('./pages/admin/Records'));
const Reports = lazy(() => import('./pages/admin/Reports'));
const Settings = lazy(() => import('./pages/admin/Settings'));
export function Protected({ roles }: { roles: Role[] }) {
  const auth = useAuth(); const location = useLocation();
  if (auth.loading) return <Loading />;
  if (!auth.session) return <Navigate to="/login" state={{ next: location.pathname + location.search }} replace />;
  if (auth.error) return <main className="standalone"><Notice>{auth.error}</Notice><button className="button" onClick={() => void auth.refresh()}>Volver a intentar</button><button className="text-button" onClick={() => void getDb().auth.signOut()}>Cerrar sesión</button></main>;
  if (!auth.member) return <Loading />;
  if (!roles.includes(auth.member.role)) return <Navigate to={homeFor(auth.member.role)} replace />;
  if (auth.member.role === 'employee' && auth.member.active && auth.needsAcceptance && !['/aceptacion', '/historial'].includes(location.pathname)) return <Navigate to="/aceptacion" state={{ next: location.pathname + location.search }} replace />;
  return <Outlet />;
}
export default function App() {
  return <Suspense fallback={<Loading />}><Routes><Route path="/login" element={<Login />} />
    <Route element={<Protected roles={['kiosk']} />}><Route path="quiosco" element={<Kiosk />} /></Route>
    <Route element={<Protected roles={['employee']} />}><Route element={<Shell />}><Route index element={<Employee />} /><Route path="aceptacion" element={<Policies />} /><Route path="c" element={<Confirm />} /><Route path="historial" element={<History />} /></Route></Route>
    <Route element={<Protected roles={['owner', 'admin']} />}><Route element={<Shell />}><Route path="admin" element={<Dashboard />} /><Route path="admin/empleados" element={<Members />} /><Route path="admin/registros" element={<Records />} /><Route path="admin/reportes" element={<Reports />} /><Route path="admin/configuracion" element={<Settings />} /></Route></Route>
    <Route path="*" element={<main className="standalone"><PageTitle title="Esta página no existe" /><Link to="/">Volver al inicio</Link></main>} />
  </Routes></Suspense>;
}
