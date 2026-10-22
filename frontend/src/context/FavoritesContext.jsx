import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import { getFavorites, addFavorite, removeFavorite } from '../services/favoritesApi.js';

const FavoritesContext = createContext(null);
export function FavoritesProvider({ children }) {
  const { user, token, loading } = useAuth();
  const sessionKey = user && token ? user.id + ':' + token : null;
  const currentSession = useRef(sessionKey);
  currentSession.current = sessionKey;
  const [state, setState] = useState({ key: null, ids: [], status: 'idle', error: '' });
  const [pending, setPending] = useState([]);
  const locks = useRef(new Set());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!sessionKey || loading) return;
    const controller = new AbortController();
    setState({ key: sessionKey, ids: [], status: 'loading', error: '' });
    getFavorites(token, controller.signal)
      .then(items => { if (!controller.signal.aborted) setState({ key: sessionKey, ids: items.map(item => item.itadGameId), status: 'success', error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key: sessionKey, ids: [], status: 'error', error: error.message }); });
    return () => controller.abort();
  }, [sessionKey, token, loading, retry]);

  const ids = state.key === sessionKey && sessionKey ? state.ids : [];
  const status = !sessionKey ? 'idle' : state.key === sessionKey ? state.status : 'loading';
  async function toggleFavorite(id) {
    if (!sessionKey || loading) throw new Error('Necesitás iniciar sesión para guardar favoritos.');
    const operationKey = sessionKey + ':' + id;
    if (locks.current.has(operationKey)) return;
    locks.current.add(operationKey);
    setPending(current => [...current, operationKey]);
    try {
      const currentIds = status === 'success' ? ids : (await getFavorites(token)).map(item => item.itadGameId);
      const saved = currentIds.includes(id);
      if (saved) await removeFavorite(id, token);
      else await addFavorite(id, token);
      if (currentSession.current !== sessionKey) return;
      setState(current => {
        const baseIds = current.key === sessionKey && current.status === 'success' ? current.ids : currentIds;
        return { key: sessionKey, ids: saved ? baseIds.filter(item => item !== id) : [...new Set([...baseIds, id])], status: 'success', error: '' };
      });
    } finally {
      locks.current.delete(operationKey);
      setPending(current => current.filter(key => key !== operationKey));
    }
  }
  return <FavoritesContext.Provider value={{ ids, status, error: state.key === sessionKey ? state.error : '', isFavorite: id => ids.includes(id), isPending: id => pending.includes(sessionKey + ':' + id), toggleFavorite, reload: () => setRetry(current => current + 1) }}>{children}</FavoritesContext.Provider>;
}
export const useFavorites = () => useContext(FavoritesContext);
