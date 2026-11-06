// Una serie por tienda: nunca mezclar cambios de comercios distintos.
export function priceSeries(records, storeId) {
  return records.filter(record => record.store?.id === storeId &&
    Number.isFinite(record.price) && record.price >= 0 && Number.isFinite(Date.parse(record.recordedAt)))
    .map(record => ({ ...record, time: Date.parse(record.recordedAt) }))
    .sort((a, b) => a.time - b.time);
}

export function chartGeometry(points, width, height = 250, period = {}) {
  const left = 58, right = width - 16, top = 18, bottom = height - 34;
  const firstTime = Number.isFinite(period.startTime) ? Math.min(period.startTime, points[0].time) : points[0].time;
  const lastTime = Number.isFinite(period.endTime) ? Math.max(period.endTime, points.at(-1).time) : points.at(-1).time;
  const highest = points.reduce((max, point) => Math.max(max, point.price), 0);
  const maxPrice = Math.max(1, Math.ceil(highest * 1.1));
  const x = time => lastTime === firstTime ? (left + right) / 2 : left + (time - firstTime) / (lastTime - firstTime) * (right - left);
  const y = price => bottom - price / maxPrice * (bottom - top);
  const path = points.map((point, index) => index === 0
    ? `M ${x(point.time)} ${y(point.price)}`
    : `L ${x(point.time)} ${y(point.price)}`).join(' ');
  return { left, right, top, bottom, maxPrice, firstTime, lastTime, x, y, path };
}
