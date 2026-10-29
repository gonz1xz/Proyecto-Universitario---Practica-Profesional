import { FavoriteButton } from './FavoriteButton.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { ArrowRight, Bell, Info } from 'lucide-react';
import { GameArtwork } from './GameArtwork.jsx';

export const GameCard = ({ game, onShowPrices, onShowInfo, onSetAlert, favoriteSelected, onToggleFavorite, favoriteDisabled = false }) => {
  const { formatPrice } = useCurrency();

  return (
    <article className={`game-card ${onToggleFavorite && !favoriteSelected ? 'game-card-selected' : ''}`}>
      <div className="relative">
        <GameArtwork game={game} />
        <FavoriteButton game={game} selected={favoriteSelected} onToggle={onToggleFavorite} disabled={favoriteDisabled} />
        {Number.isInteger(game.position) && <span className="ranking-badge ranking-badge-top" aria-label={`Puesto ${game.position} en este ranking de ITAD`}>#{game.position}</span>}
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
        {onShowInfo && <button type="button" onClick={() => onShowInfo(game)} className="game-info-button"><Info size={16} aria-hidden="true" />Sobre el juego</button>}
        {onSetAlert && (
          <button type="button" onClick={() => onSetAlert(game)} className="alert-button">
            <Bell size={15} aria-hidden="true" /> Avisarme de un precio
          </button>
        )}
      </div>
    </article>
  );
};
