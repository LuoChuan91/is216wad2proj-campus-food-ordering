const router = require('express').Router();
const controller = require('../controllers/menu.controller');

router.get('/:id', controller.getMenuItem);

module.exports = router;