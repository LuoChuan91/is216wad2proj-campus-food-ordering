
const repository = require('../models/menu.repository');
const storesService = require('./stores.service');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const EDITABLE = ['name', 'description', 'price', 'image_url', 'available', 'cook_time_sec', 'max_at_once', 'category'];

exports.getMenuItem = async (id) => {
  const item = await repository.findItemWithOptions(id);
  if (!item || item.is_archived) { // archived = removed from the menu
    throw httpError(404, 'Menu item not found');
  }
  return item;
};

// Every dish on the menus (or one store's, with storeId), with option groups
exports.listMenu = ({ storeId }) => repository.findAll({ storeId });

function validate(fields, { creating = false } = {}) {
  const out = {};
  if (creating || 'name' in fields) {
    if (typeof fields.name !== 'string' || !fields.name.trim()) throw httpError(400, 'Item name is required');
    if (fields.name.trim().length > 80) throw httpError(400, 'Item name must be 80 characters or fewer');
    out.name = fields.name.trim();
  }
  if ('description' in fields) {
    if (fields.description !== null && typeof fields.description !== 'string') throw httpError(400, 'description must be text');
    if (fields.description && fields.description.length > 300) throw httpError(400, 'Description must be 300 characters or fewer');
    out.description = fields.description || null;
  }
  if (creating || 'price' in fields) {
    const price = Number(fields.price);
    if (fields.price === '' || fields.price === null || !Number.isFinite(price) || price < 0 || price > 1000) throw httpError(400, 'Price must be a number from 0 to 1000');
    out.price = Math.round(price * 100) / 100;
  }
  if ('image_url' in fields) {
    const url = fields.image_url;
    if (url && (typeof url !== 'string' || !/^(https?:\/\/|\/\S)/.test(url))) throw httpError(400, 'Image URL must start with https:// or be a site path like /images/menu/photo.webp');
    out.image_url = url || null;
  }
  if ('available' in fields) {
    if (typeof fields.available !== 'boolean') throw httpError(400, 'available must be true or false');
    out.available = fields.available;
  }
  if (creating || 'cook_time_sec' in fields) {
    if (!(Number.isInteger(fields.cook_time_sec) && fields.cook_time_sec >= 1 && fields.cook_time_sec <= 7200)) throw httpError(400, 'Cook time must be a whole number of seconds from 1 to 7200');
    out.cook_time_sec = fields.cook_time_sec;
  }
  if (creating || 'max_at_once' in fields) {
    if (!(Number.isInteger(fields.max_at_once) && fields.max_at_once >= 1 && fields.max_at_once <= 100)) throw httpError(400, 'Batch size must be a whole number from 1 to 100');
    out.max_at_once = fields.max_at_once;
  }
  if (creating || 'category' in fields) {
    if (typeof fields.category !== 'string' || !fields.category.trim()) throw httpError(400, 'Category is required');
    out.category = fields.category.trim().slice(0, 40);
  }
  return out;
}

async function categoryId(storeId, name) {
  const existing = await repository.findCategory(storeId, name);
  return (existing || (await repository.createCategory(storeId, name))).id;
}

exports.createMenuItem = async (body = {}, actorId) => {
  if (!body.store_id) throw httpError(400, 'store_id is required');
  const store = await storesService.getStore(body.store_id);
  await storesService.assertCanEdit(store, actorId);
  const { category, ...fields } = validate(body, { creating: true });
  const { id } = await repository.createItem({
    ...fields,
    available: fields.available ?? true,
    menu_category_id: await categoryId(store.id, category),
  });
  return exports.getMenuItem(id);
};

exports.updateMenuItem = async (id, body = {}, actorId) => {
  const item = await exports.getMenuItem(id);
  await storesService.assertCanEdit(await storesService.getStore(item.store_id), actorId);
  const picked = Object.fromEntries(Object.entries(body).filter(([key]) => EDITABLE.includes(key)));
  if (Object.keys(picked).length === 0) throw httpError(400, `Nothing to change. You can change: ${EDITABLE.join(', ')}`);
  const { category, ...changes } = validate(picked);
  if (category !== undefined && category.toLowerCase() !== (item.category || '').toLowerCase()) {
    changes.menu_category_id = await categoryId(item.store_id, category);
  }
  if (Object.keys(changes).length) await repository.updateItem(id, changes);
  return exports.getMenuItem(id);
};

// Archived, not deleted: past orders still point at the dish
exports.deleteMenuItem = async (id, actorId) => {
  const item = await exports.getMenuItem(id);
  await storesService.assertCanEdit(await storesService.getStore(item.store_id), actorId);
  await repository.updateItem(id, { is_archived: true, available: false });
  return { id, removed: true };
};

// Angel: cooking details for the wait-time estimate
exports.getCookingDetails = async (ids) => {
  ids = [...new Set(ids)];
  return repository.itemsCookingDetails(ids);
};
