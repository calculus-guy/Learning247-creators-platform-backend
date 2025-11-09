const express = require('express');
const router = express.Router();
const muxController = require('../controllers/muxController');

router.post('/mux', express.raw({ type: 'application/json' }), muxController.handleMuxWebhook);

module.exports = router;