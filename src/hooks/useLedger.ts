import { useAuth } from './useAuth';
import { useQuery } from './useQuery';
import { loadLedger } from '../lib/api';
import { applyCorrections, pairShifts } from '../lib/attendance';
export function useLedger() {
  const { org } = useAuth();
  return useQuery(async () => {
    const ledger = await loadLedger(org!.id); const {members,limits}=ledger;
    const effective = applyCorrections(ledger.events, ledger.corrections, org!.timezone);
    return { ...ledger, members, effective, shifts: pairShifts(effective, org!.timezone), limits: Object.fromEntries(limits.map(l => [l.year, l.hours])) as Record<number, number> };
  }, [org!.id, org!.timezone]);
}
