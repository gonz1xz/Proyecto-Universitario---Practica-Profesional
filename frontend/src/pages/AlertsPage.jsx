import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationRequest } from '../services/notificationsApi.js';
import { EmailVerification } from '../components/EmailVerification.jsx';
import { PriceAlertModal } from '../components/PriceAlertModal.jsx';

export function AlertsPage() {
  const { user, token, loading } = useAuth();
  if (loading) return <main id="main-content" className="page-container inner-page"><p role="status">Comprobando sesión...</p></main>;
  if (!user) return <Navigate to="/iniciar-sesion" replace />;
  return <AlertsList key={user.id + ':' + token} token={token} />;
}

function AlertsList({ token }) {
  const [data, setData] = useState({ alerts: [], total: 0, hasMore: false, nextOffset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    notificationRequest(token, '/alerts', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, retry]);

  async function loadMore() {
    setLoadingMore(true); setError('');
    try {
      const result = await notificationRequest(token, '/alerts?offset=' + data.nextOffset);
      setData(current => ({ ...result, alerts: [...new Map([...current.alerts, ...result.alerts].map(alert => [alert.id, alert])).values()] }));
    } catch (error) { setError(error.message); }
    finally { setLoadingMore(false); }
  }
  async function removeAlert(alert) {
    setDeleting(alert.id); setError(''); setMessage('');
    try {
      await notificationRequest(token, '/alerts/' + alert.game.id, { method: 'DELETE' });
      setData(current => ({ ...current, alerts: current.alerts.filter(item => item.id !== alert.id), total: Math.max(0, current.total - 1), nextOffset: Math.max(0, current.nextOffset - 1) }));
      setConfirming(null); setMessage(`Se eliminó la alerta de ${alert.game.title}.`);
    } catch (error) { setError(error.message); }
    finally { setDeleting(null); }
  }

  return <main id="main-content" className="page-container inner-page">
    <div className="page-heading"><h1>Mis alertas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Revisá los precios que esperás. Podés editar o eliminar cada alerta sin quitar el juego de tus favoritos.</p></div>
    <section className="my-7 border-y border-text/10 py-5" aria-labelledby="alerts-email-title"><h2 id="alerts-email-title" className="mb-3 text-lg font-semibold">Tu correo para los avisos</h2><EmailVerification /></section>
    {message && <p role="status" className="mb-5 text-sm text-accent">{message}</p>}
    {error && <div className="mb-5"><p role="alert" className="text-sm text-error">{error}</p><button type="button" disabled={loading || loadingMore || deleting !== null} onClick={() => setRetry(value => value + 1)} className="mt-2 text-sm text-primary underline">Reintentar lista</button></div>}
    {loading ? <p role="status">Cargando alertas...</p> : <>
      <p className="mb-4 text-sm text-muted">{data.total} {data.total === 1 ? 'alerta guardada' : 'alertas guardadas'}</p>
      {data.alerts.length ? <ul className="divide-y divide-text/10">
        {data.alerts.map(alert => <li key={alert.id} className="py-5 sm:flex sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0"><h2 className="text-lg font-semibold">{alert.game.title}</h2>
            {alert.game.detailsUnavailable && <p className="mt-1 break-all text-xs text-muted">No se pudo cargar el título. Juego: {alert.game.id}</p>}
            <p className="mt-2 text-lg font-semibold text-primary">Hasta {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(Number(alert.targetPrice))} USD</p>
            <p className="mt-2 text-sm text-muted">{alert.isActive ? 'Activa' : 'Pausada'} · {alert.emailEnabled ? 'Buzón y mail' : 'Buzón de notificaciones'}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 sm:mt-1">
            {confirming === alert.id ? <div className="space-y-3"><p className="text-sm">¿Eliminar esta alerta?</p><div className="flex gap-4"><button type="button" disabled={deleting !== null || loadingMore} onClick={() => removeAlert(alert)} className="text-sm text-error underline disabled:opacity-60">{deleting === alert.id ? 'Eliminando...' : 'Eliminar alerta'}</button><button type="button" disabled={deleting !== null} onClick={() => setConfirming(null)} className="text-sm text-primary underline">Cancelar</button></div></div> : <>
              <button type="button" disabled={deleting !== null || loadingMore} onClick={() => setEditing(alert.game)} className="flex items-center gap-2 text-sm text-primary disabled:opacity-60"><Pencil size={16} aria-hidden="true" />Editar</button>
              <button type="button" disabled={deleting !== null || loadingMore} onClick={() => setConfirming(alert.id)} className="flex items-center gap-2 text-sm text-error disabled:opacity-60"><Trash2 size={16} aria-hidden="true" />Eliminar</button>
            </>}
          </div>
        </li>)}
      </ul> : !error && <div className="py-8"><Bell size={28} className="text-primary" aria-hidden="true" /><h2 className="mt-4 text-lg font-semibold">Todavía no guardaste alertas</h2><p className="mt-2 text-sm text-muted">Elegí un juego de tus favoritos y el precio que esperás.</p><Link to="/mis-favoritos" className="mt-4 inline-block text-primary underline">Ir a mis favoritos</Link></div>}
      {data.hasMore && <button type="button" disabled={loadingMore || deleting !== null} onClick={loadMore} className="button button-primary mt-6 disabled:opacity-60">{loadingMore ? 'Cargando...' : 'Cargar más alertas'}</button>}
    </>}
    {editing && <PriceAlertModal key={editing.id} game={editing} onClose={() => setEditing(null)} onSaved={saved => setData(current => ({ ...current, alerts: current.alerts.map(alert => alert.id === saved.id ? { ...alert, ...saved } : alert) }))} />}
  </main>;
}
