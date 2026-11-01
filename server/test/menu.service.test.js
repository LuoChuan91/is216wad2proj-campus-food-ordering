// Unit tests for src/services/menu.service.js: merchants adding, editing and removing dishes.
// Run from the server folder:  pnpm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SECRET_KEY ||= 'test-only';

const service = require('../src/services/menu.service');
const menuRepository = require('../src/models/menu.repository');
const storesRepository = require('../src/models/stores.repository');
const profilesRepository = require('../src/models/profiles.repository');

const STORE = { id: 'store-1', merchant_id: 'mer-1' };
const PROFILES = {
  'mer-1': { id: 'mer-1', role: 'merchant', status: 'active' },
  'mer-2': { id: 'mer-2', role: 'merchant', status: 'active' },
};
const NEW_ITEM = { store_id: 'store-1', name: 'Katsu Don', price: 6.5, category: 'Rice', cook_time_sec: 240, max_at_once: 2 };

let items;
let categories;
test.beforeEach(() => {
  items = { 'item-1': { id: 'item-1', menu_category_id: 'cat-bento', name: 'Bento', price: 5, available: true, is_archived: false, cook_time_sec: 300, max_at_once: 2 } };
  categories = [{ id: 'cat-bento', store_id: 'store-1', name: 'Bento' }];
  const withStore = (item) => {
    const cat = categories.find((c) => c.id === item.menu_category_id);
    return { ...item, store_id: cat.store_id, category: cat.name, option_groups: [] };
  };
  menuRepository.findItemWithOptions = async (id) => (items[id] ? withStore(items[id]) : null);
  menuRepository.updateItem = async (id, changes) => Object.assign(items[id], changes);
  menuRepository.createItem = async (fields) => { items['item-new'] = { id: 'item-new', is_archived: false, ...fields }; return { id: 'item-new' }; };
  menuRepository.findCategory = async (storeId, name) => categories.find((c) => c.store_id === storeId && c.name.toLowerCase() === name.toLowerCase()) || null;
  menuRepository.createCategory = async (storeId, name) => { const c = { id: `cat-${name}`, store_id: storeId, name }; categories.push(c); return c; };
  storesRepository.findById = async (id) => (id === STORE.id ? { ...STORE } : null);
  profilesRepository.findById = async (id) => PROFILES[id] || null;
});

test('the sold-out switch still works', async () => {
  const item = await service.updateMenuItem('item-1', { available: false }, 'mer-1');
  assert.equal(item.available, false);
});

test('owner can edit name, description, price, image and cooking details', async () => {
  const item = await service.updateMenuItem('item-1', {
    name: ' Big Bento ', description: 'More rice', price: '7.255', image_url: 'https://x.test/a.png', cook_time_sec: 360, max_at_once: 3,
  }, 'mer-1');
  assert.equal(item.name, 'Big Bento');
  assert.equal(item.price, 7.26);
  assert.equal(item.image_url, 'https://x.test/a.png');
  assert.equal(item.cook_time_sec, 360);
  assert.equal(item.max_at_once, 3);
});

test('moving a dish to a new category creates the category', async () => {
  const item = await service.updateMenuItem('item-1', { category: 'Specials' }, 'mer-1');
  assert.equal(item.category, 'Specials');
  assert.equal(categories.length, 2);
});

test('bad values are rejected', async () => {
  await assert.rejects(service.updateMenuItem('item-1', { name: '' }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { price: -1 }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { price: '' }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { cook_time_sec: 0 }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { max_at_once: 1.5 }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { image_url: 'ftp://x' }, 'mer-1'), { status: 400 });
  await assert.rejects(service.updateMenuItem('item-1', { is_archived: true }, 'mer-1'), { status: 400 });
});

test('another merchant cannot edit, add or remove the dish', async () => {
  await assert.rejects(service.updateMenuItem('item-1', { price: 1 }, 'mer-2'), { status: 403 });
  await assert.rejects(service.createMenuItem(NEW_ITEM, 'mer-2'), { status: 403 });
  await assert.rejects(service.deleteMenuItem('item-1', 'mer-2'), { status: 403 });
  assert.equal(items['item-1'].price, 5);
  assert.equal(items['item-1'].is_archived, false);
});

test('owner can add a dish into an existing category (matched case-insensitively)', async () => {
  const item = await service.createMenuItem({ ...NEW_ITEM, category: 'bento' }, 'mer-1');
  assert.equal(item.id, 'item-new');
  assert.equal(item.category, 'Bento');
  assert.equal(item.available, true);
  assert.equal(categories.length, 1);
});

test('adding a dish needs a name, price, category and cooking details', async () => {
  for (const missing of ['name', 'price', 'category', 'cook_time_sec', 'max_at_once']) {
    const body = { ...NEW_ITEM };
    delete body[missing];
    await assert.rejects(service.createMenuItem(body, 'mer-1'), { status: 400 });
  }
  await assert.rejects(service.createMenuItem({ ...NEW_ITEM, store_id: undefined }, 'mer-1'), { status: 400 });
});

test('removing a dish archives it, and it is then gone', async () => {
  await service.deleteMenuItem('item-1', 'mer-1');
  assert.equal(items['item-1'].is_archived, true);
  await assert.rejects(service.getMenuItem('item-1'), { status: 404 });
  await assert.rejects(service.updateMenuItem('item-1', { available: true }, 'mer-1'), { status: 404 });
});
