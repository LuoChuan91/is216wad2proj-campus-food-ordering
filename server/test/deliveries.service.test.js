// Unit tests for src/services/deliveries.service.js: accepting, picking up and delivering a job,
// and the 10-minute rule. The repositories are fake, so these never touch Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/deliveries.service');
const repository = require('../src/models/deliveries.repository');
const ordersRepository = require('../src/models/orders.repository');
const profilesRepository = require('../src/models/profiles.repository');

let job, order, activeCount, orderChanges;
const people = {
  'stu-ben': { id: 'stu-ben', role: 'student', status: 'active', name: 'Ben' },
  'stu-amy': { id: 'stu-amy', role: 'student', status: 'active', name: 'Amy' },
  'stu-blocked': { id: 'stu-blocked', role: 'student', status: 'blocked', name: 'Cal' },
};

test.beforeEach(() => {
  order = { id: 'order-1', student_id: 'stu-amy', store_id: 'store-1', status: 'paid', order_items: [{ qty: 2 }] };
  job = { id: 'job-1', order_id: 'order-1', status: 'open', courier_id: null, fee: 1.5, expires_at: new Date(Date.now() + 5 * 60e3).toISOString() };
  activeCount = 0;
  orderChanges = null;
  profilesRepository.findById = async (id) => people[id] || null;
  repository.findById = async () => ({ ...job, orders: order });
  repository.countActiveForCourier = async () => activeCount;
  repository.update = async (id, from, changes) => (job.status === from ? Object.assign(job, changes) : null);
  ordersRepository.update = async (id, changes) => { orderChanges = changes; Object.assign(order, changes); return order; };
});

test('a student accepts an open job', async () => {
  const view = await service.act('job-1', { action: 'accept', courier_id: 'stu-ben' });
  assert.equal(view.status, 'accepted');
  assert.equal(view.courier_id, 'stu-ben');
  assert.ok(job.accepted_at);
  assert.equal(view.order.items, 2);
});

test("you can't deliver your own order", async () => {
  await assert.rejects(service.act('job-1', { action: 'accept', courier_id: 'stu-amy' }), (err) => err.status === 400);
});

test('409 when someone else took the job first', async () => {
  job.status = 'accepted';
  await assert.rejects(service.act('job-1', { action: 'accept', courier_id: 'stu-ben' }), (err) => err.status === 409);
});

test('a courier can hold up to 4 jobs at once', async () => {
  activeCount = 3; // already carrying 3 -> accepting a 4th is fine
  const view = await service.act('job-1', { action: 'accept', courier_id: 'stu-ben' });
  assert.equal(view.status, 'accepted');
});

test('409 when the courier already has 4 active jobs (the 5th is blocked)', async () => {
  activeCount = 4;
  await assert.rejects(service.act('job-1', { action: 'accept', courier_id: 'stu-ben' }), (err) => err.status === 409);
});

test('403 for a blocked account', async () => {
  await assert.rejects(service.act('job-1', { action: 'accept', courier_id: 'stu-blocked' }), (err) => err.status === 403);
});

test("can't pick up before the kitchen marks the food ready", async () => {
  Object.assign(job, { status: 'accepted', courier_id: 'stu-ben' });
  await assert.rejects(service.act('job-1', { action: 'pickup', courier_id: 'stu-ben' }), (err) => err.status === 409);
});

test('pick up, then deliver: the order is completed', async () => {
  Object.assign(job, { status: 'accepted', courier_id: 'stu-ben' });
  order.status = 'ready';
  assert.equal((await service.act('job-1', { action: 'pickup', courier_id: 'stu-ben' })).status, 'picked_up');
  assert.equal((await service.act('job-1', { action: 'deliver', courier_id: 'stu-ben' })).status, 'delivered');
  assert.equal(orderChanges.status, 'completed');
  assert.ok(orderChanges.completed_at);
});

test("another student can't finish someone else's delivery", async () => {
  Object.assign(job, { status: 'picked_up', courier_id: 'stu-ben' });
  await assert.rejects(service.act('job-1', { action: 'deliver', courier_id: 'stu-amy' }), (err) => err.status === 403);
});

test('10-minute rule: an overdue open job expires and the order becomes a pickup with no fee', async () => {
  repository.findOverdue = async () => [{ id: 'job-1', order_id: 'order-1' }];
  const n = await service.expireOverdue();
  assert.equal(n, 1);
  assert.equal(job.status, 'expired');
  assert.deepEqual(orderChanges, { type: 'pickup', delivery_fee: null });
});
