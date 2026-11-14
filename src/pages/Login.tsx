import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Clock3, ArrowRight, ShieldCheck, ScanLine } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { configured, getDb } from '../lib/supabase';
import { employeeEmail } from '../../supabase/functions/_shared/business';
import { Field, Notice, Loading, ActionForm, useAction } from '../components/UI';
export function homeFor(role?: string) { return role === 'kiosk' ? '/quiosco' : role === 'employee' ? '/' : '/admin'; }
export function safeReturn(value: unknown): string | null { return typeof value === 'string' && /^\/c\?t=[^\s]+$/.test(value) ? value : null; }
export default function Login() {
  const [tab, setTab] = useState<'employee' | 'admin'>('employee'); const [slug, setSlug] = useState(() => { try { return localStorage.getItem('empresa') ?? ''; } catch { return ''; } });
  const [number, setNumber] = useState(''); const [pin, setPin] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const auth = useAuth(); const action = useAction(); const location = useLocation(); const navigate = useNavigate(); const next = safeReturn(location.state?.next);
  if (auth.loading) return <Loading />;
  if (auth.session && auth.member) return <Navigate to={next && auth.member.role === 'employee' ? next : homeFor(auth.member.role)} replace />;
  const submit = () => action.run(async () => {
    const normalizedSlug = slug.trim().toLowerCase(); const normalizedNumber = number.trim().toLowerCase();
    if (tab === 'employee' && (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(normalizedSlug) || !/^[a-z0-9-]{1,24}$/.test(normalizedNumber) || !/^\d{6}$/.test(pin))) throw new Error('Revise el código de empresa, número y PIN de 6 dígitos.');
    const { error } = await getDb().auth.signInWithPassword({ email: tab === 'employee' ? employeeEmail(normalizedSlug, normalizedNumber) : email.trim(), password: tab === 'employee' ? pin : password });
    if (error) throw new Error('Los datos no son correctos o el servicio no está disponible. Revise e intente de nuevo.');
    if (tab === 'employee') { try { localStorage.setItem('empresa', normalizedSlug); } catch { /* almacenamiento opcional */ } }
    navigate(next ?? '/', { replace: true });
  });
  return <div className="login-layout"><section className="login-story"><div className="brand light"><span className="brand-icon"><Clock3 size={26} /></span>checador<span className="brand-dot">.</span></div>
    <div className="story-content"><p className="eyebrow">SU TIEMPO, BIEN REGISTRADO</p><h1>Empiece su día.<br />Deje su marca.</h1><p>Un registro claro de cada entrada y salida, para usted y su equipo.</p>
    <div className="story-receipt"><span className="story-line"><ScanLine size={23} />Del quiosco a su teléfono</span><span className="story-dashes" /><div><span>ENTRADA / SALIDA</span><ShieldCheck size={22} /></div><strong>Con hora del servidor<br />y comprobante de cada marca.</strong></div></div><small>Sin biometría. Sin ubicación. Con claridad.</small></section>
    <section className="login-form"><div className="login-form-inner"><p className="eyebrow">BIENVENIDO A SU JORNADA</p><h2>Iniciar sesión</h2><p className="muted">Use los datos que le proporcionó su empresa.</p>
      <div className="tabs" role="tablist" aria-label="Tipo de cuenta"><button role="tab" aria-selected={tab === 'employee'} onClick={() => setTab('employee')}>Empleado</button><button role="tab" aria-selected={tab === 'admin'} onClick={() => setTab('admin')}>Administrador</button></div>
      {!configured && <Notice tone="info">El servicio aún no está configurado. Contacte a la administración para habilitar el acceso.</Notice>}{auth.error && <Notice>{auth.error}</Notice>}{action.feedback}
      <ActionForm onSubmit={submit} className="stack">{tab === 'employee' ? <>
        <Field label="Código de empresa"><input required autoComplete="organization" placeholder="Ej. taller-horizonte" value={slug} onChange={e => setSlug(e.target.value)} maxLength={40} autoCapitalize="none" /></Field>
        <Field label="Número de empleado"><input required autoComplete="username" placeholder="Ej. 001" value={number} onChange={e => setNumber(e.target.value)} maxLength={24} autoCapitalize="none" /></Field>
        <Field label="PIN de 6 dígitos"><input required type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••••" /></Field>
      </> : <><Field label="Correo electrónico"><input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></Field><Field label="Contraseña"><input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field><p className="muted">Las cuentas de quiosco también ingresan aquí.</p></>}
      <button className="button full" disabled={action.busy || !configured}>{action.busy ? 'Ingresando…' : 'Iniciar sesión'}<ArrowRight size={19} /></button></ActionForm>
      <p className="login-help">¿Necesita ayuda para ingresar?<br />Solicite sus datos a la administración de su empresa.</p></div><footer>Registro electrónico de jornada · México</footer></section></div>;
}
