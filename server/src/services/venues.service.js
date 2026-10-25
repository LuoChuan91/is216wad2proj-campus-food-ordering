const repository = require('../models/venues.repository');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.listVenues = () => repository.findAll();

exports.listDestinations = () => repository.findDestinations();

// Admins add a venue by dropping a pin on the map
exports.createVenue = async (body = {}) => {
  const name = String(body.name || '').trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const type = body.type || 'eatery';
  if (!name) throw httpError(400, 'Give the venue a name.');
  if (!(lat > 1.15 && lat < 1.48 && lng > 103.6 && lng < 104.1)) throw httpError(400, 'Click the map to place the pin inside Singapore.');
  if (!['eatery', 'building'].includes(type)) throw httpError(400, 'type must be eatery or building');

  return repository.create({
    name,
    address: String(body.address || '').trim() || null,
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    type,
  });
};
