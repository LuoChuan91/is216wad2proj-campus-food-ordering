const router = require('express').Router();
const controller = require('../controllers/stores.controller');

router.get('/', controller.listStores);
router.get('/:id', controller.getStore);
router.get('/:id/analytics', controller.getAnalytics);
router.patch('/:id', controller.updateStore);

module.exports = router;
