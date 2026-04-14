const freebiePaymentService = require('../services/freebiePaymentService');

/**
 * FreebiePaymentController
 *
 * Thin HTTP layer for freebie purchase endpoints.
 * All business logic lives in freebiePaymentService.
 */

/**
 * Initiate purchase for a paid freebie
 * POST /api/freebies/:id/purchase
 */
exports.initiatePurchase = async (req, res) => {
  try {
    const freebieId = req.params.id;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const { currency, couponCode } = req.body;

    if (!currency) {
      return res.status(400).json({
        success: false,
        message: 'currency is required (NGN or USD)'
      });
    }

    const result = await freebiePaymentService.initiatePurchase({
      freebieId,
      userId,
      userEmail,
      currency: currency.toUpperCase(),
      couponCode
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[FreebiePaymentController] initiatePurchase error:', error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to initiate purchase',
      ...(error.alreadyPurchased && { alreadyPurchased: true })
    });
  }
};

/**
 * Verify payment and grant access
 * POST /api/freebies/:id/verify-purchase
 */
exports.verifyPurchase = async (req, res) => {
  try {
    const freebieId = req.params.id;
    const userId = req.user.id;
    const { paymentReference, currency } = req.body;

    if (!paymentReference || !currency) {
      return res.status(400).json({
        success: false,
        message: 'paymentReference and currency are required'
      });
    }

    const result = await freebiePaymentService.verifyPurchase({
      freebieId,
      userId,
      paymentReference,
      currency: currency.toUpperCase()
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[FreebiePaymentController] verifyPurchase error:', error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to verify purchase'
    });
  }
};

/**
 * Revoke access (admin — manual refund support)
 * DELETE /api/freebies/access/:accessId
 */
exports.revokeAccess = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { freebieId, userId } = req.body;

    if (!freebieId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'freebieId and userId are required'
      });
    }

    const result = await freebiePaymentService.revokeAccess({
      freebieId,
      userId: parseInt(userId),
      adminId
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('[FreebiePaymentController] revokeAccess error:', error);

    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to revoke access'
    });
  }
};

module.exports = exports;
