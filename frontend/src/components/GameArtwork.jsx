import { useEffect, useState } from 'react';
import { Gamepad2 } from 'lucide-react';

// Una sola presentación de portadas para el inicio y el catálogo.
export function GameArtwork({ game, priority = false }) {
  const [failed, setFailed] = useState(false);
  const banner = game?.assets?.banner600 || game?.assets?.banner300 || game?.assets?.banner145;
  const image = banner || game?.assets?.boxart;

  useEffect(() => setFailed(false), [image]);

  return (
    <div className="game-artwork">
      {image && !failed ? (
        <img
          src={image}
          alt={game?.title ? `Portada de ${game.title}` : ''}
          className={banner ? 'artwork-banner' : 'artwork-cover'}
          loading={priority ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="artwork-placeholder"><Gamepad2 size={52} strokeWidth={1.5} aria-hidden="true" /></div>
      )}
    </div>
  );
}
