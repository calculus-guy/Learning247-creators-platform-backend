const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Initialize payment checkout
router.post('/initialize', authMiddleware, paymentController.initializeCheckout);

// Verify payment
router.post('/verify/:reference', authMiddleware, paymentController.verifyPayment);

// Get student's purchase history
router.get('/my-purchases', authMiddleware, paymentController.getMyPurchases);

// Check if user owns content
router.get('/check-access', authMiddleware, paymentController.checkOwnership);

module.exports = router;
