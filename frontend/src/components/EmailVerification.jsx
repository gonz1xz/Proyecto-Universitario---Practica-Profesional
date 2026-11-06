import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationRequest } from '../services/notificationsApi.js';

export function EmailVerification({ onStatusChange }) {
  const { token } = useAuth();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const controllerRef = useRef(null);

  async function loadStatus(signal) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await notificationRequest(token, '/email/status', { signal });
      if (signal.aborted) return;
      setInfo(result); onStatusChange?.(result);
    } catch (error) { if (!signal.aborted) setError(error.message); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [token, onStatusChange]);

  async function sendLink() {
    const signal = controllerRef.current.signal;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await notificationRequest(token, '/email/verification', { method: 'POST', body: {}, signal });
      if (!signal.aborted) setMessage(result.message);
    } catch (error) { if (!signal.aborted) setError(error.message); }
    finally { if (!signal.aborted) setBusy(false); }
  }
  return <div className="space-y-3">
    {info?.email && <p className="break-all text-sm text-muted">{info.email}</p>}
    {info?.verified ? <p className="text-sm text-accent">Correo confirmado.</p>
      : info && <p className="text-sm text-muted">Confirmá tu correo para recibir avisos por mail.</p>}
    {info && !info.configured && <p className="text-sm text-error" role="alert">Los avisos por mail no están disponibles en este momento. Podés seguir usando el buzón de notificaciones.</p>}
    {!info?.verified && <button type="button" disabled={busy || !info?.configured} onClick={sendLink} className="text-sm text-primary underline disabled:opacity-60">Enviar enlace de confirmación</button>}
    <button type="button" disabled={busy} onClick={() => loadStatus(controllerRef.current.signal)} className="block text-sm text-primary underline disabled:opacity-60">{busy ? 'Consultando...' : !info || error ? 'Reintentar estado del correo' : info.verified ? 'Actualizar estado del correo' : 'Ya confirmé; actualizar estado'}</button>
    {message && <p className="text-sm text-accent" role="status">{message}</p>}
    {error && <p className="text-sm text-error" role="alert">{error}</p>}
  </div>;
}
