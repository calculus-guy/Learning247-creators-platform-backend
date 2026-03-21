const quizWalletService = require('../services/quizWalletService');

/**
 * Quiz Currency Controller
 * 
 * Handles currency operations:
 * - Purchase Chuta with USD
 * - Withdraw Chuta to USD
 */

/**
 * Purchase Chuta with USD
 * POST /api/quiz/currency/purchase
 */
exports.purchaseCurrency = async (req, res) => {
  try {
    const userId = req.user.id;
    const { usdAmount, paymentMethod = 'card' } = req.body;

    if (!usdAmount || usdAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid USD amount'
      });
    }

    const result = await quizWalletService.purchaseCurrency(userId, usdAmount, paymentMethod);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Quiz Currency Controller] Purchase error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to purchase currency'
    });
  }
};

/**
 * Withdraw Chuta to USD
 * POST /api/quiz/currency/withdraw
 */
exports.withdrawFunds = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chutaAmount } = req.body;

    if (!chutaAmount || chutaAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Chuta amount'
      });
    }

    const result = await quizWalletService.withdrawFunds(userId, chutaAmount);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Quiz Currency Controller] Withdraw error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to withdraw funds'
    });
  }
};

module.exports = exports;
