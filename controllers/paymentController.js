const {
  initializePaystackPayment,
  initializeStripePayment,
  verifyPaystackPayment,
  verifyStripePayment,
  processSuccessfulPayment
} = require('../services/paymentService');
const Purchase = require('../models/Purchase');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');
const User = require('../models/User');
const { Op } = require('sequelize');

/**
 * Initialize payment checkout
 * POST /api/payments/initialize
 */
exports.initializeCheckout = async (req, res) => {
  try {
    const { contentType, contentId, gateway } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!contentType || !contentId || !gateway) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: contentType, contentId, gateway'
      });
    }

    if (!['video', 'live_class'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Must be "video" or "live_class"'
      });
    }

    if (!['paystack', 'stripe'].includes(gateway)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid gateway. Must be "paystack" or "stripe"'
      });
    }

    // Check if user already purchased this content
    const existingPurchase = await Purchase.findOne({
      where: {
        userId,
        contentType,
        contentId,
        paymentStatus: 'completed'
      }
    });

    if (existingPurchase) {
      return res.status(400).json({
        success: false,
        message: 'You have already purchased this content'
      });
    }

    // Get content details
    let content, amount, currency;
    if (contentType === 'video') {
      content = await Video.findByPk(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Video not found'
        });
      }
      amount = parseFloat(content.price);
    } else if (contentType === 'live_class') {
      content = await LiveClass.findByPk(contentId);
      if (!content) {
        return res.status(404).json({
          success: false,
          message: 'Live class not found'
        });
      }
      amount = parseFloat(content.price);
    }

    // Check if content is free
    if (amount === 0) {
      return res.status(400).json({
        success: false,
        message: 'This content is free. No payment required.'
      });
    }

    // Get user email
    const user = await User.findByPk(userId);
    const email = user.email;

    // Initialize payment based on gateway
    let paymentData;
    if (gateway === 'paystack') {
      paymentData = await initializePaystackPayment({
        userId,
        contentType,
        contentId,
        amount,
        currency: 'NGN',
        email
      });
    } else if (gateway === 'stripe') {
      paymentData = await initializeStripePayment({
        userId,
        contentType,
        contentId,
        amount,
        currency: 'usd',
        email
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment initialized successfully',
      data: paymentData
    });
  } catch (error) {
    console.error('Initialize checkout error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize payment'
    });
  }
};

/**
 * Verify payment
 * GET/POST /api/payments/verify/:reference
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const { gateway } = req.query;

    if (!gateway || !['paystack', 'stripe'].includes(gateway)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing gateway parameter. Use ?gateway=paystack or ?gateway=stripe'
      });
    }

    console.log(`[Payment Verification] Starting verification for reference: ${reference}, gateway: ${gateway}`);

    // Check if purchase already exists (webhook may have already processed it)
    const existingPurchase = await Purchase.findOne({
      where: { paymentReference: reference }
    });

    if (existingPurchase) {
      console.log(`[Payment Verification] Purchase already exists for reference: ${reference}`);
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        purchase: existingPurchase,
        alreadyProcessed: true
      });
    }

    // Verify payment based on gateway
    let verificationResult;
    if (gateway === 'paystack') {
      verificationResult = await verifyPaystackPayment(reference);
    } else if (gateway === 'stripe') {
      verificationResult = await verifyStripePayment(reference);
    }

    if (!verificationResult.success) {
      console.log(`[Payment Verification] Verification failed for reference: ${reference}`);
      return res.status(400).json({
        success: false,
        message: verificationResult.message || 'Payment verification failed'
      });
    }

    // Extract payment data
    const paymentData = verificationResult.data;
    let userId, contentType, contentId, amount, currency;

    if (gateway === 'paystack') {
      userId = parseInt(paymentData.metadata.userId);
      contentType = paymentData.metadata.contentType;
      contentId = paymentData.metadata.contentId;
      amount = paymentData.amount / 100; // Convert from kobo
      currency = paymentData.currency;
    } else if (gateway === 'stripe') {
      userId = parseInt(paymentData.metadata.userId);
      contentType = paymentData.metadata.contentType;
      contentId = paymentData.metadata.contentId;
      amount = paymentData.amount_total / 100; // Convert from cents
      currency = paymentData.currency;
    }

    console.log(`[Payment Verification] Processing payment for user ${userId}, ${contentType} ${contentId}`);

    // Process the payment (this will create the purchase record)
    const result = await processSuccessfulPayment({
      userId,
      contentType,
      contentId,
      amount,
      currency,
      reference,
      gateway
    });

    console.log(`[Payment Verification] Payment processed successfully for reference: ${reference}`);

    return res.status(200).json({
      success: true,
      message: result.message,
      purchase: result.purchase
    });
  } catch (error) {
    console.error('[Payment Verification] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify payment'
    });
  }
};

/**
 * Get student's purchase history
 * GET /api/payments/my-purchases
 */
exports.getMyPurchases = async (req, res) => {
  try {
    const userId = req.user.id;
    const { contentType } = req.query;

    const whereClause = {
      userId,
      paymentStatus: 'completed'
    };

    if (contentType && ['video', 'live_class'].includes(contentType)) {
      whereClause.contentType = contentType;
    }

    const purchases = await Purchase.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    // Enrich purchases with content details
    const enrichedPurchases = await Promise.all(
      purchases.map(async (purchase) => {
        const purchaseData = purchase.toJSON();
        
        if (purchase.contentType === 'video') {
          const video = await Video.findByPk(purchase.contentId, {
            attributes: ['id', 'title', 'thumbnailUrl', 'type', 'category']
          });
          purchaseData.content = video;
        } else if (purchase.contentType === 'live_class') {
          const liveClass = await LiveClass.findByPk(purchase.contentId, {
            attributes: ['id', 'title', 'thumbnailUrl', 'startTime', 'endTime', 'status']
          });
          purchaseData.content = liveClass;
        }
        
        return purchaseData;
      })
    );

    return res.status(200).json({
      success: true,
      count: enrichedPurchases.length,
      purchases: enrichedPurchases
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase history'
    });
  }
};

/**
 * Check if user owns content
 * GET /api/payments/check-access?contentType=video&contentId=xxx
 */
exports.checkOwnership = async (req, res) => {
  try {
    const userId = req.user.id;
    const { contentType, contentId } = req.query;

    if (!contentType || !contentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing contentType or contentId'
      });
    }

    // Check if content is free
    let content;
    if (contentType === 'video') {
      content = await Video.findByPk(contentId);
    } else if (contentType === 'live_class') {
      content = await LiveClass.findByPk(contentId);
    }

    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    // If content is free, user has access
    if (parseFloat(content.price) === 0) {
      return res.status(200).json({
        success: true,
        hasAccess: true,
        reason: 'free_content'
      });
    }

    // Check if user purchased the content
    const purchase = await Purchase.findOne({
      where: {
        userId,
        contentType,
        contentId,
        paymentStatus: 'completed'
      }
    });

    if (purchase) {
      return res.status(200).json({
        success: true,
        hasAccess: true,
        reason: 'purchased',
        purchaseDate: purchase.createdAt
      });
    }

    return res.status(200).json({
      success: true,
      hasAccess: false,
      reason: 'not_purchased',
      price: content.price,
      currency: 'NGN'
    });
  } catch (error) {
    console.error('Check ownership error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check content access'
    });
  }
};
