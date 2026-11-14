import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
export function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="modal native-dialog" ref={ref} onCancel={e => { e.preventDefault(); close(); }} aria-labelledby="dialog-title"><div className="section-heading"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Cerrar ventana" onClick={close}><X size={23} /></button></div>{children}</dialog>;
}
