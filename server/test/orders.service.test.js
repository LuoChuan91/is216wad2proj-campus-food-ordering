// Unit tests for src/services/orders.service.js: the order rules, and the merchant order list.
// Run from the server folder:  pnpm test
// The repositories are swapped for fake ones, so these tests never touch Supabase.
// The fake data has the same shape as the live database (see "Database notes" in the README).
const test = require('node:test');
const assert = require('node:assert/strict');

// supabase.js needs these to load; the fake repositories mean they're never used
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/orders.service');
const ordersRepository = require('../src/models/orders.repository');
const menuRepository = require('../src/models/menu.repository');
const storesRepository = require('../src/models/stores.repository');
const profilesRepository = require('../src/models/profiles.repository');
const venuesRepository = require('../src/models/venues.repository');

/* ---------- fake data (shaped like the real tables) ---------- */

// stores: discount_type is 'percentage', 'dollar' or null
const STORE = {
  id: 'store-1', name: 'Sakura Bento House', is_open: true,
  discount_type: 'percentage', discount_per: 10, discount_dol: null,
};

// What menuRepository.findItemWithOptions returns: the dish, its store_id
// (looked up through menu_category), and its option groups with their options
const BENTO = {
  id: 'item-bento', store_id: 'store-1', name: 'Chicken Teriyaki Bento', price: 5, available: true, is_archived: false,
  option_groups: [
    {
      id: 'g-rice', name: 'Rice', type: 'single', required: true, min_select: 1, max_select: 1,
      options: [
        { id: 'rice-white', name: 'White rice', price_delta: 0, available: true },
        { id: 'rice-brown', name: 'Brown rice', price_delta: 0, available: true },
      ],
    },
    {
      id: 'g-sides', name: 'Sides', type: 'multi', required: true, min_select: 3, max_select: 6,
      options: [
        { id: 'side-karaage', name: 'Karaage', price_delta: 1, available: true },
        { id: 'side-egg', name: 'Tamagoyaki', price_delta: 0.5, available: true },
        { id: 'side-salad', name: 'Salad', price_delta: 0, available: true },
        { id: 'side-edamame', name: 'Edamame', price_delta: 0, available: true },
        { id: 'side-pickles', name: 'Pickles', price_delta: 0, available: true },
        { id: 'side-miso', name: 'Miso soup', price_delta: 0, available: true },
        { id: 'side-gyoza', name: 'Gyoza', price_delta: 0, available: true },
      ],
    },
  ],
};

const CHOSEN = ['rice-white', 'side-karaage', 'side-egg', 'side-salad'];

// A valid order: 1 rice + 3 sides (+$1.00, +$0.50, +$0) on a $5.00 dish, qty 2
// unit price $6.50, subtotal $13.00
const validBody = () => ({
  student_id: 'student-1',
  items: [{ menu_item_id: 'item-bento', qty: 2, option_ids: CHOSEN.slice() }],
});

/* ---------- fake repositories ---------- */

let saved;   // what placeOrder asked the repository to save (null = nothing saved)
let store;   // the store the fake stores repository returns
let item;    // the menu item the fake menu repository returns
let student; // the profile the fake profiles repository returns

test.beforeEach(() => {
  saved = null;
  store = structuredClone(STORE);
  item = structuredClone(BENTO);
  student = { id: 'student-1', role: 'student', name: 'Aiden Tan', status: 'active' };
  profilesRepository.findById = async (id) => (id === student.id ? student : null);
  venuesRepository.findDestinationById = async (id) => (id === 'drop-1' ? { id: 'drop-1', name: 'Library Entrance Desk' } : null);
  menuRepository.findItemWithOptions = async (id) => (id === item.id ? item : null);
  storesRepository.findById = async (id) => (id === store.id ? store : null);
  ordersRepository.create = async (args) => {
    saved = args;
    return { id: 'order-1', ...args.order, order_items: args.items, payment: args.payment };
  };
});

const near = (actual, expected, label) =>
  assert.ok(Math.abs(Number(actual) - expected) < 0.005, `${label}: expected ${expected}, got ${actual}`);

// Expect placeOrder to fail with this HTTP status, and to save nothing
async function expectRejected(body, status) {
  await assert.rejects(service.placeOrder(body), (err) => {
    assert.equal(err.status, status, `expected status ${status}, got ${err.status} (${err.message})`);
    return true;
  });
  assert.equal(saved, null, 'nothing should be saved when the order is rejected');
}

/* ---------- what gets saved ---------- */

test('saves an order with only columns that exist in the database', async () => {
  const result = await service.placeOrder(validBody());
  assert.ok(saved, 'repository.create should be called');

  // orders
  assert.equal(saved.order.student_id, 'student-1');
  assert.equal(saved.order.store_id, 'store-1');
  assert.equal(saved.order.type, 'pickup');
  assert.equal(saved.order.status, 'paid', 'orders.status must be one of: pending, paid, preparing, ready, completed, cancelled');
  assert.ok(saved.order.paid_at, 'paid_at should be set (the simulated payment happens at order time)');
  for (const missing of ['total', 'discount', 'discount_pct']) {
    assert.ok(!(missing in saved.order), `orders has no "${missing}" column, so don't send it`);
  }

  // order_items: selected_options is a list of option ids (uuid[])
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].menu_item_id, 'item-bento');
  assert.equal(saved.items[0].qty, 2);
  assert.deepEqual([...saved.items[0].selected_options].sort(), CHOSEN.slice().sort());
  assert.ok(!('item_name' in saved.items[0]), 'order_items has no "item_name" column');

  // payments: status and reference are required
  assert.equal(saved.payment.status, 'success');
  assert.ok(typeof saved.payment.reference === 'string' && saved.payment.reference.length > 0, 'payments.reference is required');

  assert.equal(result.id, 'order-1', 'placeOrder should return what the repository saved');
});

/* ---------- pricing ---------- */

test('prices on the server: $5.00 + $1.00 + $0.50 = $6.50 x 2, then 10% off', async () => {
  const body = validBody();
  body.total = 0.01; // a tampered price from the browser must be ignored
  await service.placeOrder(body);

  near(saved.items[0].unit_price, 6.5, 'unit_price');
  near(saved.order.subtotal, 13, 'subtotal (before discount)');
  near(saved.payment.amount, 11.7, 'amount paid');
});

test('dollar discount: $1.00 off', async () => {
  Object.assign(store, { discount_type: 'dollar', discount_per: null, discount_dol: 1 });
  await service.placeOrder(validBody());
  near(saved.order.subtotal, 13, 'subtotal');
  near(saved.payment.amount, 12, 'amount paid');
});

test('no discount when the store has none', async () => {
  Object.assign(store, { discount_type: null, discount_per: null, discount_dol: null });
  await service.placeOrder(validBody());
  near(saved.payment.amount, 13, 'amount paid');
});

test('a dollar discount never makes the price negative', async () => {
  Object.assign(store, { discount_type: 'dollar', discount_per: null, discount_dol: 20 });
  await service.placeOrder(validBody());
  near(saved.payment.amount, 0, 'amount paid');
});

/* ---------- checking the request ---------- */

test('400 when student_id is missing', async () => {
  const body = validBody();
  delete body.student_id;
  await expectRejected(body, 400);
});

test('400 when there are no items', async () => {
  await expectRejected({ student_id: 'student-1', items: [] }, 400);
});

test('400 when qty is less than 1', async () => {
  const body = validBody();
  body.items[0].qty = 0;
  await expectRejected(body, 400);
});

test('404 when the menu item does not exist', async () => {
  const body = validBody();
  body.items[0].menu_item_id = 'no-such-item';
  await expectRejected(body, 404);
});

test('404 when the dish has been archived (removed from the menu)', async () => {
  item.is_archived = true;
  await expectRejected(validBody(), 404);
});

/* ---------- store and item ---------- */

test('400 when the item is sold out', async () => {
  item.available = false;
  await expectRejected(validBody(), 400);
});

test('400 when the store is closed', async () => {
  store.is_open = false;
  await expectRejected(validBody(), 400);
});

/* ---------- option rules ---------- */

test('400 when an option does not belong to this item', async () => {
  const body = validBody();
  body.items[0].option_ids.push('option-from-another-dish');
  await expectRejected(body, 400);
});

test('400 when a chosen option is unavailable (e.g. karaage sold out)', async () => {
  item.option_groups[1].options[0].available = false; // side-karaage
  await expectRejected(validBody(), 400);
});

test('400 when too few options are picked (2 sides, minimum 3)', async () => {
  const body = validBody();
  body.items[0].option_ids = ['rice-white', 'side-karaage', 'side-egg'];
  await expectRejected(body, 400);
});

test('400 when too many options are picked (7 sides, maximum 6)', async () => {
  const body = validBody();
  body.items[0].option_ids = ['rice-white', 'side-karaage', 'side-egg', 'side-salad', 'side-edamame', 'side-pickles', 'side-miso', 'side-gyoza'];
  await expectRejected(body, 400);
});

test('400 when a required choice is missing (no rice)', async () => {
  const body = validBody();
  body.items[0].option_ids = ['side-karaage', 'side-egg', 'side-salad'];
  await expectRejected(body, 400);
});

test('400 when a required group is below 1 even if min_select is 0', async () => {
  item.option_groups[0].min_select = 0; // Rice is still required
  const body = validBody();
  body.items[0].option_ids = ['side-karaage', 'side-egg', 'side-salad'];
  await expectRejected(body, 400);
});

test('400 when two options are picked in a pick-one group (two kinds of rice)', async () => {
  const body = validBody();
  body.items[0].option_ids.push('rice-brown');
  await expectRejected(body, 400);
});

/* ---------- the merchant's order list ---------- */

test('400 when listing orders without a store_id', async () => {
  await assert.rejects(service.listOrders(undefined), (err) => err.status === 400);
});

test('order list adds the names of the chosen options', async () => {
  ordersRepository.findByStore = async () => [
    { id: 'order-1', order_items: [{ qty: 2, menu_items: { name: 'Chicken Teriyaki Bento' }, selected_options: ['rice-white', 'side-egg'] }] },
    { id: 'order-2', order_items: [{ qty: 1, menu_items: { name: 'Plain Bento' }, selected_options: [] }] },
  ];
  let asked;
  menuRepository.findOptionNames = async (ids) => {
    asked = ids;
    return [{ id: 'rice-white', name: 'White rice' }, { id: 'side-egg', name: 'Tamagoyaki' }];
  };

  const orders = await service.listOrders('store-1');
  assert.deepEqual(asked.slice().sort(), ['rice-white', 'side-egg'], 'looks up every option id once, in one query');
  assert.deepEqual(orders[0].order_items[0].option_names, ['White rice', 'Tamagoyaki']);
  assert.deepEqual(orders[1].order_items[0].option_names, []);
  assert.equal(orders[0].order_items[0].menu_items.name, 'Chicken Teriyaki Bento', 'keeps the rest of the order');
});

/* ---------- accounts ---------- */

test('403 when the student account is not active yet', async () => {
  student.status = 'inactive';
  await expectRejected(validBody(), 403);
});

test('400 when the account is not a student', async () => {
  student.role = 'merchant';
  await expectRejected(validBody(), 400);
});

/* ---------- peer delivery ---------- */

test('delivery: adds the $1.50 fee after the discount and opens a 10-minute job', async () => {
  const before = Date.now();
  await service.placeOrder({ ...validBody(), type: 'delivery', destination_id: 'drop-1', note: '  at the front desk ' });

  assert.equal(saved.order.type, 'delivery');
  near(saved.order.delivery_fee, 1.5, 'delivery_fee');
  near(saved.payment.amount, 11.7 + 1.5, 'amount paid (the discount is for the food only)');

  assert.ok(saved.delivery, 'a delivery row should be saved');
  assert.equal(saved.delivery.status, 'open');
  assert.equal(saved.delivery.destination_id, 'drop-1');
  assert.equal(saved.delivery.pickup_store_id, 'store-1');
  assert.equal(saved.delivery.note, 'at the front desk');
  const window = Date.parse(saved.delivery.expires_at) - before;
  assert.ok(window >= 10 * 60e3 - 1000 && window <= 10 * 60e3 + 5000, 'expires about 10 minutes after ordering');
});

test('pickup orders save no fee and no delivery (the database requires a NULL fee)', async () => {
  await service.placeOrder(validBody());
  assert.equal(saved.order.delivery_fee, null);
  assert.equal(saved.delivery, null);
});

test('400 when a delivery has no drop-off point, or an unknown one', async () => {
  await expectRejected({ ...validBody(), type: 'delivery' }, 400);
  await expectRejected({ ...validBody(), type: 'delivery', destination_id: 'nowhere' }, 400);
});

test('400 for an unknown order type', async () => {
  await expectRejected({ ...validBody(), type: 'drone' }, 400);
});

test('400 when the items come from two different stores', async () => {
  const other = { ...structuredClone(BENTO), id: 'item-other', store_id: 'store-2' };
  menuRepository.findItemWithOptions = async (id) => (id === item.id ? item : id === other.id ? other : null);
  const body = validBody();
  body.items.push({ menu_item_id: 'item-other', qty: 1, option_ids: CHOSEN.slice() });
  await expectRejected(body, 400);
});

/* ---------- order totals shown on screen ---------- */

test('order list works out the code, discount and total from the payment', async () => {
  ordersRepository.findByStore = async () => [{
    id: 'e28704a0-215d', subtotal: 13, delivery_fee: 1.5, order_items: [],
    payments: [{ amount: 13.2 }], deliveries: [{ status: 'open', fee: 1.5 }], profiles: { name: 'Aiden Tan' },
  }];
  menuRepository.findOptionNames = async () => [];
  const [order] = await service.listOrders('store-1');
  assert.equal(order.code, 'E287');
  assert.equal(order.student_name, 'Aiden Tan');
  near(order.discount, 1.3, 'discount');
  near(order.total, 13.2, 'total');
  assert.equal(order.fallback, false);
});

test('a delivery nobody took shows as a pickup with the fee waived', async () => {
  ordersRepository.findByStore = async () => [{
    id: 'order-9', subtotal: 13, delivery_fee: null, type: 'pickup', order_items: [],
    payments: [{ amount: 13.2 }], deliveries: [{ status: 'expired', fee: 1.5 }],
  }];
  menuRepository.findOptionNames = async () => [];
  const [order] = await service.listOrders('store-1');
  assert.equal(order.fallback, true);
  near(order.fee_waived, 1.5, 'fee waived');
  near(order.total, 11.7, 'total without the fee');
  near(order.discount, 1.3, 'discount');
});

/* ---------- the kitchen moving an order along ---------- */

test('the kitchen moves an order paid -> preparing -> ready -> completed', async () => {
  let row = { id: 'order-1', status: 'paid', type: 'pickup', subtotal: 5, order_items: [], payments: [] };
  ordersRepository.findById = async () => row;
  ordersRepository.updateStatus = async (id, from, changes) => (row.status === from ? (row = { ...row, ...changes }) : null);
  menuRepository.findOptionNames = async () => [];

  assert.equal((await service.updateStatus('order-1', 'preparing')).status, 'preparing');
  const ready = await service.updateStatus('order-1', 'ready');
  assert.equal(ready.status, 'ready');
  assert.ok(ready.ready_at, 'ready_at is set');
  const done = await service.updateStatus('order-1', 'completed');
  assert.ok(done.completed_at, 'completed_at is set');
});

test('409 when a status is skipped (paid straight to ready)', async () => {
  ordersRepository.findById = async () => ({ id: 'order-1', status: 'paid', type: 'pickup', order_items: [] });
  await assert.rejects(service.updateStatus('order-1', 'ready'), (err) => err.status === 409);
});

test('409 when the kitchen tries to complete a delivery order (the courier does that)', async () => {
  ordersRepository.findById = async () => ({ id: 'order-1', status: 'ready', type: 'delivery', order_items: [] });
  await assert.rejects(service.updateStatus('order-1', 'completed'), (err) => err.status === 409);
});
