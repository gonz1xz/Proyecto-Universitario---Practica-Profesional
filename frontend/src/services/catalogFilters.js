export const defaultFilters = { sort: '-cut', shop: '', maxPrice: '', minDiscount: '0' };

// Selecciona la mejor oferta que cumpla los filtros, antes de ordenar los juegos.
export const filterSearchGames = (games, filters) => {
  const visible = games.map((game) => {
    const deals = (game.deals || []).filter((deal) =>
      (!filters.shop || String(deal.shop.id) === filters.shop) &&
      (filters.maxPrice === '' || deal.price.amount <= Number(filters.maxPrice)) &&
      deal.cut >= Number(filters.minDiscount)
    );
    const deal = deals.reduce((best, current) => !best || current.price.amount < best.price.amount ? current : best, null);
    return { ...game, deal };
  }).filter((game) => game.deal || (!filters.shop && filters.maxPrice === '' && Number(filters.minDiscount) === 0));
  return visible.sort((a, b) => {
    if (!a.deal) return b.deal ? 1 : a.title.localeCompare(b.title);
    if (!b.deal) return -1;
    if (filters.sort === 'price') return a.deal.price.amount - b.deal.price.amount;
    if (filters.sort === '-price') return b.deal.price.amount - a.deal.price.amount;
    return b.deal.cut - a.deal.cut;
  });
};
