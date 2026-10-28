import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { NotificationList } from '../components/NotificationList.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationRequest } from '../services/notificationsApi.js';

export function NotificationsPage() {
  const { user, token, loading } = useAuth();
  if (loading) return <main className="mx-auto min-h-[60vh] max-w-4xl px-5 py-8"><p role="status">Comprobando sesión...</p></main>;
  if (!user) return <Navigate to="/iniciar-sesion" replace />;
  return <NotificationsHistory key={user.id + ':' + token} token={token} />;
}

function NotificationsHistory({ token }) {
  const [data, setData] = useState({ notifications: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await notificationRequest(token, '?all=true', { signal: controller.signal });
        if (!controller.signal.aborted) { setData(result); setError(''); }
      } catch (error) { if (!controller.signal.aborted) setError(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(load, 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [token, retry]);
  async function markRead() {
    setMarking(true);
    try {
      await notificationRequest(token, '/read', { method: 'PATCH' });
      const result = await notificationRequest(token, '?all=true');
      setData(result); setError('');
    } catch (error) { setError(error.message); }
    finally { setMarking(false); }
  }
  return <main id="main-content" className="page-container inner-page notifications-page">
    <div className="page-heading">
      <h1>Tus juegos tienen novedades</h1>
      <p className="mt-2 text-sm text-muted">Todas tus notificaciones de ofertas y precios, de la más reciente a la más antigua.</p>
    </div>
    {data.unreadCount > 0 && <button type="button" disabled={marking} onClick={markRead} className="mt-5 text-sm text-primary disabled:opacity-60">Marcar todas como leídas</button>}
    {error && <div className="mt-5"><p role="alert" className="text-sm text-primary">{error}</p><button type="button" onClick={() => setRetry(current => current + 1)} className="mt-2 text-sm text-primary underline">Reintentar</button></div>}
    {loading ? <p role="status" className="py-8">Cargando notificaciones...</p> : data.notifications.length ? <NotificationList notifications={data.notifications} /> : !error && <p className="py-8 text-sm text-muted">Todavía no tenés notificaciones. Guardá favoritos y elegí el precio que esperás.</p>}
  </main>;
}
