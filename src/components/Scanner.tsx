import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notice } from './UI';
export default function Scanner({ close }: { close: () => void }) {
  const navigate = useNavigate(); const [error, setError] = useState(''); const starting = useRef(false);
  useEffect(() => {
    if (starting.current) return; starting.current = true;
    let disposed = false; let scanner: import('html5-qrcode').Html5Qrcode | undefined; let found = false;
    import('html5-qrcode').then(async ({ Html5Qrcode }) => {
      if (disposed) return; scanner = new Html5Qrcode('qr-reader');
      await scanner.start({ facingMode: 'environment' }, { fps: 8, qrbox: { width: 230, height: 230 } }, text => {
        if (found) return;
        try { const url = new URL(text); if (url.origin !== window.location.origin || url.pathname !== '/c' || !url.searchParams.get('t')) throw new Error();
          found = true; navigate('/c?t=' + encodeURIComponent(url.searchParams.get('t')!));
        } catch { setError('Este QR no es de su checador. Escanee el código del quiosco.'); }
      }, () => {});
      if (disposed && scanner.isScanning) await scanner.stop();
    }).catch(() => { if (!disposed) setError('No se pudo abrir la cámara. Revise el permiso o use la cámara de su teléfono para abrir el QR.'); });
    return () => { disposed = true; if (scanner?.isScanning) void scanner.stop().catch(() => {}); starting.current = false; };
  }, [navigate]);
  return <section className="card scanner-panel"><h2>Escanee el QR del quiosco</h2><p className="muted">Coloque el código dentro del recuadro.</p><div id="qr-reader" />{error && <Notice>{error}</Notice>}<button className="button secondary" onClick={close}>Cerrar cámara</button></section>;
}
