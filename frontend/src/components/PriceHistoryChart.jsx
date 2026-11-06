import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { priceSeries, chartGeometry } from '../services/priceChart.js';
import { formatDisplayPrice } from '../services/priceFormatter.js';

const money = amount => formatDisplayPrice({ amount, currency: 'USD' });
const shortDate = value => new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
const fullDate = value => new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

export function PriceHistoryChart({ records, periodStart, periodEnd }) {
  const selectId = useId();
  const stores = useMemo(() => [...new Map(records.map(record => [record.store.id, record.store])).values()]
    .sort((a, b) => a.name.localeCompare(b.name)), [records]);
  const [storeId, setStoreId] = useState('');
  const selected = stores.find(store => store.id === storeId) || stores[0];
  const points = useMemo(() => selected ? priceSeries(records, selected.id) : [], [records, selected?.id]);
  if (!selected || !points.length) return null;
  return <div className="price-chart">
    <div className="price-chart-heading">
      <h4>Evolución del precio · Último mes</h4>
      <label htmlFor={selectId}>Tienda<select id={selectId} value={selected.id} onChange={event => setStoreId(event.target.value)}>
        {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
      </select></label>
    </div>
    <ChartSeries key={selected.id} points={points} storeName={selected.name} periodStart={periodStart} periodEnd={periodEnd} />
    <p className="price-chart-note">Pasá el cursor o tocá un punto para ver su fecha y precio. Con el teclado, enfocá el gráfico y usá las flechas. La línea une observaciones de esta tienda; no garantiza disponibilidad continua.</p>
  </div>;
}

function ChartSeries({ points, storeName, periodStart, periodEnd }) {
  const id = useId();
  const containerRef = useRef(null);
  const [width, setWidth] = useState(580);
  const [index, setIndex] = useState(points.length - 1);
  const [inspecting, setInspecting] = useState(false);
  const point = points[Math.min(index, points.length - 1)];
  const geometry = useMemo(() => chartGeometry(points, width, 250, { startTime: Date.parse(periodStart), endTime: Date.parse(periodEnd) }), [points, width, periodStart, periodEnd]);
  const { left, right, top, bottom, maxPrice, firstTime, lastTime, x, y, path } = geometry;
  useEffect(() => {
    const observer = new ResizeObserver(entries => setWidth(Math.max(260, entries[0].contentRect.width)));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  function inspect(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width * width;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].time) - position) < Math.abs(x(points[nearest].time) - position)) nearest = i;
    }
    setIndex(nearest);
    setInspecting(true);
  }
  function inspectWithKeyboard(event) {
    const current = Math.min(index, points.length - 1);
    const next = { ArrowRight: current + 1, ArrowUp: current + 1, ArrowLeft: current - 1, ArrowDown: current - 1, Home: 0, End: points.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setIndex(Math.max(0, Math.min(points.length - 1, next)));
    setInspecting(true);
  }
  const tooltipWidth = Math.min(236, width - 16);
  const tooltipX = Math.max(8, Math.min(width - tooltipWidth - 8,
    x(point.time) > width / 2 ? x(point.time) - tooltipWidth - 12 : x(point.time) + 12));
  const tooltipY = y(point.price) < 100 ? y(point.price) + 16 : y(point.price) - 82;
  const dateTicks = firstTime === lastTime ? [firstTime]
    : Array.from({ length: width > 450 ? 5 : 3 }, (_, tick) => firstTime + (lastTime - firstTime) * tick / (width > 450 ? 4 : 2));
  return <div ref={containerRef}>
    <div className="price-chart-legend"><span aria-hidden="true" />Precio en USD</div>
    <div className="price-chart-plot">
    <svg viewBox={`0 0 ${width} 250`} role="slider" tabIndex={0}
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      aria-valuemin={0} aria-valuemax={points.length - 1} aria-valuenow={Math.min(index, points.length - 1)}
      aria-valuetext={`${fullDate(point.recordedAt)}, ${money(point.price)}`}
      onPointerMove={inspect} onPointerDown={event => { event.currentTarget.focus(); inspect(event); }}
      onPointerLeave={event => { if (event.pointerType !== 'touch' && document.activeElement !== event.currentTarget) setInspecting(false); }}
      onFocus={() => setInspecting(true)} onBlur={() => setInspecting(false)} onKeyDown={inspectWithKeyboard}>
      <title id={`${id}-title`}>Precio de {storeName} a lo largo del tiempo</title>
      <desc id={`${id}-description`}>{points.length} observaciones en USD entre {fullDate(points[0].recordedAt)} y {fullDate(points.at(-1).recordedAt)}. Usá las flechas para recorrer los puntos, Inicio para el primero y Fin para el último. El detalle también está disponible en la tabla.</desc>
      {[0, 1, 2, 3, 4].map(tick => {
        const price = maxPrice * tick / 4;
        return <g key={tick} className="price-chart-grid">
          <line x1={left} x2={right} y1={y(price)} y2={y(price)} />
          <text x={left - 10} y={y(price) + 4} textAnchor="end">{price.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</text>
        </g>;
      })}
      <text x={left - 10} y={top - 7} textAnchor="end" className="price-chart-axis">USD</text>
      {dateTicks.map((time, tick) => <text key={tick} x={x(time)} y={bottom + 25} textAnchor={tick === 0 && dateTicks.length > 1 ? 'start' : tick === dateTicks.length - 1 && dateTicks.length > 1 ? 'end' : 'middle'} className="price-chart-axis">{shortDate(time)}</text>)}
      <path d={path} className="price-chart-line" />
      {points.map((item, pointIndex) => <circle key={item.id || `${item.time}:${pointIndex}`} cx={x(item.time)} cy={y(item.price)} r={inspecting && pointIndex === Math.min(index, points.length - 1) ? 5.5 : 3.2} className="price-chart-point" />)}
    </svg>
    {inspecting && <div className="price-chart-tooltip" aria-hidden="true" style={{ left: `${tooltipX / width * 100}%`, top: `${tooltipY / 250 * 100}%`, width: `${tooltipWidth / width * 100}%` }}>
      <time dateTime={point.recordedAt}>{fullDate(point.recordedAt)}</time>
      <strong><span aria-hidden="true" />{money(point.price)}</strong>
    </div>}
    </div>
    {points.length === 1 && <p className="price-chart-note">Hay una sola observación para esta tienda en el período.</p>}
  </div>;
}
