const router = require('express').Router();
const ctrl = require('../controllers/webhookController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, ctrl.listWebhooks);
router.post('/', authMiddleware, ctrl.createWebhook);
router.put('/:id', authMiddleware, ctrl.updateWebhook);
router.delete('/:id', authMiddleware, ctrl.deleteWebhook);

module.exports = router;
