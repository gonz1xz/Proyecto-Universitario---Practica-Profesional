import { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentUser, loginUser } from '../services/authApi.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'auraprices_access_token';

// Esto solo lee el vencimiento para la interfaz. El backend verifica la firma.
function expirationTime(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    return Number.isFinite(payload.exp) ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [sessionMessage, setSessionMessage] = useState('');

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLoading(false);
    setSessionMessage('');
  }

  async function login(form, remember) {
    const data = await loginUser(form);
    const storage = remember ? localStorage : sessionStorage;
    // Quitamos cualquier sesión anterior antes de guardar la nueva.
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    storage.setItem(TOKEN_KEY, data.accessToken);
    setSessionMessage('');
    setUser(data.user);
    setToken(data.accessToken);
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    const remaining = expirationTime(token) - Date.now();
    function expireSession() {
      logout();
      setSessionMessage('Tu sesión venció. Iniciá sesión nuevamente.');
    }
    if (remaining <= 0) {
      expireSession();
      return;
    }
    const timer = setTimeout(expireSession, remaining);
    setLoading(true);
    getCurrentUser(token)
      .then(data => { if (active) setUser(data.user); })
      .catch(error => {
        if (!active) return;
        if (error.status === 401) logout();
        setSessionMessage(error.message);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer); };
  }, [token]);

  return <AuthContext.Provider value={{ user, loading, login, logout, sessionMessage }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
