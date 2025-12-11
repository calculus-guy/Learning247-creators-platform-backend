const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// Initialize payment checkout
router.post('/initialize', authMiddleware, paymentController.initializeCheckout);

// Verify payment (GET and POST, no auth required since reference is unique)
router.get('/verify/:reference', paymentController.verifyPayment);
router.post('/verify/:reference', paymentController.verifyPayment);

// Get student's purchase history
router.get('/my-purchases', authMiddleware, paymentController.getMyPurchases);

// Check if user owns content
router.get('/check-access', authMiddleware, paymentController.checkOwnership);

module.exports = router;
