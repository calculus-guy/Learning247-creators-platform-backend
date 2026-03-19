const ReferralCommission = require('../models/ReferralCommission');
const ReferralCode = require('../models/ReferralCode');
const User = require('../models/User');
const { Op, fn, col } = require('sequelize');
const MultiCurrencyWalletService = require('../services/multiCurrencyWalletService');

const walletService = new MultiCurrencyWalletService();

/**
 * Referral Admin Controller
 * 
 * Handles admin operations for referral management:
 * - View all commissions
 * - Approve/reject commissions
 * - View statistics
 */

/**
 * Get all referral commissions
 * GET /api/admin/referral-commissions
 */
exports.getAllCommissions = async (req, res) => {
  try {
    const { status, referrerUserId, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (referrerUserId) where.referrerUserId = parseInt(referrerUserId);

    const { count, rows: commissions } = await ReferralCommission.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'referee',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'firstname', 'lastname'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    return res.status(200).json({
      success: true,
      total: count,
      commissions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('[Referral Admin] Get all commissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get commissions'
    });
  }
};

/**
 * Approve commission and credit wallet
 * PATCH /api/admin/referral-commissions/:id/approve
 */
exports.approveCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const commission = await ReferralCommission.findByPk(id, {
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ]
    });

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found'
      });
    }

    if (commission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Commission already ${commission.status}`
      });
    }

    // Credit referrer's wallet
    try {
      await walletService.creditWallet({
        userId: commission.referrerUserId,
        currency: 'NGN',
        amount: parseFloat(commission.commissionAmount),
        reference: `REFERRAL-${commission.id}`,
        description: `Referral commission from Video Editing class`,
        metadata: {
          commissionId: commission.id,
          refereeUserId: commission.refereeUserId,
          purchaseId: commission.purchaseId
        }
      });

      console.log(`[Referral Admin] Credited ₦${commission.commissionAmount} to user ${commission.referrerUserId}`);
    } catch (walletError) {
      console.error('[Referral Admin] Wallet credit error:', walletError);
      return res.status(500).json({
        success: false,
        message: 'Failed to credit wallet: ' + walletError.message
      });
    }

    // Update commission status
    await commission.update({
      status: 'paid',
      approvedBy: adminId,
      approvedAt: new Date(),
      paidAt: new Date()
    });

    // Update referral code total earnings
    await ReferralCode.increment(
      { totalEarnings: parseFloat(commission.commissionAmount) },
      { where: { referralCode: commission.referralCode } }
    );

    // Fetch updated commission
    const updatedCommission = await ReferralCommission.findByPk(id, {
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'referee',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'firstname', 'lastname']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: `Commission approved and ₦${commission.commissionAmount} credited to ${commission.referrer.firstname}'s wallet`,
      commission: updatedCommission
    });
  } catch (error) {
    console.error('[Referral Admin] Approve commission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve commission'
    });
  }
};

/**
 * Reject commission
 * PATCH /api/admin/referral-commissions/:id/reject
 */
exports.rejectCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const commission = await ReferralCommission.findByPk(id);

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Commission not found'
      });
    }

    if (commission.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Commission already ${commission.status}`
      });
    }

    await commission.update({
      status: 'rejected',
      approvedBy: adminId,
      approvedAt: new Date(),
      rejectionReason: reason || 'No reason provided'
    });

    // Fetch updated commission
    const updatedCommission = await ReferralCommission.findByPk(id, {
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'referee',
          attributes: ['id', 'firstname', 'lastname', 'email']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'firstname', 'lastname']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: 'Commission rejected',
      commission: updatedCommission
    });
  } catch (error) {
    console.error('[Referral Admin] Reject commission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject commission'
    });
  }
};

/**
 * Get referral statistics
 * GET /api/admin/referral-commissions/stats
 */
exports.getStats = async (req, res) => {
  try {
    // Total commissions by status
    const statusCounts = await ReferralCommission.findAll({
      attributes: [
        'status',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('commission_amount')), 'total']
      ],
      group: ['status'],
      raw: true
    });

    // Total referral codes generated
    const totalCodes = await ReferralCode.count();

    // Total clicks
    const clicksResult = await ReferralCode.findOne({
      attributes: [[fn('SUM', col('clicks_count')), 'totalClicks']],
      raw: true
    });

    // Top referrers
    const topReferrers = await ReferralCommission.findAll({
      attributes: [
        'referrerUserId',
        [fn('COUNT', col('ReferralCommission.id')), 'referralCount'],
        [fn('SUM', col('commission_amount')), 'totalEarnings']
      ],
      where: { status: ['approved', 'paid'] },
      group: ['referrerUserId', 'referrer.id', 'referrer.firstname', 'referrer.lastname', 'referrer.email'],
      order: [[fn('COUNT', col('ReferralCommission.id')), 'DESC']],
      limit: 10,
      include: [
        {
          model: User,
          as: 'referrer',
          attributes: ['id', 'firstname', 'lastname', 'email']
        }
      ],
      raw: false
    });

    const stats = {
      totalReferralCodes: totalCodes,
      totalClicks: parseInt(clicksResult.totalClicks) || 0,
      byStatus: {},
      topReferrers: topReferrers.map(r => ({
        userId: r.referrerUserId,
        user: r.referrer,
        referralCount: parseInt(r.dataValues.referralCount),
        totalEarnings: parseFloat(r.dataValues.totalEarnings)
      }))
    };

    statusCounts.forEach(s => {
      stats.byStatus[s.status] = {
        count: parseInt(s.count),
        total: parseFloat(s.total) || 0
      };
    });

    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Referral Admin] Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get statistics'
    });
  }
};
