import test from 'node:test';
import assert from 'node:assert/strict';
import { priceSeries, chartGeometry } from '../../frontend/src/services/priceChart.js';

test('gráfico: separa tiendas, ordena fechas y conserva precios cero', () => {
  const records = [
    { store: { id: '1' }, price: 8, recordedAt: '2026-11-02T12:00:00Z' },
    { store: { id: '2' }, price: 99, recordedAt: '2026-11-01T12:00:00Z' },
    { store: { id: '1' }, price: 0, recordedAt: '2026-11-01T12:00:00Z' },
    { store: { id: '1' }, price: 3, recordedAt: 'inválida' },
  ];
  const points = priceSeries(records, '1');
  assert.deepEqual(points.map(point => point.price), [0, 8]);
  const chart = chartGeometry(points, 280);
  assert.equal(chart.y(0), chart.bottom);
  assert.equal(chart.x(points[0].time), chart.left);
  assert.equal(chart.x(points.at(-1).time), chart.right);
  assert.ok(chart.y(8) >= chart.top);
  assert.doesNotMatch(chart.path, /NaN|Infinity/);
  assert.deepEqual(priceSeries(records, '3'), []);
});

test('gráfico: una observación o varias simultáneas no dividen por cero', () => {
  const points = priceSeries([{ store: { id: '1' }, price: 0, recordedAt: '2026-11-01T12:00:00Z' }], '1');
  const chart = chartGeometry(points, 580);
  assert.equal(chart.x(points[0].time), (chart.left + chart.right) / 2);
  assert.doesNotMatch(chart.path, /NaN|Infinity/);
});
