const PaymentRoutingService = require('../services/paymentRoutingService');
const Purchase = require('../models/Purchase');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');
const User = require('../models/User');
const { Op } = require('sequelize');

// Initialize payment routing service
const paymentRoutingService = new PaymentRoutingService();

/**
 * Initialize payment checkout with automatic currency routing
 * POST /api/payments/initialize
 */
exports.initializeCheckout = async (req, res) => {
  try {
    const { contentType, contentId, currency: forceCurrency, couponCode } = req.body;
    const userId = req.user.id;
    const idempotencyKey = req.headers['idempotency-key'];

    // Validate input
    if (!contentType || !contentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: contentType, contentId'
      });
    }

    if (!['video', 'live_class', 'live_series'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Must be "video", "live_class", or "live_series"'
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Idempotency-Key header is required'
      });
    }

    // Get user email
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize payment with automatic routing
    const result = await paymentRoutingService.initializePayment({
      userId,
      contentType,
      contentId,
      userEmail: user.email,
      idempotencyKey,
      forceCurrency,
      couponCode
    });

    return res.status(200).json({
      success: true,
      message: result.cached ? 'Payment already initialized (cached)' : 'Payment initialized successfully',
      currency: result.currency,
      gateway: result.gateway,
      requiredGateway: result.requiredGateway,
      cached: result.cached || false,
      data: result.data
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
 * Verify payment with automatic gateway detection
 * GET/POST /api/payments/verify/:reference
 */
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const { currency } = req.query;
    const idempotencyKey = req.headers['idempotency-key'];

    if (!currency) {
      return res.status(400).json({
        success: false,
        message: 'Currency parameter is required. Use ?currency=NGN or ?currency=USD'
      });
    }

    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: 'Idempotency-Key header is required'
      });
    }

    console.log(`[Payment Verification] Starting verification for reference: ${reference}, currency: ${currency}`);

    // Verify payment with automatic routing
    const result = await paymentRoutingService.verifyPayment(reference, currency.toUpperCase(), idempotencyKey);

    if (result.cached) {
      console.log(`[Payment Verification] Returning cached result for reference: ${reference}`);
    }

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.message || (result.success ? 'Payment verified successfully' : 'Payment verification failed'),
      purchase: result.purchase,
      currency: currency.toUpperCase(),
      cached: result.cached || false,
      alreadyProcessed: result.alreadyProcessed || false
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

    if (contentType && ['video', 'live_class', 'live_series'].includes(contentType)) {
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
        } else if (purchase.contentType === 'live_series') {
          const { LiveSeries } = require('../models/liveSeriesIndex');
          const liveSeries = await LiveSeries.findByPk(purchase.contentId, {
            attributes: ['id', 'title', 'thumbnailUrl', 'startDate', 'endDate', 'status', 'recurrencePattern']
          });
          purchaseData.content = liveSeries;
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
    } else if (contentType === 'live_series') {
      const { LiveSeries } = require('../models/liveSeriesIndex');
      content = await LiveSeries.findByPk(contentId);
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
        purchaseDate: purchase.createdAt,
        currency: purchase.currency
      });
    }

    // Get content currency and required gateway
    const contentCurrency = content.currency || 'NGN';
    const requiredGateway = paymentRoutingService.getGatewayForCurrency(contentCurrency);

    return res.status(200).json({
      success: true,
      hasAccess: false,
      reason: 'not_purchased',
      price: content.price,
      currency: contentCurrency,
      requiredGateway
    });
  } catch (error) {
    console.error('Check ownership error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check content access'
    });
  }
};

/**
 * Get payment configuration (supported currencies and gateways)
 * GET /api/payments/config
 */
exports.getPaymentConfig = async (req, res) => {
  try {
    const supportedCurrencies = paymentRoutingService.getSupportedCurrencies();
    const gatewayMapping = {};
    
    supportedCurrencies.forEach(currency => {
      gatewayMapping[currency] = paymentRoutingService.getGatewayForCurrency(currency);
    });

    return res.status(200).json({
      success: true,
      supportedCurrencies,
      gatewayMapping,
      defaultCurrency: 'NGN'
    });
  } catch (error) {
    console.error('Get payment config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get payment configuration'
    });
  }
};
