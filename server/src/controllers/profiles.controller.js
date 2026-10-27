const service = require('../services/profiles.service');

// GET /api/profiles (optional ?role=student|merchant|admin)
exports.listProfiles = async (req, res) => {
  const profiles = await service.listProfiles({ role: req.query.role });
  res.json(profiles);
};

exports.getProfile = async (req, res) => {
  const profile = await service.getProfile(req.params.id);
  res.json(profile);
};

// PATCH /api/profiles/:id  { "status": "active" | "inactive" | "blocked" | "removed" }
exports.patchProfile = async (req, res) => {
  const profile = await service.updateStatus(req.params.id, req.body);
  res.json(profile);
};

// PATCH /api/profiles/:id/password-set  (sent by the invited user after choosing a password)
exports.markPasswordSet = async (req, res) => {
  const profile = await service.markPasswordSet(req.params.id, req.get('x-user-id'));
  res.json(profile);
};
