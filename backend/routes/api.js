const router = require('express').Router();
const ctrl = require('../controllers/apiController');
const { apiTokenMiddleware } = require('../middleware/auth');

// All external API routes use token auth
router.post('/send', apiTokenMiddleware, ctrl.apiSend);
router.post('/queue', apiTokenMiddleware, ctrl.apiQueue);
router.get('/chats', apiTokenMiddleware, ctrl.apiGetChats);
router.get('/messages', apiTokenMiddleware, ctrl.apiGetMessages);
router.get('/session/status', apiTokenMiddleware, ctrl.apiGetSessionStatus);

module.exports = router;
