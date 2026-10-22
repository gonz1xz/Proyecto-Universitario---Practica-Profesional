// La conversión solo cambia el texto: nunca modifica el precio recibido de ITAD.
export function formatDisplayPrice(price, currency = 'USD', rate = null) {
  if (!price || !Number.isFinite(price.amount)) return 'Precio no informado';
  if (price.currency !== 'USD') return 'Precio no disponible en USD';
  const converted = currency === 'ARS' && Number.isFinite(rate) && rate > 0;
  const amount = converted ? price.amount * rate : price.amount;
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: converted ? 'ARS' : 'USD', currencyDisplay: 'code',
  }).format(amount);
  return converted ? '≈ ' + formatted : formatted;
}
