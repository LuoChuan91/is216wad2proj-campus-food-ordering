const repository = require('../models/profiles.repository');

const ROLES = ['student', 'merchant', 'admin'];
const STATUSES = ['active', 'inactive', 'blocked', 'removed'];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.listProfiles = ({ role }) => {
  if (role && !ROLES.includes(role)) throw httpError(400, `role must be one of: ${ROLES.join(', ')}`);
  return repository.findAll({ role });
};

exports.getProfile = async (id) => {
  const profile = await repository.findById(id);
  if (!profile) throw httpError(404, 'Account not found');
  return profile;
};

// Admins activate, block or remove student accounts. Only the status can change here.
exports.updateStatus = async (id, { status } = {}) => {
  if (!STATUSES.includes(status)) throw httpError(400, `status must be one of: ${STATUSES.join(', ')}`);
  const profile = await exports.getProfile(id);
  if (profile.role !== 'student') throw httpError(400, 'Only student accounts are managed here');
  return repository.update(id, { status });
};

// An invited account has chosen its own password. Only that account can say so.
exports.markPasswordSet = async (id, actorId) => {
  if (!actorId || actorId !== id) throw httpError(403, 'You can only update your own account');
  await exports.getProfile(id);
  return repository.update(id, { password_set: true });
};
