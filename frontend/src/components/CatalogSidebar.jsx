export const CatalogSidebar = ({ filters, onChange, onApply, onReset }) => {
  const fieldClass = 'mt-2 w-full rounded-md border border-text/15 bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15';
  return (
    <aside className="self-start rounded-lg border border-text/10 bg-surface p-5 lg:sticky lg:top-40">
      <form onSubmit={(event) => { event.preventDefault(); onApply(); }} className="grid gap-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Filtros</h2><button type="button" onClick={onReset} className="text-xs text-primary hover:underline">Limpiar</button></div>
        <label className="text-sm font-medium">Ordenar por<select className={fieldClass} value={filters.sort} onChange={(event) => onChange('sort', event.target.value)}><option value="-cut">Mayor descuento</option><option value="price">Menor precio</option><option value="-price">Mayor precio</option></select></label>
        <label className="text-sm font-medium">Tienda<select className={fieldClass} value={filters.shop} onChange={(event) => onChange('shop', event.target.value)}><option value="">Todas las tiendas</option><option value="61">Steam</option><option value="35">GOG</option><option value="16">Epic Games Store</option></select></label>
        <label className="text-sm font-medium">Precio máximo (USD)<input className={fieldClass} type="number" min="0" step="0.01" placeholder="Sin límite" value={filters.maxPrice} onChange={(event) => onChange('maxPrice', event.target.value)} /></label>
        <label className="text-sm font-medium">Descuento mínimo<select className={fieldClass} value={filters.minDiscount} onChange={(event) => onChange('minDiscount', event.target.value)}><option value="0">Cualquier precio</option><option value="1">Solo con descuento</option><option value="25">25% o más</option><option value="50">50% o más</option><option value="75">75% o más</option></select></label>
        <button type="submit" className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-background hover:bg-primary/90">Aplicar filtros</button>
        <p className="text-xs leading-5 text-muted">Precios para la región US, en dólares estadounidenses.</p>
      </form>
    </aside>
  );
};
