const router = require('express').Router();
const controller = require('../controllers/deliveries.controller');

router.get('/', controller.listDeliveries);
router.patch('/:id', controller.patchDelivery);
router.get('/:id/location', controller.getLocation);
router.put('/:id/location', controller.putLocation);
router.get('/:id/chat', controller.getChat);

module.exports = router;
