const router = require('express').Router();
const ctrl = require('../controllers/queueController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', authMiddleware, ctrl.listQueue);
router.get('/stats', authMiddleware, ctrl.getQueueStats);
router.delete('/:id', authMiddleware, adminOnly, ctrl.cancelMessage);

module.exports = router;
