import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, subscribeSession, renewSession, startSession, endSession, expirationTime } from '../services/authSession.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(getSession);
  const [loading, setLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState('');
  const [sessionError, setSessionError] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeSession(value => {
      if (active) {
        setSession(value);
        setSessionError(false);
        setSessionMessage(value ? '' : 'Tu sesión terminó. Iniciá sesión nuevamente.');
      }
    });
    // Retirar el almacenamiento anterior: ahora la cookie restaura la sesión.
    sessionStorage.removeItem('auraprices_access_token');
    localStorage.removeItem('auraprices_access_token');
    renewSession().catch(error => {
      if (active && error.status !== 401) { setSessionMessage(error.message); setSessionError(true); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    let timer;
    async function refresh() {
      try {
        await renewSession();
        if (active) setSessionMessage('');
      } catch (error) {
        if (active && error.status !== 401) {
          setSessionMessage(error.message);
          setSessionError(true);
          timer = setTimeout(refresh, 30_000);
        }
      }
    }
    function checkSession() {
      if (document.visibilityState === 'visible' && expirationTime(session.token) <= Date.now() + 60_000) {
        clearTimeout(timer);
        refresh();
      }
    }
    timer = setTimeout(refresh, Math.max(0, expirationTime(session.token) - Date.now() - 60_000));
    document.addEventListener('visibilitychange', checkSession);
    window.addEventListener('online', checkSession);
    return () => {
      active = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', checkSession);
      window.removeEventListener('online', checkSession);
    };
  }, [session]);

  async function login(form, remember) {
    await startSession(form, remember);
    setSessionMessage('');
    setSessionError(false);
  }

  async function logout() {
    try {
      await endSession();
      setSessionMessage('');
    } catch (error) { setSessionMessage(error.message); setSessionError(true); }
  }

  return <AuthContext.Provider value={{ user: session?.user || null, token: session?.token || null, loading, login, logout, sessionMessage, sessionError }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
