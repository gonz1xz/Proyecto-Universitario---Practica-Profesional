import { Heart, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';

export function FavoriteButton({ game, selected, onToggle, disabled = false }) {
  const { user, token, loading } = useAuth();
  const { isFavorite, isPending, toggleFavorite, status } = useFavorites();
  const [error, setError] = useState('');
  useEffect(() => setError(''), [token, game.id]);
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  // En favoritos, el corazón modifica una selección local hasta confirmar.
  const saved = onToggle ? selected : isFavorite(game.id);
  const pending = onToggle ? false : isPending(game.id);
  async function toggle() {
    setError('');
    if (onToggle) { onToggle(game.id); return; }
    if (!user || !token) {
      setError('Registrate o iniciá sesión para añadir este producto a tus favoritos.');
      return;
    }
    try { await toggleFavorite(game.id); }
    catch (error) { setError(error.message); }
  }
  return (
    <div className="absolute right-3 top-3 z-20">
      <button type="button" disabled={disabled || loading || pending || status === 'loading'} onClick={toggle} aria-label={onToggle ? (saved ? 'Seleccionar ' + game.title + ' para eliminar de favoritos' : 'Conservar ' + game.title + ' en favoritos') : (saved ? 'Quitar ' : 'Añadir ') + game.title + (saved ? ' de favoritos' : ' a favoritos')} aria-pressed={saved} className={'grid size-11 place-items-center rounded-full border border-text/15 bg-background/95 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (saved ? 'text-primary' : 'text-text hover:text-primary')}>
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Heart size={17} fill={saved ? 'currentColor' : 'none'} />}
      </button>
      {error && <p role="alert" className="absolute right-0 top-11 w-56 rounded-md border border-primary/30 bg-surface p-3 text-xs text-primary shadow-lg">{error}</p>}
    </div>
  );
}
