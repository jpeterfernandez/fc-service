const router = require('express').Router();
const ctrl = require('../controllers/sessionController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/status',          authMiddleware, ctrl.getStatus);
router.post('/connect',        authMiddleware, adminOnly, ctrl.connect);
router.post('/reconnect',      authMiddleware, adminOnly, ctrl.forceReconnect);
router.post('/disconnect',     authMiddleware, adminOnly, ctrl.disconnect);
router.delete('/delete',       authMiddleware, adminOnly, ctrl.deleteSession);

module.exports = router;
