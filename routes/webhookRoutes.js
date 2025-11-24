const express = require('express');
const router = express.Router();
const muxController = require('../controllers/muxController');

router.post('/mux', muxController.handleMuxWebhook);

module.exports = router;