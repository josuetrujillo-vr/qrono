import { useEffect, useRef, useState } from 'react';
import { Clock3, Delete, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useOnline } from '../hooks/useOnline';
import { edge } from '../lib/api';
import { getDb, errorMessage } from '../lib/supabase';
import type { QrToken, Receipt } from '../lib/types';
import { localDay, localTime } from '../lib/attendance';
import { ActionForm, Field, Notice, Loading, useAction } from '../components/UI';
import { ReceiptCard } from '../components/ReceiptCard';
export default function Kiosk() {
  const { member, org } = useAuth(); const online = useOnline(); const action = useAction();
  const [qr, setQr] = useState<QrToken>(); const [qrImage, setQrImage] = useState(''); const [qrError, setQrError] = useState(''); const [time, setTime] = useState<number>();
  const [number, setNumber] = useState(''); const [pin, setPin] = useState(''); const [focused, setFocused] = useState<'number' | 'pin'>('number'); const [receipt, setReceipt] = useState<Receipt>();
  const pinRef = useRef<HTMLInputElement>(null); const numberRef = useRef<HTMLInputElement>(null);
  const clock = useRef<{ time: number; performance: number } | null>(null);
  useEffect(() => { const timer = setInterval(() => { if (clock.current) setTime(clock.current.time + performance.now() - clock.current.performance); }, 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!online) { setQr(undefined); setQrImage(''); return; }
    let live = true; let timer: ReturnType<typeof setTimeout>;
    const renew = async () => {
      let delay = 5000;
      try {
        const started = performance.now(); const token = await edge<QrToken>('qr-token', {});
        const serverTime = Date.parse(token.server_time) + (performance.now() - started) / 2;
        const { toDataURL } = await import('qrcode');
        const base = import.meta.env.VITE_APP_URL || window.location.origin;
        const image = await toDataURL(`${base.replace(/\/$/, '')}/c?t=${encodeURIComponent(token.token)}`, { width: 600, margin: 3, errorCorrectionLevel: 'M', color: { dark: '#17324D', light: '#FFFFFF' } });
        if (!live) return;
        clock.current = { time: serverTime, performance: performance.now() }; setTime(serverTime); setQr(token); setQrImage(image); setQrError('');
        // Renueva al cambiar de slot o a los 25 s, lo que ocurra primero.
        delay = Math.max(1000, Math.min(25000, Date.parse(token.expires_at) - serverTime + 100));
      } catch (e) { if (live) { setQrError(errorMessage(e)); setQr(undefined); setQrImage(''); } }
      finally { if (live) timer = setTimeout(renew, delay); }
    };
    void renew(); return () => { live = false; clearTimeout(timer); };
  }, [online]);
  useEffect(() => {
    if (!receipt) return;
    const timer = setTimeout(() => { setReceipt(undefined); numberRef.current?.focus(); }, 5000); return () => clearTimeout(timer);
  }, [receipt]);
  useEffect(() => {
    let lock: WakeLockSentinel | undefined; let live = true;
    const acquire = async () => { if ('wakeLock' in navigator && document.visibilityState === 'visible') { try { const next = await navigator.wakeLock.request('screen'); if (!live) await next.release(); else lock = next; } catch { /* La tablet puede no admitir mantener la pantalla activa. */ } } };
    void acquire(); document.addEventListener('visibilitychange', acquire);
    return () => { live = false; document.removeEventListener('visibilitychange', acquire); void lock?.release(); };
  }, []);
  const seconds = qr && time ? Math.max(0, Math.ceil((Date.parse(qr.expires_at) - time) / 1000)) : 0;
  const key = (value: string) => {
    const current = focused === 'number' ? number : pin; const setter = focused === 'number' ? setNumber : setPin;
    setter(value === 'delete' ? current.slice(0, -1) : value === 'clear' ? '' : (current + value).slice(0, focused === 'pin' ? 6 : 24));
  };
  const submit = () => action.run(async () => {
    if (!online) throw new Error('Sin conexión: no se pueden registrar marcas');
    const result = await edge<Receipt>('checkin', { method: 'kiosk_pin', employee_number: number.trim().toLowerCase(), pin });
    setReceipt(result); setNumber(''); setPin(''); setFocused('number');
  });
  return <div className="kiosk-page"><header className="kiosk-header"><div><div className="brand"><span className="brand-icon"><Clock3 size={24} /></span>checador<span className="brand-dot">.</span></div><p className="muted">{org?.name} · {member?.full_name}</p></div><div><span className={`connection ${online && !qrError ? '' : 'offline'}`}>{online && !qrError ? <Wifi size={18} /> : <WifiOff size={18} />}</span><button className="icon-button" aria-label="Cerrar sesión del quiosco" onClick={() => action.run(async () => { const { error } = await getDb().auth.signOut(); if (error) throw error; })}><LogOut size={20} /></button></div></header>
    {!online && <Notice>Sin conexión: no se pueden registrar marcas. No hay registros pendientes de envío.</Notice>}{qrError && <Notice>{qrError} Se volverá a intentar automáticamente.</Notice>}
    <div className="kiosk-content"><section className="kiosk-qr-panel"><div className="kiosk-clock" aria-label="Hora del servidor">{time ? localTime(new Date(time).toISOString(), org!.timezone) : '--:--:--'}</div><p className="kiosk-date">{time ? localDay(new Date(time).toISOString(), org!.timezone).split('-').reverse().join('/') : 'Sincronizando hora…'} · {org?.timezone}</p>
      <div className="card"><h1>Escanee para marcar</h1><p className="muted">Abra la cámara de su teléfono o su checador.</p><div className="qr-wrap">{qrImage ? <img src={qrImage} alt="Código QR dinámico para registrar entrada o salida" /> : <Loading>Preparando código…</Loading>}{(!online || seconds === 0) && <div className="qr-expired">{online ? 'Actualizando código…' : 'Sin conexión'}</div>}</div><div className="countdown" role="progressbar" aria-label="Vigencia del QR" aria-valuenow={seconds} aria-valuemin={0} aria-valuemax={30}><span style={{ width: `${seconds / 30 * 100}%` }} /></div><small className="muted">Código nuevo en {seconds} s · Confirme la marca en su teléfono.</small></div>
    </section><section className="kiosk-pin-panel"><div className="card"><p className="eyebrow">OTRA FORMA DE MARCAR</p><h2>¿Sin celular?</h2><p className="muted">Use su número de empleado y PIN.</p>{action.feedback}<ActionForm onSubmit={submit}>
      <div className="kiosk-fields"><Field label="Número de empleado"><input ref={numberRef} value={number} onChange={e => setNumber(e.target.value.toLowerCase())} onFocus={() => setFocused('number')} maxLength={24} autoComplete="off" required disabled={action.busy} /></Field><Field label="PIN de 6 dígitos"><input ref={pinRef} type="password" inputMode="numeric" value={pin} onFocus={() => setFocused('pin')} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} pattern="[0-9]{6}" autoComplete="off" required disabled={action.busy} /></Field></div>
      <div className="keypad" aria-label={`Teclado para ${focused === 'number' ? 'número de empleado' : 'PIN'}`}>{['1','2','3','4','5','6','7','8','9','clear','0','delete'].map(value => <button key={value} type="button" aria-label={value === 'clear' ? 'Borrar todo' : value === 'delete' ? 'Borrar último dígito' : value} disabled={action.busy || !online} onClick={() => key(value)}>{value === 'clear' ? 'C' : value === 'delete' ? <Delete size={23} style={{ margin: 'auto' }} /> : value}</button>)}</div>
      <button className="button secondary full" type="button" onClick={() => pinRef.current?.focus()} disabled={action.busy}>Pasar al PIN</button><button className="button full" style={{ marginTop: 12 }} disabled={action.busy || !online || !number || pin.length !== 6 || Boolean(receipt)}>{action.busy ? 'Registrando…' : 'Registrar entrada / salida'}</button>
    </ActionForm><p className="muted" style={{ marginTop: 18, fontSize: '.73rem' }}>La entrada o salida se determina automáticamente. Su PIN es personal.</p></div></section></div><p className="kiosk-foot">Hora sincronizada con el servidor · Cada marca genera un comprobante</p>
    {receipt && <div className="kiosk-receipt" role="status"><ReceiptCard receipt={receipt} timezone={org!.timezone} /></div>}</div>;
}
