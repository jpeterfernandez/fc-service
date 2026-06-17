const router = require('express').Router();
const { getStats } = require('../controllers/dashboardController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, getStats);

module.exports = router;
