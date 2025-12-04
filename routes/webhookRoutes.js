const express = require('express');
const router = express.Router();
const muxController = require('../controllers/muxController');
const webhookController = require('../controllers/webhookController');

// Mux webhook
router.post('/mux', 
    express.raw({ type: "application/json" }),
    muxController.handleMuxWebhook);

// Paystack webhook
router.post('/paystack',
    express.json(),
    webhookController.handlePaystackWebhook);

// Stripe webhook
router.post('/stripe',
    express.raw({ type: "application/json" }),
    webhookController.handleStripeWebhook);

module.exports = router;