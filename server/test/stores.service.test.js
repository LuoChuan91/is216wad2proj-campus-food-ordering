// Unit tests for src/services/stores.service.js: who may edit a store, and what they may send.
// Run from the server folder:  pnpm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/stores.service');
const storesRepository = require('../src/models/stores.repository');
const profilesRepository = require('../src/models/profiles.repository');

const STORE = { id: 'store-1', merchant_id: 'mer-1', name: 'Bento Bar', is_open: true };
const PROFILES = {
  'mer-1': { id: 'mer-1', role: 'merchant', status: 'active' },
  'mer-2': { id: 'mer-2', role: 'merchant', status: 'active' },
  'adm-1': { id: 'adm-1', role: 'admin', status: 'active' },
  'stu-1': { id: 'stu-1', role: 'student', status: 'active' },
  'mer-x': { id: 'mer-x', role: 'merchant', status: 'blocked' },
};

let saved;
test.beforeEach(() => {
  saved = null;
  storesRepository.findById = async (id) => (id === STORE.id ? { ...STORE } : null);
  storesRepository.update = async (id, changes) => { saved = changes; return { ...STORE, ...changes }; };
  profilesRepository.findById = async (id) => PROFILES[id] || null;
});

test('the store owner can rename and describe their store', async () => {
  const store = await service.updateStore('store-1', { name: '  Bento Bar 2 ', description: 'Rice boxes' }, 'mer-1');
  assert.equal(store.name, 'Bento Bar 2');
  assert.deepEqual(saved, { name: 'Bento Bar 2', description: 'Rice boxes' });
});

test('an admin can edit any store', async () => {
  await service.updateStore('store-1', { is_open: false }, 'adm-1');
  assert.deepEqual(saved, { is_open: false });
});

test('another merchant, a student, a blocked merchant or nobody cannot edit the store', async () => {
  await assert.rejects(service.updateStore('store-1', { is_open: false }, 'mer-2'), { status: 403 });
  await assert.rejects(service.updateStore('store-1', { is_open: false }, 'stu-1'), { status: 403 });
  await assert.rejects(service.updateStore('store-1', { is_open: false }, 'mer-x'), { status: 401 });
  await assert.rejects(service.updateStore('store-1', { is_open: false }, undefined), { status: 401 });
  assert.equal(saved, null);
});

test('unknown store is a 404', async () => {
  await assert.rejects(service.updateStore('nope', { is_open: true }, 'mer-1'), { status: 404 });
});

test('a blank name is rejected', async () => {
  await assert.rejects(service.updateStore('store-1', { name: '   ' }, 'mer-1'), { status: 400, message: /name is required/ });
});

test('columns outside the whitelist are ignored, and an empty change is a 400', async () => {
  await service.updateStore('store-1', { is_open: true, merchant_id: 'mer-2' }, 'mer-1');
  assert.deepEqual(saved, { is_open: true });
  await assert.rejects(service.updateStore('store-1', { merchant_id: 'mer-2' }, 'mer-1'), { status: 400 });
});

test('opening hours must be valid HH:MM ranges, and closed days are dropped', async () => {
  await service.updateStore('store-1', { open_hours: { mon: ['09:00', '17:30'], tue: [] } }, 'mer-1');
  assert.deepEqual(saved.open_hours, { mon: ['09:00', '17:30'] });
  await assert.rejects(service.updateStore('store-1', { open_hours: { mon: ['9am', '5pm'] } }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateStore('store-1', { open_hours: { mon: ['18:00', '09:00'] } }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateStore('store-1', { open_hours: { funday: ['09:00', '10:00'] } }, 'mer-1'), { status: 400 });
});

test('image URL must be http(s); an empty one clears it', async () => {
  await assert.rejects(service.updateStore('store-1', { image_url: 'javascript:alert(1)' }, 'mer-1'), { status: 400 });
  await service.updateStore('store-1', { image_url: '' }, 'mer-1');
  assert.deepEqual(saved, { image_url: null });
});

test('workstations must be a whole number of at least 1', async () => {
  await service.updateStore('store-1', { workstations: 3 }, 'mer-1');
  assert.deepEqual(saved, { workstations: 3 });
  for (const bad of [0, -1, 1.5, '2', null]) {
    await assert.rejects(service.updateStore('store-1', { workstations: bad }, 'mer-1'), { status: 400 });
  }
});

test('wait strategy must be serial or scheduled', async () => {
  await service.updateStore('store-1', { wait_strategy: 'serial' }, 'mer-1');
  assert.deepEqual(saved, { wait_strategy: 'serial' });
  await assert.rejects(service.updateStore('store-1', { wait_strategy: 'bottleneck' }, 'mer-1'), { status: 400 });
});
