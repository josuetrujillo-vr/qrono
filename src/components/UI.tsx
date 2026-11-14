import { useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { errorMessage } from '../lib/supabase';
export function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  return <div className={`notice ${tone}`} role={tone === 'error' ? 'alert' : 'status'}><AlertCircle size={19} aria-hidden="true" /><div>{children}</div></div>;
}
export function Loading({ children = 'Cargando…' }: { children?: ReactNode }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={22} />{children}</div>; }
export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <header className="page-title"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{children}</header>;
}
export function Empty({ children }: { children: ReactNode }) { return <p className="empty">{children}</p>; }
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const run = async (action: () => Promise<void>, message = '') => {
    if (busy) return; setBusy(true); setError(''); setSuccess('');
    try { await action(); setSuccess(message); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  };
  return { busy, error, success, run, feedback: <>{error && <Notice>{error}</Notice>}{success && <Notice tone="success">{success}</Notice>}</> };
}
export function ActionForm({ onSubmit, children, className = '' }: { onSubmit: () => void; children: ReactNode; className?: string }) {
  return <form className={className} onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }}>{children}</form>;
}
