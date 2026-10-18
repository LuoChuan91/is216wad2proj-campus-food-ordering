const router = require('express').Router();
const controller = require('../controllers/orders.controller');

router.post('/',controller.postOrder)
router.get('/',controller.getOrderList)

// est time
router.get('/orderAhead',controller.getOrderAhead)

module.exports = router;


