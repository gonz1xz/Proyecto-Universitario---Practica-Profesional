import prisma from '../prisma.js';

// Si hay varias ofertas de una tienda, conservamos la más barata en USD.
export function selectHistoryDeals(deals) {
  const stores = new Map();
  for (const deal of Array.isArray(deals) ? deals : []) {
    const amount = deal?.price?.amount;
    const shop = deal?.shop;
    if (deal?.price?.currency !== 'USD' || !Number.isFinite(amount) ||
        amount < 0 || amount > 9999999999.99 ||
        !Number.isSafeInteger(shop?.id) || shop.id < 1 ||
        typeof shop.name !== 'string' || !shop.name.trim()) continue;

    const price = Math.round(amount * 100) / 100;
    const previous = stores.get(shop.id);
    if (!previous || price < previous.price) {
      stores.set(shop.id, { storeId: String(shop.id), name: shop.name.trim().slice(0, 200), price });
    }
  }
  return [...stores.values()];
}

export async function recordPriceHistory(itadGameId, deals) {
  const selected = selectHistoryDeals(deals);
  if (!selected.length) return;

  // Serializable evita duplicados si dos consultas intentan guardar lo mismo a la vez.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async tx => {
        const game = await tx.game.upsert({ where: { itadGameId }, create: { itadGameId }, update: {} });
        for (const deal of selected) {
          const store = await tx.store.upsert({
            where: { itadStoreId: deal.storeId },
            create: { itadStoreId: deal.storeId, name: deal.name },
            update: { name: deal.name },
          });
          const previous = await tx.priceRecord.findFirst({
            where: { gameId: game.id, storeId: store.id, currency: 'USD' },
            orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
          });
          if (!previous || Number(previous.price) !== deal.price) {
            await tx.priceRecord.create({ data: { gameId: game.id, storeId: store.id, price: deal.price, currency: 'USD' } });
          }
        }
      }, { isolationLevel: 'Serializable' });
      return;
    } catch (error) {
      if (!['P2034', 'P2002'].includes(error.code) || attempt === 2) throw error;
    }
  }
}

// Un problema al guardar el historial no debe impedir comparar ni recibir avisos.
export async function tryRecordPriceHistory(itadGameId, deals) {
  try {
    await recordPriceHistory(itadGameId, deals);
    return true;
  } catch {
    console.error('No se pudo guardar el historial de precios. Se reintentará en la próxima consulta.');
    return false;
  }
}
