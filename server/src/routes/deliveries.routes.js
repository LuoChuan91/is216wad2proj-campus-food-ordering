const router = require('express').Router();
const controller = require('../controllers/deliveries.controller');

router.get('/', controller.listDeliveries);
router.patch('/:id', controller.patchDelivery);

module.exports = router;
