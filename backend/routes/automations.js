const router = require('express').Router();
const ctrl = require('../controllers/automationController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, ctrl.listAutomations);
router.post('/', authMiddleware, ctrl.createAutomation);
router.put('/:id', authMiddleware, ctrl.updateAutomation);
router.delete('/:id', authMiddleware, ctrl.deleteAutomation);

module.exports = router;
