export const CatalogSidebar = ({ filters, onChange, onApply, onReset, isSearch = false }) => {
  const fieldClass = 'filter-field';
  return (
    <aside className="catalog-sidebar">
      <form onSubmit={(event) => { event.preventDefault(); onApply(); }} className="grid gap-5">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Filtros</h2><button type="button" onClick={onReset} className="text-xs text-primary hover:underline">Limpiar</button></div>
        <label className="text-sm font-medium">Ordenar por<select className={fieldClass} value={filters.sort} onChange={(event) => onChange('sort', event.target.value)}><option value="-cut">Mayor descuento</option><option value="price">Menor precio</option><option value="-price">Mayor precio</option>{!isSearch && <><option value="popular">Más populares en ITAD</option><option value="waitlisted">Más deseados en ITAD</option><option value="collected">Más presentes en colecciones</option></>}</select></label>
        <label className="text-sm font-medium">Tienda<select className={fieldClass} value={filters.shop} onChange={(event) => onChange('shop', event.target.value)}><option value="">Todas las tiendas</option><option value="61">Steam</option><option value="35">GOG</option><option value="16">Epic Games Store</option></select></label>
        <label className="text-sm font-medium">Precio máximo (USD)<input className={fieldClass} type="number" min="0" step="0.01" placeholder="Sin límite" value={filters.maxPrice} onChange={(event) => onChange('maxPrice', event.target.value)} /></label>
        <label className="text-sm font-medium">Descuento mínimo<select className={fieldClass} value={filters.minDiscount} onChange={(event) => onChange('minDiscount', event.target.value)}><option value="0">Cualquier precio</option><option value="1">Solo con descuento</option><option value="25">25% o más</option><option value="50">50% o más</option><option value="75">75% o más</option></select></label>
        <button type="submit" className="button button-primary justify-center">Aplicar filtros</button>
        <p className="text-xs leading-5 text-muted">Precios originales de la región US. El precio máximo se ingresa siempre en USD, aunque elijas mostrar ARS.</p>
      </form>
    </aside>
  );
};
