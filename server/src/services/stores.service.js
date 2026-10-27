
const repository = require('../models/stores.repository');
const profilesRepository = require('../models/profiles.repository');
const { WAIT_STRATEGIES } = require('../common/config');

// The columns a PATCH may change (anything else in the body is ignored)
const EDITABLE = ['name', 'is_open', 'description', 'open_hours', 'image_url', 'discount_type', 'discount_per', 'discount_dol', 'workstations', 'wait_strategy'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.listStores = ({ venueId }) => {
  return repository.findAll({ venueId });
};

exports.getStore = async (id) => {
  const store = await repository.findById(id);
  if (!store) throw httpError(404, 'Store not found');
  return store;
};

// Only the store's own merchant (or an admin) may change it
exports.assertCanEdit = async (store, actorId) => {
  if (!actorId) throw httpError(401, 'Sign in to make changes');
  const actor = await profilesRepository.findById(actorId);
  if (!actor || actor.status !== 'active') throw httpError(401, 'Sign in to make changes');
  if (actor.role === 'admin') return;
  if (actor.role !== 'merchant' || store.merchant_id !== actor.id) throw httpError(403, 'You can only change your own store');
};

function validateOpenHours(hours) {
  if (hours === null) return null;
  if (typeof hours !== 'object' || Array.isArray(hours)) throw httpError(400, 'open_hours must be an object like { "mon": ["11:00", "20:00"] }');
  const clean = {};
  for (const [day, range] of Object.entries(hours)) {
    if (!DAYS.includes(day)) throw httpError(400, `Unknown day "${day}" in open_hours`);
    if (range === null || (Array.isArray(range) && range.length === 0)) continue;
    if (!Array.isArray(range) || range.length !== 2 || !range.every((t) => TIME.test(t))) {
      throw httpError(400, `Opening hours for ${day} must be two HH:MM times`);
    }
    if (range[0] >= range[1]) throw httpError(400, `Opening time for ${day} must be before closing time`);
    clean[day] = range;
  }
  return clean;
}

function validate(changes) {
  const out = { ...changes };
  if ('name' in out) {
    if (typeof out.name !== 'string' || !out.name.trim()) throw httpError(400, 'Store name is required');
    if (out.name.trim().length > 80) throw httpError(400, 'Store name must be 80 characters or fewer');
    out.name = out.name.trim();
  }
  if ('description' in out && out.description !== null) {
    if (typeof out.description !== 'string') throw httpError(400, 'description must be text');
    if (out.description.length > 500) throw httpError(400, 'Description must be 500 characters or fewer');
  }
  if ('image_url' in out && out.image_url !== null && out.image_url !== '') {
    if (typeof out.image_url !== 'string' || !/^https?:\/\//.test(out.image_url)) throw httpError(400, 'Image URL must start with http:// or https://');
  }
  if (out.image_url === '') out.image_url = null;
  if ('is_open' in out && typeof out.is_open !== 'boolean') throw httpError(400, 'is_open must be true or false');
  if ('open_hours' in out) out.open_hours = validateOpenHours(out.open_hours);
  if ('workstations' in out && !(Number.isInteger(out.workstations) && out.workstations >= 1 && out.workstations <= 20)) {
    throw httpError(400, 'Workstations must be a whole number from 1 to 20');
  }
  if ('wait_strategy' in out && !WAIT_STRATEGIES.includes(out.wait_strategy)) {
    throw httpError(400, `wait_strategy must be one of: ${WAIT_STRATEGIES.join(', ')}`);
  }
  return out;
}

exports.updateStore = async (id, changes = {}, actorId) => {
  const store = await exports.getStore(id);
  await exports.assertCanEdit(store, actorId);
  const allowed = Object.fromEntries(Object.entries(changes).filter(([key]) => EDITABLE.includes(key)));
  if (Object.keys(allowed).length === 0) throw httpError(400, `Nothing to change. You can change: ${EDITABLE.join(', ')}`);
  return repository.update(id, validate(allowed));
};
