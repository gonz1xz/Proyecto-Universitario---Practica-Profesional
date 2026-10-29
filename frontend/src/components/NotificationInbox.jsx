import { Bell, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationList } from './NotificationList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationRequest } from '../services/notificationsApi.js';

export function NotificationInbox() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await notificationRequest(token, '', { signal: controller.signal });
        if (!controller.signal.aborted) { setData(result); setError(''); }
      } catch (error) { if (!controller.signal.aborted) setError(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [token, open]);
  useEffect(() => {
    if (open) dialogRef.current.showModal();
    else dialogRef.current.close();
  }, [open]);
  async function markRead() {
    setMarking(true);
    try {
      await notificationRequest(token, '/read', { method: 'PATCH' });
      const result = await notificationRequest(token);
      setData(result); setError('');
    } catch (error) { setError(error.message); }
    finally { setMarking(false); }
  }
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={`Notificaciones: ${data.unreadCount} sin leer`} className="relative grid size-10 place-items-center rounded-md text-primary hover:bg-primary/10"><Bell size={21} />{data.unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs font-bold text-background">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}</button>
    <dialog ref={dialogRef} onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }} aria-labelledby="inbox-title" className="price-modal m-auto max-h-[calc(100vh-2rem)] w-[min(34rem,calc(100%-2rem))] overflow-y-auto rounded-lg border border-text/15 bg-surface p-5 text-text shadow-2xl">
      <header className="flex items-center justify-between gap-4"><h2 id="inbox-title" className="text-xl font-semibold">Tus notificaciones</h2><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones" className="p-2"><X size={20} /></button></header>
      <p className="mt-2 text-xs text-muted">Últimos 50 avisos. Revisamos ofertas cada 30 minutos mientras el servidor está activo.</p>
      {data.unreadCount > 0 && <button type="button" disabled={marking} onClick={markRead} className="mt-4 text-sm text-primary disabled:opacity-60">Marcar todas como leídas</button>}
      {error && <p role="alert" className="mt-4 text-sm text-primary">{error}</p>}
      {loading ? <p role="status" className="py-8">Cargando notificaciones...</p> : !data.notifications.length && !error ? <p className="py-8 text-sm text-muted">Todavía no tenés notificaciones. Guardá favoritos y elegí el precio que esperás.</p> : <NotificationList notifications={data.notifications.slice(0, 5)} onNavigate={() => setOpen(false)} />}
      {data.notifications.length > 5 && <Link to="/notificaciones" onClick={() => setOpen(false)} className="mt-5 inline-block rounded-md border border-primary px-5 py-2.5 text-sm text-primary">Ver más</Link>}
    </dialog>
  </>;
}
