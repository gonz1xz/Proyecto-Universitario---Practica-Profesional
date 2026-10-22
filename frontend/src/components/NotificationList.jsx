import { Link } from 'react-router-dom';
export function NotificationList({ notifications, onNavigate }) {
return <ul className="mt-4 space-y-3">{notifications.map(item => <li key={item.id} className={'rounded-md border p-4 ' + (item.readAt ? 'border-text/10' : 'border-primary/50 bg-primary/5')}>
        <p className="font-semibold">{item.gameTitle}</p><p className="mt-1 text-sm">{item.type === 'target' ? '¡Alcanzó tu precio objetivo!' : '¡Está en oferta!'} USD {Number(item.price).toFixed(2)} en {item.storeName}.</p><p className="mt-2 text-xs text-muted">{new Date(item.createdAt).toLocaleString('es-AR')} · Precio detectado en ese momento.</p><Link to="/mis-favoritos" onClick={onNavigate} className="mt-2 inline-block text-sm text-primary underline">Ver favoritos y comparar precios</Link>
      </li>)}</ul>;
}
