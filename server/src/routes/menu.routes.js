const router = require('express').Router();
const controller = require('../controllers/menu.controller');

router.get('/', controller.listMenu);
router.post('/itemCookingDetails', controller.getCookingDetdails);
router.get('/:id', controller.getMenuItem);
router.patch('/:id', controller.patchMenuItem);

module.exports = router;
