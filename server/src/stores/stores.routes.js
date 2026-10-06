// URL -> controller function. No logic here.
const router = require('express').Router();
const controller = require('./stores.controller');

router.get('/', controller.listStores);
router.get('/:id', controller.getStore);
router.patch('/:id', controller.updateStore);

module.exports = router;
