const router = require('express').Router();
const controller = require('../controllers/profiles.controller');

router.get('/', controller.listProfiles);
router.get('/:id', controller.getProfile);
router.patch('/:id', controller.patchProfile);

module.exports = router;
