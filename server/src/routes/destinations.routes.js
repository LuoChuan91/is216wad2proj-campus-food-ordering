const router = require('express').Router();
const controller = require('../controllers/venues.controller');

router.get('/', controller.listDestinations);

module.exports = router;
