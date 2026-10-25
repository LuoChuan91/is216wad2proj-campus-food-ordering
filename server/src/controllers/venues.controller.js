const service = require('../services/venues.service');

exports.listVenues = async (req, res) => {
  res.json(await service.listVenues());
};

// POST /api/venues  { "name": "SMU Labs", "lat": 1.2965, "lng": 103.85, "type": "eatery" }
exports.postVenue = async (req, res) => {
  const venue = await service.createVenue(req.body);
  res.status(201).json(venue);
};

exports.listDestinations = async (req, res) => {
  res.json(await service.listDestinations());
};
