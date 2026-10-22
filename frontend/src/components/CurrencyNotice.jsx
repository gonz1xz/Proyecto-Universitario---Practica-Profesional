import { useCurrency } from '../context/CurrencyContext.jsx';

export function CurrencyNotice() {
  const { currency, status, exchange, retryRate } = useCurrency();
  if (currency !== 'ARS') return null;
  return (
    <div className="border-b border-text/10 bg-surface px-5 py-2 text-center text-xs leading-5 text-muted" role="status">
      {status === 'error' ? <>
        No se pudo obtener la cotización. Mostramos los precios en USD.
        <button type="button" onClick={retryRate} className="ml-2 text-primary hover:underline">Reintentar</button>
      </> : !exchange ? 'Consultando cotización. Mientras tanto, los precios se muestran en USD.' : <>
        ARS aproximados, sin impuestos ni cargos. Cotización del {new Date(exchange.updatedAt).toLocaleDateString('es-AR')}.{' '}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">Cotización de ExchangeRate-API</a>
      </>}
    </div>
  );
}
