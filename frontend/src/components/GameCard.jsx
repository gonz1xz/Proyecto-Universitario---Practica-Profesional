import { FavoriteButton } from './FavoriteButton.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { useState } from 'react';
import { ArrowRight, Gamepad2 } from 'lucide-react';

export const GameCard = ({ game, onShowPrices, onSetAlert }) => {
  const { formatPrice } = useCurrency();
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = game.assets?.boxart || game.assets?.banner300 || game.assets?.banner145;

  return (
    <article className="group overflow-hidden rounded-lg border border-text/10 bg-surface transition hover:border-text/30">
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        <FavoriteButton game={game} />
        {imageUrl && !imageFailed ? (
          <>
            <img className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl" src={imageUrl} alt="" aria-hidden="true" loading="lazy" />
            <img className="relative z-10 h-full w-full object-contain drop-shadow-xl transition duration-500 group-hover:scale-[1.03]" src={imageUrl} alt={`Portada de ${game.title}`} loading="lazy" onError={() => setImageFailed(true)} />
          </>
        ) : (
          <div className="grid h-full place-items-center text-primary"><Gamepad2 size={44} strokeWidth={1.6} aria-hidden="true" /></div>
        )}
      </div>

      <div className="p-5">
        <h3 className="min-h-12 text-base font-semibold leading-6 text-text">{game.title}</h3>
        {onSetAlert && <button type="button" onClick={() => onSetAlert(game)} className="mt-2 rounded-md border border-primary/40 px-4 py-2 text-sm text-primary hover:bg-primary/10">Avisarme de un precio</button>}
        {game.deal ? <div className="mt-3 flex items-center justify-between gap-2"><div><p className="text-lg font-semibold text-primary">{formatPrice(game.deal.price)}</p><p className="text-xs text-muted">{game.deal.shop.name}</p></div>{game.deal.cut > 0 && <span className="rounded bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">-{game.deal.cut}%</span>}</div> : <p className="mt-3 text-sm text-muted">Sin precio disponible</p>}
        <button className="mt-4 flex w-full items-center justify-between rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" type="button" onClick={() => onShowPrices(game)}>
          Comparar precios
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </article>
  );
};
