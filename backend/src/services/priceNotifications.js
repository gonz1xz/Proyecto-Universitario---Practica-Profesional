import prisma from '../prisma.js';
import { tryRecordPriceHistory } from './priceHistory.js';

// Se consideran únicamente importes USD válidos; cero incluye los regalos.
export function selectDeals(deals) {
  const valid = deals.filter(deal => deal.price?.currency === 'USD' && Number.isFinite(deal.price.amount) && deal.price.amount >= 0 && deal.price.amount <= 9999999999.99 && deal.shop?.name);
  return {
    cheapest: valid.reduce((best, deal) => !best || deal.price.amount < best.price.amount ? deal : best, null),
    sale: valid.filter(deal => deal.cut > 0).reduce((best, deal) => !best || deal.price.amount < best.price.amount ? deal : best, null),
  };
}

async function itad(path, ids) {
  const url = new URL('https://api.isthereanydeal.com' + path);
  if (ids) url.searchParams.set('country', 'US');
  const response = await fetch(url, { headers: { 'ITAD-API-Key': process.env.ITAD_API_KEY, 'Content-Type': 'application/json' }, ...(ids ? { method: 'POST', body: JSON.stringify(ids) } : {}), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('No se pudieron consultar las ofertas para notificaciones.');
  return response.json();
}

let running = false;
export async function checkPriceNotifications() {
  if (running || !process.env.ITAD_API_KEY) return;
  running = true;
  try {
    const games = await prisma.game.findMany({ where: { favorites: { some: {} } }, include: { favorites: true, priceAlerts: true } });
    for (let offset = 0; offset < games.length; offset += 100) {
      const batch = games.slice(offset, offset + 100);
      const prices = await itad('/games/prices/v3', batch.map(game => game.itadGameId));
      if (!Array.isArray(prices)) throw new Error('La respuesta de precios no es válida.');
      for (const game of batch) {
        const item = prices.find(item => item.id === game.itadGameId);
        // Una respuesta incompleta no se interpreta como una oferta terminada.
        if (!Array.isArray(item?.deals)) continue;
        await tryRecordPriceHistory(game.itadGameId, item.deals);
        const { cheapest, sale } = selectDeals(item.deals);
        let gameTitle;
        for (const favorite of game.favorites) {
          const alert = game.priceAlerts.find(alert => alert.userId === favorite.userId && alert.isActive && alert.currency === 'USD');
          const targetReached = alert && cheapest && cheapest.price.amount <= Number(alert.targetPrice);
          const events = [];
          if (sale && !favorite.saleNotified) events.push({ type: 'sale', deal: sale });
          if (targetReached && !alert.notified) events.push({ type: 'target', deal: cheapest });
          if (events.length && !gameTitle) {
            const info = await itad('/games/info/v2?id=' + encodeURIComponent(game.itadGameId));
            if (typeof info.title !== 'string' || info.id !== game.itadGameId) throw new Error('No se pudo identificar el juego de la notificación.');
            gameTitle = info.title;
          }
          await prisma.$transaction(async tx => {
            // Volver a comprobar el favorito evita avisar por un juego quitado durante la consulta.
            if (!await tx.favorite.findUnique({ where: { id: favorite.id } })) return;
            if (!sale) await tx.favorite.updateMany({ where: { id: favorite.id }, data: { saleNotified: false } });
            if (alert && cheapest && !targetReached) await tx.priceAlert.updateMany({ where: { id: alert.id, targetPrice: alert.targetPrice }, data: { notified: false } });
            for (const event of events) {
              const updated = event.type === 'sale'
                ? await tx.favorite.updateMany({ where: { id: favorite.id, saleNotified: false }, data: { saleNotified: true } })
                : await tx.priceAlert.updateMany({ where: { id: alert.id, isActive: true, notified: false, targetPrice: alert.targetPrice }, data: { notified: true } });
              if (updated.count) await tx.notification.create({ data: { userId: favorite.userId, itadGameId: game.itadGameId, gameTitle, type: event.type, price: event.deal.price.amount, currency: 'USD', storeName: event.deal.shop.name } });
            }
          });
        }
      }
    }
  } finally { running = false; }
}

export function startPriceNotifications() {
  const run = () => checkPriceNotifications().catch(() => console.error('No se pudieron revisar las ofertas. Se reintentará en la próxima revisión.'));
  void run();
  const timer = setInterval(run, 30 * 60 * 1000);
  timer.unref();
  return timer;
}
