const router = require('express').Router();
const controller = require('../controllers/venues.controller');

router.get('/', controller.listVenues);
router.post('/', controller.postVenue);

module.exports = router;
