const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/', authMiddleware, adminOnly, ctrl.listUsers);
router.post('/', authMiddleware, adminOnly, ctrl.createUser);
router.put('/:id', authMiddleware, adminOnly, ctrl.updateUser);
router.delete('/:id', authMiddleware, adminOnly, ctrl.deleteUser);
router.post('/:id/regenerate-token', authMiddleware, adminOnly, ctrl.regenerateToken);
router.get('/:id/activity', authMiddleware, adminOnly, ctrl.getUserActivity);

module.exports = router;
