import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { priceSeries, chartGeometry } from '../services/priceChart.js';
import { formatDisplayPrice } from '../services/priceFormatter.js';

const money = amount => formatDisplayPrice({ amount, currency: 'USD' });
const shortDate = value => new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
const fullDate = value => new Date(value).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });

export function PriceHistoryChart({ records }) {
  const selectId = useId();
  const stores = useMemo(() => [...new Map(records.map(record => [record.store.id, record.store])).values()]
    .sort((a, b) => a.name.localeCompare(b.name)), [records]);
  const [storeId, setStoreId] = useState('');
  const selected = stores.find(store => store.id === storeId) || stores[0];
  const points = useMemo(() => selected ? priceSeries(records, selected.id) : [], [records, selected?.id]);
  if (!selected || !points.length) return null;
  return <div className="price-chart">
    <div className="price-chart-heading">
      <h4>Evolución del precio</h4>
      <label htmlFor={selectId}>Tienda<select id={selectId} value={selected.id} onChange={event => setStoreId(event.target.value)}>
        {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
      </select></label>
    </div>
    <ChartSeries key={selected.id} points={points} storeName={selected.name} />
    <p className="price-chart-note">Cambios registrados en esta tienda, en USD. La línea une observaciones; no garantiza disponibilidad continua. Usá el control inferior para recorrer las fechas con el teclado.</p>
  </div>;
}

function ChartSeries({ points, storeName }) {
  const id = useId();
  const containerRef = useRef(null);
  const [width, setWidth] = useState(580);
  const [index, setIndex] = useState(points.length - 1);
  const point = points[Math.min(index, points.length - 1)];
  const geometry = useMemo(() => chartGeometry(points, width), [points, width]);
  const { left, right, top, bottom, maxPrice, x, y, path } = geometry;
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
  }
  const dateTicks = points.length === 1 ? [points[0].time]
    : width > 450 ? [points[0].time, (points[0].time + points.at(-1).time) / 2, points.at(-1).time]
      : [points[0].time, points.at(-1).time];
  return <div ref={containerRef}>
    <div className="price-chart-reading" aria-live="polite">
      <strong>{money(point.price)}</strong><span>{fullDate(point.recordedAt)}</span>
    </div>
    <svg viewBox={`0 0 ${width} 250`} role="img" aria-labelledby={`${id}-title ${id}-description`} onPointerMove={inspect}>
      <title id={`${id}-title`}>Precio de {storeName} a lo largo del tiempo</title>
      <desc id={`${id}-description`}>{points.length} observaciones en USD entre {fullDate(points[0].recordedAt)} y {fullDate(points.at(-1).recordedAt)}. El detalle también está disponible en la tabla.</desc>
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
      <line x1={x(point.time)} x2={x(point.time)} y1={top} y2={bottom} className="price-chart-cursor" />
      <circle cx={x(point.time)} cy={y(point.price)} r="5" className="price-chart-point" />
    </svg>
    <label className="sr-only" htmlFor={`${id}-date`}>Fecha del precio de {storeName}</label>
    <input id={`${id}-date`} className="price-chart-range" type="range" min="0" max={points.length - 1} step="1" value={Math.min(index, points.length - 1)} disabled={points.length === 1}
      aria-valuetext={`${fullDate(point.recordedAt)}, ${money(point.price)}`} onChange={event => setIndex(Number(event.target.value))} />
    {points.length === 1 && <p className="price-chart-note">Hay una sola observación para esta tienda en el período.</p>}
  </div>;
}
