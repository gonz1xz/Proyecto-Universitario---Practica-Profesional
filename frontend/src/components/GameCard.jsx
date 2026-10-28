import { FavoriteButton } from './FavoriteButton.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { ArrowRight, Bell } from 'lucide-react';
import { GameArtwork } from './GameArtwork.jsx';

export const GameCard = ({ game, onShowPrices, onSetAlert }) => {
  const { formatPrice } = useCurrency();

  return (
    <article className="game-card">
      <div className="relative">
        <GameArtwork game={game} />
        <FavoriteButton game={game} />
        {game.deal?.cut > 0 && <span className="discount-badge">−{game.deal.cut}%</span>}
      </div>

      <div className="game-card-body">
        <h3 className="game-card-title">{game.title}</h3>
        {game.deal ? (
          <div className="game-price-row">
            <div>
              <p className="price-caption">Precio encontrado</p>
              <p className="game-price">{formatPrice(game.deal.price)}</p>
            </div>
            <span className="store-name">{game.deal.shop.name}</span>
          </div>
        ) : <p className="my-4 text-sm text-muted">Sin precio disponible</p>}
        <button className="button button-primary w-full justify-between" type="button" onClick={() => onShowPrices(game)}>
          Comparar precios <ArrowRight size={17} aria-hidden="true" />
        </button>
        {onSetAlert && (
          <button type="button" onClick={() => onSetAlert(game)} className="alert-button">
            <Bell size={15} aria-hidden="true" /> Avisarme de un precio
          </button>
        )}
      </div>
    </article>
  );
};
