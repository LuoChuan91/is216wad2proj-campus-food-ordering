const router = require('express').Router();
const controller = require('../controllers/orders.controller');

router.post('/',controller.postOrder)
router.get('/',controller.getOrderList)

module.exports = router;


