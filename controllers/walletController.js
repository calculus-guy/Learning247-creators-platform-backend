const {
  getAvailableBalance,
  getEarningsBreakdown,
  getCreatorPurchases
} = require('../services/walletService');

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
