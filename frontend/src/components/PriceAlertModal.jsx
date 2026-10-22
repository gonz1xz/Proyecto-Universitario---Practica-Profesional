import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationRequest } from '../services/notificationsApi.js';

export function PriceAlertModal({ game, onClose }) {
  const { token } = useAuth();
  const dialogRef = useRef(null);
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    notificationRequest(token, '/alerts/' + game.id, { signal: controller.signal }).then(({ alert }) => {
      if (controller.signal.aborted) return;
      if (alert) { setPrice(String(alert.targetPrice)); setActive(alert.isActive); }
      setStatus('ready');
    }).catch(error => { if (!controller.signal.aborted) { setError(error.message); setStatus('error'); } });
    return () => controller.abort();
  }, [game.id, token]);
  async function save(event) {
    event.preventDefault();
    setError(''); setSaved(false); setStatus('saving');
    try {
      await notificationRequest(token, '/alerts/' + game.id, { method: 'PUT', body: { targetPrice: Number(price), isActive: active } });
      setSaved(true); setStatus('ready');
    } catch (error) { setError(error.message); setStatus('ready'); }
  }
  return <dialog ref={dialogRef} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="alert-title" className="price-modal m-auto w-[min(28rem,calc(100%-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg border border-text/15 bg-surface p-6 text-text shadow-2xl">
    <div className="flex items-start justify-between gap-4"><h2 id="alert-title" className="text-xl font-semibold">Avisarme por {game.title}</h2><button type="button" onClick={onClose} aria-label="Cerrar alerta" className="p-2"><X size={20} /></button></div>
    <p className="mt-3 text-sm text-muted">Te avisaremos en el buzón cuando el precio sea igual o menor al que elijas. También recibirás avisos de ofertas de tus favoritos.</p>
    {status === 'loading' ? <p className="mt-5" role="status">Cargando alerta...</p> : status !== 'error' && <form onSubmit={save} className="mt-5 space-y-4">
      <label className="block text-sm">Precio máximo en USD<input autoFocus required type="number" min="0" max="9999999999.99" step="0.01" value={price} onChange={event => { setPrice(event.target.value); setSaved(false); }} className="mt-2 w-full rounded-md border border-text/20 bg-background p-3" /></label>
      <p className="text-xs text-muted">0 USD significa avisar si está gratis. Se usan precios de la región US; el objetivo se guarda en USD aunque estés viendo ARS.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={event => { setActive(event.target.checked); setSaved(false); }} />Activar aviso de precio objetivo</label>
      <button disabled={status === 'saving'} className="w-full rounded-md bg-primary p-3 font-semibold text-background disabled:opacity-60">{status === 'saving' ? 'Guardando...' : 'Guardar alerta'}</button>
    </form>}
    {error && <p role="alert" className="mt-4 text-sm text-primary">{error}</p>}
    {saved && <p role="status" className="mt-4 text-sm text-primary">Alerta guardada. Los precios se revisan cada 30 minutos mientras el servidor está activo.</p>}
  </dialog>;
}
