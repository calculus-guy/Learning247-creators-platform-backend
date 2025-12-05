const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/authMiddleware');

// Get wallet balance
router.get('/balance', authMiddleware, walletController.getWalletBalance);

// Get earnings breakdown
router.get('/earnings', authMiddleware, walletController.getEarnings);

// Get creator sales (who bought what)
router.get('/sales', authMiddleware, walletController.getCreatorSales);

module.exports = router;
