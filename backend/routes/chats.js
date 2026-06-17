const router = require('express').Router();
const ctrl = require('../controllers/chatController');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = process.env.UPLOADS_DIR || './uploads';
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', authMiddleware, ctrl.getChats);
router.get('/:jid/messages', authMiddleware, ctrl.getMessages);
router.post('/:jid/send', authMiddleware, upload.single('file'), ctrl.sendMessage);
router.post('/:jid/presence', authMiddleware, ctrl.sendPresence);

module.exports = router;
