import { useCurrency } from '../context/CurrencyContext.jsx';

export function CurrencySelector() {
  const { currency, changeCurrency } = useCurrency();
  return (
    <select aria-label="Moneda de visualización" value={currency} onChange={event => changeCurrency(event.target.value)} className="min-h-8 rounded-md border border-text/15 bg-surface px-2 text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
      <option value="USD">USD</option>
      <option value="ARS">ARS</option>
    </select>
  );
}
