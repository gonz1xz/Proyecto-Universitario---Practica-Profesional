import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { verifyEmailAddress } from '../services/authApi.js';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [status, setStatus] = useState('ready');
  const [message, setMessage] = useState('');
  async function confirm() {
    setStatus('saving');
    try {
      const result = await verifyEmailAddress(token);
      setMessage(result.message);
      setStatus('success');
      navigate('/notificaciones/verificar-email', { replace: true });
    } catch (error) { setMessage(error.message); setStatus('error'); }
  }
  return <main id="main-content" className="page-container inner-page max-w-2xl">
    <h1 className="text-2xl font-semibold">Confirmá tu correo</h1>
    <p className="mt-4 text-muted">Esta confirmación permite activar los avisos por mail de tus alertas de precio.</p>
    {!token && <p role="alert" className="mt-4 text-error">El enlace está incompleto. Solicitá uno nuevo desde la alerta de un juego.</p>}
    {token && status !== 'success' && <button type="button" className="button button-primary mt-6" disabled={status === 'saving'} onClick={confirm}>{status === 'saving' ? 'Confirmando...' : 'Confirmar mi correo'}</button>}
    {message && <p role={status === 'error' ? 'alert' : 'status'} className={`mt-4 ${status === 'error' ? 'text-error' : 'text-primary'}`}>{message}</p>}
    <Link to="/mis-favoritos" className="mt-6 inline-block text-primary underline">Ir a mis favoritos</Link>
  </main>;
}
