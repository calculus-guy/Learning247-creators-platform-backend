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

// Initiate withdrawal
router.post('/withdraw', authMiddleware, walletController.initiateWithdrawal);

// Get withdrawal history
router.get('/withdrawals', authMiddleware, walletController.getWithdrawals);

// Get list of banks
router.get('/banks', authMiddleware, walletController.getBanks);

// Calculate withdrawal fees (preview)
router.post('/calculate-fees', authMiddleware, walletController.calculateFees);

module.exports = router;
