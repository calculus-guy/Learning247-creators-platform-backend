const {
  getAvailableBalance,
  getEarningsBreakdown,
  getCreatorPurchases,
  releaseLockedAmount
} = require('../services/walletService');
const {
  calculatePayoutFees,
  initiateWithdrawal,
  processPaystackPayout,
  processStripePayout,
  getNigerianBanks
} = require('../services/payoutService');
const Payout = require('../models/Payout');
const User = require('../models/User');
const { sendWithdrawalConfirmationEmail } = require('../utils/email');

/**
 * Get wallet balance
 * GET /api/wallet/balance
 */
exports.getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const balance = await getAvailableBalance(userId);

    return res.status(200).json({
      success: true,
      balance
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet balance'
    });
  }
};

/**
 * Get earnings breakdown
 * GET /api/wallet/earnings
 */
exports.getEarnings = async (req, res) => {
  try {
    const userId = req.user.id;

    const earnings = await getEarningsBreakdown(userId);

    return res.status(200).json({
      success: true,
      earnings
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings breakdown'
    });
  }
};

/**
 * Get creator sales (list of students who purchased content)
 * GET /api/wallet/sales
 */
exports.getCreatorSales = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, contentType } = req.query;

    const sales = await getCreatorPurchases(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      contentType
    });

    return res.status(200).json({
      success: true,
      sales
    });
  } catch (error) {
    console.error('Get creator sales error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sales data'
    });
  }
};

module.exports = exports;

/**
 * Initiate withdrawal
 * POST /api/wallet/withdraw
 */
exports.initiateWithdrawal = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, bankName, accountNumber, accountName, gateway = 'paystack' } = req.body;

    // Validate input
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }

    if (!bankName || !accountNumber || !accountName) {
      return res.status(400).json({
        success: false,
        message: 'Bank details are required'
      });
    }

    if (!['paystack', 'stripe'].includes(gateway)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment gateway'
      });
    }

    // Check available balance
    const balance = await getAvailableBalance(userId);
    
    if (balance.availableBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
        availableBalance: balance.availableBalance,
        requestedAmount: amount
      });
    }

    // Calculate fees
    const fees = calculatePayoutFees(amount, gateway);

    // Initiate withdrawal
    const payout = await initiateWithdrawal({
      userId,
      amount,
      bankDetails: { bankName, accountNumber, accountName },
      gateway
    });

    // Process payout based on gateway
    try {
      let result;
      if (gateway === 'paystack') {
        result = await processPaystackPayout(payout.id);
      } else if (gateway === 'stripe') {
        result = await processStripePayout(payout.id);
      }

      return res.status(200).json({
        success: true,
        message: 'Withdrawal initiated successfully',
        payout: result.payout,
        fees
      });
    } catch (processingError) {
      // If processing fails, release the locked amount
      await releaseLockedAmount(userId, amount);
      
      return res.status(500).json({
        success: false,
        message: processingError.message || 'Failed to process withdrawal',
        payout
      });
    }
  } catch (error) {
    console.error('Initiate withdrawal error:', error);
    
    // Try to release locked amount if it was locked
    try {
      await releaseLockedAmount(req.user.id, req.body.amount);
    } catch (releaseError) {
      console.error('Failed to release locked amount:', releaseError);
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initiate withdrawal'
    });
  }
};

/**
 * Get withdrawal history
 * GET /api/wallet/withdrawals
 */
exports.getWithdrawals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, status } = req.query;

    const whereClause = { userId };
    
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      whereClause.status = status;
    }

    const payouts = await Payout.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      total: payouts.count,
      withdrawals: payouts.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawal history'
    });
  }
};

/**
 * Get list of Nigerian banks
 * GET /api/wallet/banks
 */
exports.getBanks = async (req, res) => {
  try {
    const banks = await getNigerianBanks();

    return res.status(200).json({
      success: true,
      banks
    });
  } catch (error) {
    console.error('Get banks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bank list'
    });
  }
};

/**
 * Calculate withdrawal fees (preview)
 * POST /api/wallet/calculate-fees
 */
exports.calculateFees = async (req, res) => {
  try {
    const { amount, gateway = 'paystack' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const fees = calculatePayoutFees(amount, gateway);

    return res.status(200).json({
      success: true,
      fees
    });
  } catch (error) {
    console.error('Calculate fees error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate fees'
    });
  }
};

/**
 * Get transaction history
 * GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      transactionType, 
      startDate, 
      endDate, 
      limit = 50, 
      offset = 0 
    } = req.query;

    const { getTransactionHistory } = require('../services/transactionService');

    const result = await getTransactionHistory({
      userId,
      transactionType,
      startDate,
      endDate,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction history'
    });
  }
};

/**
 * Get transaction statistics
 * GET /api/wallet/transaction-stats
 */
exports.getTransactionStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const { getTransactionStats } = require('../services/transactionService');

    const stats = await getTransactionStats(userId);

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics'
    });
  }
};

/**
 * Export transactions to CSV
 * GET /api/wallet/export-transactions
 */
exports.exportTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { transactionType, startDate, endDate } = req.query;

    const { exportTransactionsToCSV } = require('../services/transactionService');

    const csv = await exportTransactionsToCSV({
      userId,
      transactionType,
      startDate,
      endDate
    });

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);

    return res.status(200).send(csv);
  } catch (error) {
    console.error('Export transactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to export transactions'
    });
  }
};
