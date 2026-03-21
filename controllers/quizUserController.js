const quizWalletService = require('../services/quizWalletService');

/**
 * Quiz User Controller
 * 
 * Handles user-facing quiz operations:
 * - User registration (initial bonus)
 * - Balance queries
 * - Statistics
 * - Transaction history
 */

/**
 * Register user for quiz platform (credit initial bonus)
 * POST /api/quiz/user/register
 */
exports.register = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await quizWalletService.creditInitialBonus(userId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Quiz User Controller] Register error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to register for quiz platform'
    });
  }
};

/**
 * Get user's Chuta balance
 * GET /api/quiz/user/balance
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const balance = await quizWalletService.getBalance(userId);

    return res.status(200).json({
      success: true,
      balance,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('[Quiz User Controller] Get balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get balance'
    });
  }
};

/**
 * Get user's quiz statistics
 * GET /api/quiz/user/stats
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const UserQuizStats = require('../models/UserQuizStats');

    const stats = await UserQuizStats.findOne({
      where: { userId }
    });

    if (!stats) {
      return res.status(200).json({
        success: true,
        lobbyStats: {},
        tournamentStats: {},
        overallStats: {}
      });
    }

    return res.status(200).json({
      success: true,
      lobbyStats: stats.lobbyStats,
      tournamentStats: stats.tournamentStats,
      overallStats: stats.overallStats,
      lastMatchAt: stats.lastMatchAt,
      lastTournamentAt: stats.lastTournamentAt
    });
  } catch (error) {
    console.error('[Quiz User Controller] Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
};

/**
 * Get user's transaction history
 * GET /api/quiz/user/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, startDate, endDate, page = 1, limit = 20 } = req.query;

    const result = await quizWalletService.getTransactionHistory(userId, {
      type,
      startDate,
      endDate,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[Quiz User Controller] Get transactions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history'
    });
  }
};

module.exports = exports;
