import { createContext, useContext, useEffect, useState } from 'react';
import { getUsdArsRate } from '../services/currencyApi.js';
import { formatDisplayPrice } from '../services/priceFormatter.js';

const CurrencyContext = createContext(null);
const CURRENCY_KEY = 'auraprices_display_currency';

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    try { return localStorage.getItem(CURRENCY_KEY) === 'ARS' ? 'ARS' : 'USD'; }
    catch { return 'USD'; }
  });
  const [exchange, setExchange] = useState(null);
  const [status, setStatus] = useState('idle');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(CURRENCY_KEY, currency); } catch { /* Preferencia opcional. */ }
    if (currency !== 'ARS') return;
    let active = true;
    setExchange(null);
    setStatus('loading');
    getUsdArsRate()
      .then(data => { if (active) { setExchange(data); setStatus('success'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [currency, retry]);

  function changeCurrency(value) {
    if (value === 'USD' || value === 'ARS') setCurrency(value);
  }
  function formatPrice(price) {
    return formatDisplayPrice(price, currency, exchange?.rate);
  }
  return <CurrencyContext.Provider value={{ currency, changeCurrency, exchange, status, formatPrice, retryRate: () => setRetry(current => current + 1) }}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => useContext(CurrencyContext);
