import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getDb, supabase, errorMessage } from '../lib/supabase';
import type { Member, Organization, Policy } from '../lib/types';
interface AuthState { session: Session | null; member: Member | null; org: Organization | null; policies: Policy[]; needsAcceptance: boolean; loading: boolean; error: string; refresh: () => Promise<void> }
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null); const [member, setMember] = useState<Member | null>(null); const [org, setOrg] = useState<Organization | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]); const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase)); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(()=>{const update=()=>setRevision(r=>r+1);window.addEventListener('focus',update);return()=>window.removeEventListener('focus',update)},[]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => { if (live) { setSession(data.session); if (error) setError(error.message); if (!data.session) setLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => { setSession(next); if (!next) { setMember(null); setOrg(null); setLoading(false); } });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!session) return;
    let live = true; setLoading(true); setError('');
    (async () => {
      const db = getDb(); const { data: m, error: me } = await db.from('members').select('*').eq('user_id', session.user.id).single();
      if (me || !m) throw new Error('Su cuenta no está asociada a una empresa. Contacte a la administración.');
      const [orgResult, policyResult, acceptanceResult] = await Promise.all([
        db.from('organizations').select('*').eq('id', m.org_id).single(),
        db.from('policy_documents').select('*').eq('org_id', m.org_id).order('version', { ascending: false }),
        db.from('policy_acceptances').select('document_id').eq('member_id', m.user_id),
      ]);
      if (orgResult.error || policyResult.error || acceptanceResult.error) throw new Error('No se pudo cargar la empresa. Vuelva a intentar.');
      const latest = [...new Map((policyResult.data as Policy[]).map(p => p.kind).map(kind => [kind, (policyResult.data as Policy[]).find(p => p.kind === kind)!])).values()];
      const accepted = new Set(acceptanceResult.data?.map(a => a.document_id));
      if (live) { setMember(m as Member); setOrg(orgResult.data as Organization); setPolicies(latest); setNeedsAcceptance(m.role === 'employee' && (latest.length !== 2 || latest.some(p => !accepted.has(p.id)))); }
    })().catch(e => { if (live) setError(errorMessage(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [session?.user.id, revision]);
  const refresh = async () => { setRevision(r => r + 1); };
  return <Context value={{ session, member, org, policies, needsAcceptance, loading, error, refresh }}>{children}</Context>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Falta AuthProvider'); return value; }
