import { useEffect, useState } from 'react';
import { ArrowUpRight, ImageOff } from 'lucide-react';
import { getGameDetails } from '../services/gamesApi.js';
import { GameArtwork } from './GameArtwork.jsx';
import { Modal } from './Modal.jsx';

function Screenshot({ src, title, number }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className="screenshot-missing"><ImageOff size={24} aria-hidden="true" /><span>No se pudo cargar esta imagen.</span></div>
    : <img src={src} alt={`Captura ${number} de ${title}`} loading="lazy" onError={() => setFailed(true)} />;
}

export function GameInfoModal({ game, onClose }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    getGameDetails(game.id, controller.signal)
      .then(result => { if (!controller.signal.aborted) { setData(result); setStatus('success'); } })
      .catch(error => { if (!controller.signal.aborted) { setError(error.message); setStatus('error'); } });
    return () => controller.abort();
  }, [game.id, retry]);

  return (
    <Modal title={data?.title || game.title} onClose={onClose}>
      <div className="game-info-art"><GameArtwork game={data || game} priority /></div>
      <div className="game-info-copy" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' && <p className="text-sm text-muted" role="status">Cargando información del juego...</p>}
        {status === 'error' && <div><p role="alert" className="text-sm text-primary">{error}</p><button type="button" onClick={() => setRetry(current => current + 1)} className="mt-3 text-sm text-primary underline">Reintentar</button></div>}
        {status === 'success' && <>
          {data.developers.length > 0 && <p className="mb-4 text-xs text-muted">Desarrollado por {data.developers.join(', ')}</p>}
          <h3 className="text-xl font-semibold">Sobre el juego</h3>
          <p className="game-description">{data.description || 'No hay una descripción disponible para este juego.'}</p>
          {data.mediaUnavailable && <p className="mt-3 text-sm leading-6 text-muted">No pudimos consultar la descripción y las capturas de Steam. <button type="button" onClick={() => setRetry(current => current + 1)} className="text-primary underline">Reintentar</button></p>}
          {data.screenshots.length > 0 && <section className="mt-7" aria-label="Capturas del juego">
            <h3 className="mb-4 text-lg font-semibold">Así se ve</h3>
            <div className="game-screenshots">{data.screenshots.map((src, index) => <Screenshot key={src} src={src} title={data.title} number={index + 1} />)}</div>
          </section>}
          <div className="game-info-source">
            <p>Ficha de IsThereAnyDeal. Descripción y capturas de Steam cuando están disponibles.</p>
            {data.steamUrl && <a href={data.steamUrl} target="_blank" rel="noreferrer" className="card-link">Ver ficha en Steam <ArrowUpRight size={16} aria-hidden="true" /></a>}
          </div>
        </>}
      </div>
    </Modal>
  );
}
