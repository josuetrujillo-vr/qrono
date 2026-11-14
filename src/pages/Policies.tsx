import { Navigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { rpc } from '../lib/api';
import { policyLabel } from '../lib/types';
import { safeReturn } from './Login';
import { PageTitle, Notice, useAction } from '../components/UI';
export default function Policies() {
  const { policies, refresh, needsAcceptance } = useAuth(); const [accepted, setAccepted] = useState(false); const action = useAction(); const location = useLocation();
  if (!needsAcceptance) return <Navigate to={safeReturn(location.state?.next) ?? '/'} replace />;
  return <><PageTitle eyebrow="ANTES DE SU PRIMERA MARCA" title="Conozca y acepte el registro" /><p className="lead">Lea los documentos vigentes de su empresa. La aceptación queda registrada junto con su versión.</p>
    {policies.length !== 2 && <Notice>La empresa aún debe publicar ambos documentos. Contacte a la administración.</Notice>}
    {policies.map(p => <article className="card policy" key={p.id}><div className="section-heading"><h2>{policyLabel(p.kind)}</h2><span className="badge">Versión {p.version}</span></div><div className="policy-body">{p.body_markdown}</div></article>)}
    {action.feedback}<label className="check-field"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />He leído y acepto el aviso de privacidad y el acuerdo de registro electrónico vigentes.</label>
    <button className="button" disabled={!accepted || policies.length !== 2 || action.busy} onClick={() => action.run(async () => { try { await rpc('accept_current_policies', { p_document_ids: policies.map(p=>p.id), p_user_agent: navigator.userAgent }); } finally { setAccepted(false); await refresh(); } })}>{action.busy ? 'Guardando aceptación…' : 'Aceptar y continuar'}</button></>;
}
