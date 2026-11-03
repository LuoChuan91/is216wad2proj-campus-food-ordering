const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/analytics.service');
const ordersRepository = require('../src/models/orders.repository');
const storesRepository = require('../src/models/stores.repository');
const profilesRepository = require('../src/models/profiles.repository');

const STORE = { id: 'store-1', merchant_id: 'mer-1', name: 'Bento Bar' };
const PROFILES = {
  'mer-1': { id: 'mer-1', role: 'merchant', status: 'active' },
  'mer-2': { id: 'mer-2', role: 'merchant', status: 'active' },
  'adm-1': { id: 'adm-1', role: 'admin', status: 'active' },
  'mer-x': { id: 'mer-x', role: 'merchant', status: 'blocked' },
};
const NOW = Date.parse('2026-11-04T12:00:00+08:00');

let orders;
let asked;
test.beforeEach(() => {
  orders = [];
  asked = null;
  storesRepository.findById = async (id) => (id === STORE.id ? STORE : null);
  profilesRepository.findById = async (id) => PROFILES[id] || null;
  ordersRepository.findForAnalytics = async (storeId, fromIso, toIso) => {
    asked = { storeId, fromIso, toIso };
    return orders;
  };
});

const order = (fields) => ({ subtotal: 10, delivery_fee: null, payments: [{ amount: 10 }], deliveries: [], ...fields });

test('defaults to the last 7 days in Singapore time, with every day filled in', async () => {
  const result = await service.getStoreAnalytics('store-1', {}, 'mer-1', NOW);
  assert.equal(result.from, '2026-10-29');
  assert.equal(result.to, '2026-11-04');
  assert.deepEqual(asked, { storeId: 'store-1', fromIso: '2026-10-28T16:00:00.000Z', toIso: '2026-11-04T16:00:00.000Z' });
  assert.equal(result.daily.length, 7);
  assert.deepEqual(result.daily[0], { date: '2026-10-29', orders: 0, earnings: 0, avg_wait_min: null });
  assert.equal(result.earnings, 0);
  assert.equal(result.orders, 0);
  assert.equal(result.avg_wait_min, null);
});

test('groups orders by Singapore date, so 7am SGT is not counted on the previous day', async () => {
  orders = [
    order({ created_at: '2026-11-02T23:30:00Z' }),
    order({ created_at: '2026-11-03T01:00:00Z' }),
  ];
  const result = await service.getStoreAnalytics('store-1', { from: '2026-11-02', to: '2026-11-03' }, 'mer-1', NOW);
  assert.deepEqual(result.daily.map((d) => [d.date, d.orders]), [['2026-11-02', 0], ['2026-11-03', 2]]);
});

test('earnings are what the student paid minus the delivery fee, so discounts are already taken off', async () => {
  orders = [
    order({ created_at: '2026-11-04T02:00:00Z', subtotal: 10, payments: [{ amount: 9 }] }),
    order({ created_at: '2026-11-04T03:00:00Z', subtotal: 5, delivery_fee: 0.8, payments: [{ amount: 5.3 }], deliveries: [{ status: 'delivered', fee: 0.8 }] }),
    order({ created_at: '2026-11-04T04:00:00Z', subtotal: 6, delivery_fee: 0.8, payments: [{ amount: 6.8 }], deliveries: [{ status: 'expired', fee: 0.8 }] }),
  ];
  const result = await service.getStoreAnalytics('store-1', { from: '2026-11-04', to: '2026-11-04' }, 'mer-1', NOW);
  assert.equal(result.earnings, 19.5);
  assert.equal(result.orders, 3);
  assert.equal(result.daily[0].earnings, 19.5);
});

test('average wait is paid to ready, ignoring orders that are not ready yet', async () => {
  orders = [
    order({ created_at: '2026-11-03T02:00:00Z', paid_at: '2026-11-03T02:00:00Z', ready_at: '2026-11-03T02:06:00Z' }),
    order({ created_at: '2026-11-04T02:00:00Z', paid_at: '2026-11-04T02:00:00Z', ready_at: '2026-11-04T02:10:00Z' }),
    order({ created_at: '2026-11-04T03:00:00Z', paid_at: '2026-11-04T03:00:00Z', ready_at: null }),
  ];
  const result = await service.getStoreAnalytics('store-1', { from: '2026-11-03', to: '2026-11-04' }, 'mer-1', NOW);
  assert.equal(result.avg_wait_min, 8);
  assert.deepEqual(result.daily.map((d) => d.avg_wait_min), [6, 10]);
});

test('an admin can see any store', async () => {
  const result = await service.getStoreAnalytics('store-1', {}, 'adm-1', NOW);
  assert.equal(result.store_id, 'store-1');
});

test("403 for another merchant's store", async () => {
  await assert.rejects(service.getStoreAnalytics('store-1', {}, 'mer-2', NOW), (err) => err.status === 403);
});

test('401 when not signed in, or the account is not active', async () => {
  await assert.rejects(service.getStoreAnalytics('store-1', {}, undefined, NOW), (err) => err.status === 401);
  await assert.rejects(service.getStoreAnalytics('store-1', {}, 'mer-x', NOW), (err) => err.status === 401);
});

test('404 when the store does not exist', async () => {
  await assert.rejects(service.getStoreAnalytics('nope', {}, 'mer-1', NOW), (err) => err.status === 404);
});

test('400 for a bad date, a backwards range, or a range over a year', async () => {
  await assert.rejects(service.getStoreAnalytics('store-1', { from: '04/11/2026' }, 'mer-1', NOW), (err) => err.status === 400);
  await assert.rejects(service.getStoreAnalytics('store-1', { from: '2026-02-30', to: '2026-03-01' }, 'mer-1', NOW), (err) => err.status === 400);
  await assert.rejects(service.getStoreAnalytics('store-1', { from: '2026-11-05', to: '2026-11-04' }, 'mer-1', NOW), (err) => err.status === 400);
  await assert.rejects(service.getStoreAnalytics('store-1', { from: '2025-01-01', to: '2026-11-04' }, 'mer-1', NOW), (err) => err.status === 400);
});
