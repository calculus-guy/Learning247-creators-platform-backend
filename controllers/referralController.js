const referralService = require('../services/referralService');

/**
 * Referral Controller
 * 
 * Handles user-facing referral operations:
 * - Generate referral link
 * - Track clicks
 * - View stats and earnings
 */

/**
 * Generate referral link
 * POST /api/referral/generate-link
 */
exports.generateLink = async (req, res) => {
  try {
    const userId = req.user.id;
    const seriesId = req.body?.seriesId || null;

    const result = await referralService.generateReferralLink(userId, seriesId);

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Referral Controller] Generate link error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate referral link'
    });
  }
};

/**
 * Track referral link click
 * POST /api/referral/track-click
 */
exports.trackClick = async (req, res) => {
  try {
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: 'Referral code is required'
      });
    }

    await referralService.trackClick(referralCode);

    return res.status(200).json({
      success: true,
      message: 'Click tracked'
    });
  } catch (error) {
    console.error('[Referral Controller] Track click error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to track click'
    });
  }
};

/**
 * Get user's referral statistics
 * GET /api/referral/my-stats
 */
exports.getMyStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await referralService.getUserStats(userId);

    return res.status(200).json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('[Referral Controller] Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get referral statistics'
    });
  }
};

/**
 * Get user's commission history
 * GET /api/referral/my-earnings
 */
exports.getMyEarnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, offset = 0 } = req.query;

    const result = await referralService.getUserCommissions(userId, {
      status,
      limit,
      offset
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Referral Controller] Get earnings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get commission history'
    });
  }
};
