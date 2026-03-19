const express = require('express');
const router = express.Router();
const referralController = require('../controllers/referralController');
const referralAdminController = require('../controllers/referralAdminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

/**
 * Referral Routes
 * 
 * User Routes (authenticated):
 * - POST /api/referral/generate-link - Generate referral link
 * - POST /api/referral/track-click - Track link clicks
 * - GET /api/referral/my-stats - Get user's referral stats
 * - GET /api/referral/my-earnings - Get commission history
 * 
 * Admin Routes (admin only):
 * - GET /api/admin/referral-commissions - Get all commissions
 * - GET /api/admin/referral-commissions/stats - Get statistics
 * - PATCH /api/admin/referral-commissions/:id/approve - Approve commission
 * - PATCH /api/admin/referral-commissions/:id/reject - Reject commission
 */

// ==================== USER ROUTES ====================

/**
 * @route   POST /api/referral/generate-link
 * @desc    Generate referral link for Video Editing class
 * @access  Private (authenticated users)
 */
router.post('/generate-link', authMiddleware, referralController.generateLink);

/**
 * @route   POST /api/referral/track-click
 * @desc    Track referral link click (optional analytics)
 * @access  Public
 */
router.post('/track-click', referralController.trackClick);

/**
 * @route   GET /api/referral/my-stats
 * @desc    Get user's referral statistics
 * @access  Private (authenticated users)
 */
router.get('/my-stats', authMiddleware, referralController.getMyStats);

/**
 * @route   GET /api/referral/my-earnings
 * @desc    Get user's commission history
 * @access  Private (authenticated users)
 */
router.get('/my-earnings', authMiddleware, referralController.getMyEarnings);

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/admin/referral-commissions
 * @desc    Get all referral commissions with filters
 * @access  Private (admin only)
 */
router.get('/admin/commissions', authMiddleware, adminMiddleware, referralAdminController.getAllCommissions);

/**
 * @route   GET /api/admin/referral-commissions/stats
 * @desc    Get referral statistics
 * @access  Private (admin only)
 */
router.get('/admin/commissions/stats', authMiddleware, adminMiddleware, referralAdminController.getStats);

/**
 * @route   PATCH /api/admin/referral-commissions/:id/approve
 * @desc    Approve commission and credit wallet
 * @access  Private (admin only)
 */
router.patch('/admin/commissions/:id/approve', authMiddleware, adminMiddleware, referralAdminController.approveCommission);

/**
 * @route   PATCH /api/admin/referral-commissions/:id/reject
 * @desc    Reject commission
 * @access  Private (admin only)
 */
router.patch('/admin/commissions/:id/reject', authMiddleware, adminMiddleware, referralAdminController.rejectCommission);

module.exports = router;
