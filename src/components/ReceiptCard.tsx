import { Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { Receipt } from '../lib/types';
import { eventLabel } from '../lib/types';
import { localDateTime } from '../lib/attendance';
export function ReceiptCard({ receipt, timezone }: { receipt: Receipt; timezone: string }) {
  return <section className="receipt" aria-live="polite"><div className="receipt-check"><Check size={28} /></div><p className="eyebrow">MARCA REGISTRADA</p><h2>{receipt.employee_name}</h2>
    <div className={`event-heading ${receipt.event_type}`}>{receipt.event_type === 'in' ? <ArrowDownLeft /> : <ArrowUpRight />}{eventLabel(receipt.event_type)}</div>
    <p className="receipt-time">{localDateTime(receipt.occurred_at, timezone)}</p><small>{timezone}</small><div className="receipt-folio"><span>FOLIO</span><strong>{receipt.folio}</strong></div><p className="muted">Su comprobante también está en el historial.</p></section>;
}
