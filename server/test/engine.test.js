// Unit tests for the wait-time engine (src/common/engine.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const { scheduleKitchen, estimateNew } = require('../src/common/engine');

const MIN = 60e3;
const menu = { pasta: { cook_time_sec: 300, max_at_once: 4 }, kopi: { cook_time_sec: 60, max_at_once: 12 } };

test('one slot: waiting orders queue one after another', () => {
  const now = 0;
  const orders = [
    { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    { id: 'b', status: 'placed', created_at: 2, items: [{ menu_item_id: 'pasta', qty: 1 }] },
  ];
  const out = scheduleKitchen(1, orders, menu, now);
  assert.equal(out.a.readyAt, 5 * MIN);
  assert.equal(out.b.readyAt, 10 * MIN);
  assert.equal(out.b.ahead, 1);
  assert.equal(out.b.dishesAhead, 1);
});

test('two slots cook two orders at once', () => {
  const orders = [
    { id: 'a', status: 'placed', created_at: 1, items: [{ menu_item_id: 'pasta', qty: 1 }] },
    { id: 'b', status: 'placed', created_at: 2, items: [{ menu_item_id: 'pasta', qty: 1 }] },
  ];
  const out = scheduleKitchen(2, orders, menu, 0);
  assert.equal(out.a.readyAt, 5 * MIN);
  assert.equal(out.b.readyAt, 5 * MIN);
});

test('more than max_at_once makes another batch', () => {
  const out = estimateNew(1, [], [{ menu_item_id: 'pasta', qty: 5 }], menu, 0);
  assert.equal(out.readyAt, 10 * MIN);
});

test('an order already cooking keeps its start time', () => {
  const orders = [{ id: 'a', status: 'preparing', created_at: 0, preparing_at: -2 * MIN, items: [{ menu_item_id: 'pasta', qty: 1 }] }];
  const out = scheduleKitchen(1, orders, menu, 0);
  assert.equal(out.a.readyAt, 3 * MIN);
  const next = estimateNew(1, orders, [{ menu_item_id: 'kopi', qty: 1 }], menu, 0);
  assert.equal(next.readyAt, 4 * MIN, 'the next order starts when the slot frees up');
  assert.equal(next.ahead, 1);
});
