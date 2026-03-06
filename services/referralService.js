const ReferralCode = require('../models/ReferralCode');
const ReferralCommission = require('../models/ReferralCommission');
const User = require('../models/User');
const Purchase = require('../models/Purchase');
const sequelize = require('../config/db');
const { Op, fn, col } = require('sequelize');
const crypto = require('crypto');

/**
 * Referral Service
 * 
 * Handles referral link generation, tracking, and commission management
 * MVP Version: Hardcoded for Digital Marketing class + SaveBig10
 */

class ReferralService {
  constructor() {
    // MVP: Hardcoded configuration
    this.DIGITAL_MARKETING_SERIES_ID = 'f0e13348-6550-46df-88a0-66905d72a913';
    this.VALID_COUPON_CODE = 'SAVEBIG10';
    this.COMMISSION_AMOUNT = 2500; // NGN
    this.FRONTEND_BASE_URL = process.env.CLIENT_URL || 'https://www.hallos.net';
  }

  /**
   * Generate unique referral code
   * Format: 3 letters + 6 numbers (e.g., ABC123456)
   */
  generateUniqueCode() {
    const letters = crypto.randomBytes(2).toString('hex').toUpperCase().substring(0, 3);
    const numbers = Math.floor(100000 + Math.random() * 900000);
    return `${letters}${numbers}`;
  }

  /**
   * Generate referral link for user
   * @param {number} userId - User ID
   * @param {string} seriesId - Live series ID (optional, defaults to Digital Marketing)
   * @returns {Promise<Object>} Referral link details
   */
  async generateReferralLink(userId, seriesId = null) {
    try {
      // MVP: Only allow Digital Marketing series
      const targetSeriesId = seriesId || this.DIGITAL_MARKETING_SERIES_ID;
      
      if (targetSeriesId !== this.DIGITAL_MARKETING_SERIES_ID) {
        throw new Error('Referral program only available for Digital Marketing class');
      }

      // Check if user already has a referral code for this series
      let referralCode = await ReferralCode.findOne({
        where: {
          userId,
          seriesId: targetSeriesId
        }
      });

      // If not, create new one
      if (!referralCode) {
        let uniqueCode;
        let attempts = 0;
        const maxAttempts = 10;

        // Generate unique code (retry if collision)
        while (attempts < maxAttempts) {
          uniqueCode = this.generateUniqueCode();
          
          const existing = await ReferralCode.findOne({
            where: { referralCode: uniqueCode }
          });

          if (!existing) break;
          attempts++;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Failed to generate unique referral code');
        }

        referralCode = await ReferralCode.create({
          referralCode: uniqueCode,
          userId,
          seriesId: targetSeriesId
        });
      }

      // Build referral link
      const referralLink = `${this.FRONTEND_BASE_URL}/series/${targetSeriesId}?ref=${referralCode.referralCode}`;

      // Build share message
      const shareMessage = this.buildShareMessage(referralLink, referralCode.referralCode);

      return {
        success: true,
        referralCode: referralCode.referralCode,
        referralLink,
        shareMessage,
        commissionAmount: this.COMMISSION_AMOUNT,
        couponCode: this.VALID_COUPON_CODE,
        seriesId: targetSeriesId
      };
    } catch (error) {
      console.error('[Referral Service] Generate link error:', error);
      throw error;
    }
  }

  /**
   * Build shareable message
   */
  buildShareMessage(referralLink, referralCode) {
    return `🎓 Join me on Hallos for the Digital Marketing Masterclass!

Learn from industry experts and transform your career.

💰 Special Offer: Get ₦10,000 OFF!
Regular Price: ₦15,000
Your Price: ₦5,000

Use code: ${this.VALID_COUPON_CODE} at checkout

👉 Click here to enroll: ${referralLink}

See you in class! 🚀`;
  }

  /**
   * Track referral link click (optional analytics)
   * @param {string} referralCode - Referral code from URL
   */
  async trackClick(referralCode) {
    try {
      const referral = await ReferralCode.findOne({
        where: { referralCode }
      });

      if (referral) {
        await referral.increment('clicksCount');
        await referral.update({ lastUsedAt: new Date() });
      }

      return { success: true };
    } catch (error) {
      console.error('[Referral Service] Track click error:', error);
      // Don't throw - tracking is optional
      return { success: false };
    }
  }

  /**
   * Validate referral code before purchase
   * @param {string} referralCode - Referral code
   * @param {number} buyerUserId - User making purchase
   * @param {string} seriesId - Series being purchased
   * @param {string} couponCode - Coupon code being used
   * @returns {Promise<Object>} Validation result
   */
  async validateReferral(referralCode, buyerUserId, seriesId, couponCode) {
    try {
      // Find referral code
      const referral = await ReferralCode.findOne({
        where: { referralCode }
      });

      if (!referral) {
        return {
          valid: false,
          reason: 'Invalid referral code'
        };
      }

      // Check series matches
      if (referral.seriesId !== seriesId) {
        return {
          valid: false,
          reason: 'Referral code not valid for this series'
        };
      }

      // Check not self-referral
      if (referral.userId === buyerUserId) {
        return {
          valid: false,
          reason: 'Cannot use your own referral code'
        };
      }

      // Check coupon code matches
      if (couponCode !== this.VALID_COUPON_CODE) {
        return {
          valid: false,
          reason: `Referral only valid with ${this.VALID_COUPON_CODE} coupon code`
        };
      }

      return {
        valid: true,
        referral,
        referrerUserId: referral.userId
      };
    } catch (error) {
      console.error('[Referral Service] Validate referral error:', error);
      return {
        valid: false,
        reason: 'Validation error'
      };
    }
  }

  /**
   * Create pending commission after successful purchase
   * @param {Object} params - Commission parameters
   * @returns {Promise<Object>} Created commission
   */
  async createPendingCommission({ referralCode, referrerUserId, refereeUserId, purchaseId, seriesId, couponCode }) {
    try {
      const commission = await ReferralCommission.create({
        referralCode,
        referrerUserId,
        refereeUserId,
        purchaseId,
        seriesId,
        couponCode,
        commissionAmount: this.COMMISSION_AMOUNT,
        status: 'pending',
        purchasedAt: new Date()
      });

      // Update referral code stats
      await ReferralCode.increment('successfulReferrals', {
        by: 1,
        where: { referralCode }
      });
      
      await ReferralCode.update(
        { lastUsedAt: new Date() },
        { where: { referralCode } }
      );

      console.log(`[Referral Service] Created pending commission ${commission.id} for referrer ${referrerUserId}`);

      return {
        success: true,
        commission
      };
    } catch (error) {
      console.error('[Referral Service] Create commission error:', error);
      throw error;
    }
  }

  /**
   * Get user's referral statistics
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Referral stats
   */
  async getUserStats(userId) {
    try {
      const referralCode = await ReferralCode.findOne({
        where: {
          userId,
          seriesId: this.DIGITAL_MARKETING_SERIES_ID
        }
      });

      if (!referralCode) {
        return {
          hasReferralCode: false,
          referralCode: null,
          referralLink: null,
          stats: {
            totalClicks: 0,
            totalReferrals: 0,
            pendingCommissions: 0,
            approvedCommissions: 0,
            totalEarnings: 0
          }
        };
      }

      // Get commission stats
      const commissions = await ReferralCommission.findAll({
        where: { referrerUserId: userId },
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count'],
          [fn('SUM', col('commission_amount')), 'total']
        ],
        group: ['status'],
        raw: true
      });

      const stats = {
        totalClicks: referralCode.clicksCount,
        totalReferrals: referralCode.successfulReferrals,
        pendingCommissions: 0,
        approvedCommissions: 0,
        paidCommissions: 0,
        totalEarnings: parseFloat(referralCode.totalEarnings) || 0
      };

      commissions.forEach(c => {
        if (c.status === 'pending') stats.pendingCommissions = parseInt(c.count);
        if (c.status === 'approved') stats.approvedCommissions = parseInt(c.count);
        if (c.status === 'paid') stats.paidCommissions = parseInt(c.count);
      });

      const referralLink = `${this.FRONTEND_BASE_URL}/series/${this.DIGITAL_MARKETING_SERIES_ID}?ref=${referralCode.referralCode}`;

      return {
        hasReferralCode: true,
        referralCode: referralCode.referralCode,
        referralLink,
        commissionAmount: this.COMMISSION_AMOUNT,
        couponCode: this.VALID_COUPON_CODE,
        stats
      };
    } catch (error) {
      console.error('[Referral Service] Get user stats error:', error);
      throw error;
    }
  }

  /**
   * Get user's commission history
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Commission history
   */
  async getUserCommissions(userId, { status = null, limit = 20, offset = 0 } = {}) {
    try {
      const where = { referrerUserId: userId };
      if (status) where.status = status;

      const { count, rows: commissions } = await ReferralCommission.findAndCountAll({
        where,
        include: [
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

      return {
        success: true,
        total: count,
        commissions
      };
    } catch (error) {
      console.error('[Referral Service] Get user commissions error:', error);
      throw error;
    }
  }
}

module.exports = new ReferralService();
