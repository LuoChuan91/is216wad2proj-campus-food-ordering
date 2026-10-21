const router = require('express').Router();
const controller = require('../controllers/waits.controller');

router.get('/', controller.getWaitTimes);
router.post('/estimate', controller.postEstimate);

module.exports = router;
