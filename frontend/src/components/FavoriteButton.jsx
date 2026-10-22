import { Heart, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useFavorites } from '../context/FavoritesContext.jsx';

export function FavoriteButton({ game }) {
  const { user, token, loading } = useAuth();
  const { isFavorite, isPending, toggleFavorite, status } = useFavorites();
  const [error, setError] = useState('');
  useEffect(() => setError(''), [token, game.id]);
  useEffect(() => {
    if (!error) return;
    const timeout = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(timeout);
  }, [error]);

  const saved = isFavorite(game.id);
  const pending = isPending(game.id);
  async function toggle() {
    setError('');
    if (!user || !token) {
      setError('Registrate o iniciá sesión para añadir este producto a tus favoritos.');
      return;
    }
    try { await toggleFavorite(game.id); }
    catch (error) { setError(error.message); }
  }
  return (
    <div className="absolute right-3 top-3 z-20">
      <button type="button" disabled={loading || pending || status === 'loading'} onClick={toggle} aria-label={(saved ? 'Quitar ' : 'Añadir ') + game.title + (saved ? ' de favoritos' : ' a favoritos')} aria-pressed={saved} className={'grid size-9 place-items-center rounded-full bg-background/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' + (saved ? 'text-primary' : 'text-text hover:text-primary')}>
        {pending ? <LoaderCircle size={17} className="animate-spin" /> : <Heart size={17} fill={saved ? 'currentColor' : 'none'} />}
      </button>
      {error && <p role="alert" className="absolute right-0 top-11 w-56 rounded-md border border-primary/30 bg-surface p-3 text-xs text-primary shadow-lg">{error}</p>}
    </div>
  );
}
