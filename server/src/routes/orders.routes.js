const router = require('express').Router();
const controller = require('../controllers/orders.controller');

router.post('/', controller.postOrder);
router.get('/', controller.getOrderList);

// Angel's wait-time estimate. Must come before '/:id', or "orderAhead" is read as an id.
router.get('/orderAhead', controller.getOrderAhead);

router.get('/:id', controller.getOrder);
router.patch('/:id', controller.patchOrder);

module.exports = router;
