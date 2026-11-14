import { useEffect, useState } from 'react';
import { errorMessage } from '../lib/supabase';
export function useQuery<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    load().then(result => { if (live) setData(result); }).catch(e => { if (live) setError(errorMessage(e)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // Cada pantalla proporciona las claves primitivas de su consulta.
  }, [...deps, version]);
  return { data, error, loading, reload: () => setVersion(v => v + 1) };
}
