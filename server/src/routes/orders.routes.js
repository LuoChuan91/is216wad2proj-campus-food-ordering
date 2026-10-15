const router = require('express').Router();
const controller = require('../controllers/orders.controller');

router.post('/', controller.postOrder);
router.get('/', controller.getOrderList);
router.get('/:id', controller.getOrder);
router.patch('/:id', controller.patchOrder);

module.exports = router;
