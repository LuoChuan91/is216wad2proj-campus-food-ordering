const router = require('express').Router();
const controller = require('../controllers/menu.controller');

router.get('/:id', controller.getMenuItem);
router.post('/itemCookingDetails', controller.getCookingDetdails)

module.exports = router;