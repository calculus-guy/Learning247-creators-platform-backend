const { paystackClient } = require('../config/paystack');
const { stripeClient } = require('../config/stripe');
const MultiCurrencyWalletService = require('./multiCurrencyWalletService');
const { idempotencyService } = require('./idempotencyService');
const Purchase = require('../models/Purchase');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');
const sequelize = require('../config/db');

/**
 * Enhanced Payment Routing Service
 * 
 * Provides secure payment processing with:
 * - Currency-based gateway routing (NGN→Paystack, USD→Stripe)
 * - Multi-currency wallet integration
 * - Idempotency protection
 * - Gateway selection validation
 * - Enhanced error handling and retry mechanisms
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

class PaymentRoutingService {
  constructor() {
    this.walletService = new MultiCurrencyWalletService();
    this.idempotencyService = idempotencyService;
    
    // Gateway routing configuration
    this.gatewayRouting = {
      'NGN': {
        gateway: 'paystack',
        client: paystackClient,
        processor: this.processPaystackPayment.bind(this),
        verifier: this.verifyPaystackPayment.bind(this)
      },
      'USD': {
        gateway: 'stripe',
        client: stripeClient,
        processor: this.processStripePayment.bind(this),
        verifier: this.verifyStripePayment.bind(this)
      }
    };

    // Content currency mapping (determines which gateway to use)
    this.contentCurrencyMapping = {
      'video': this.getContentCurrency.bind(this),
      'live_class': this.getContentCurrency.bind(this)
    };
  }

  /**
   * Initialize payment with automatic gateway routing
   * @param {Object} params - Payment parameters
   * @param {number} params.userId - User ID
   * @param {string} params.contentType - Content type (video/live_class)
   * @param {string} params.contentId - Content ID
   * @param {string} params.userEmail - User email
   * @param {string} params.idempotencyKey - Idempotency key
   * @param {string} params.forceCurrency - Optional currency override
   * @returns {Promise<Object>} Payment initialization result
   */
  async initializePayment({ userId, contentType, contentId, userEmail, idempotencyKey, forceCurrency = null }) {
    try {
      // Validate idempotency
      const idempotencyResult = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        { userId, contentType, contentId }
      );

      if (!idempotencyResult.isUnique) {
        return {
          success: true,
          cached: true,
          data: idempotencyResult.cachedResponse
        };
      }

      // Get content details and determine currency
      const contentDetails = await this.getContentDetails(contentType, contentId);
      if (!contentDetails) {
        throw new Error(`${contentType} not found`);
      }

      // Determine currency (content currency or forced currency)
      const currency = forceCurrency || contentDetails.currency || this.getDefaultCurrencyForContent(contentDetails);
      
      // Validate currency and get required gateway
      this.walletService.validateCurrency(currency);
      const requiredGateway = this.walletService.getRequiredGateway(currency);

      // Check if content is free
      if (parseFloat(contentDetails.price) === 0) {
        throw new Error('This content is free. No payment required.');
      }

      // Check for existing purchase
      await this.validateNoDuplicatePurchase(userId, contentType, contentId);

      // Route to appropriate gateway
      const gatewayConfig = this.gatewayRouting[currency];
      if (!gatewayConfig) {
        throw new Error(`No gateway configuration found for currency: ${currency}`);
      }

      console.log(`[Payment Routing] Routing ${currency} payment to ${gatewayConfig.gateway} for user ${userId}`);

      // Initialize payment with selected gateway
      const paymentResult = await gatewayConfig.processor({
        userId,
        contentType,
        contentId,
        amount: parseFloat(contentDetails.price),
        currency,
        email: userEmail,
        contentTitle: contentDetails.title || `${contentType} purchase`
      });

      // Cache successful result
      await this.idempotencyService.cacheResponse(idempotencyKey, paymentResult);

      return {
        success: true,
        currency,
        gateway: gatewayConfig.gateway,
        requiredGateway,
        data: paymentResult
      };

    } catch (error) {
      console.error('[Payment Routing] Initialize payment error:', error);
      
      // Cache error response for idempotency
      const errorResponse = {
        success: false,
        message: error.message
      };
      
      try {
        await this.idempotencyService.cacheResponse(idempotencyKey, errorResponse);
      } catch (cacheError) {
        console.error('[Payment Routing] Failed to cache error response:', cacheError);
      }
      
      throw error;
    }
  }

  /**
   * Verify payment with automatic gateway detection
   * @param {string} reference - Payment reference
   * @param {string} currency - Currency code
   * @param {string} idempotencyKey - Idempotency key
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(reference, currency, idempotencyKey) {
    try {
      // Validate idempotency
      const idempotencyResult = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        { reference, currency }
      );

      if (!idempotencyResult.isUnique) {
        return {
          success: true,
          cached: true,
          data: idempotencyResult.cachedResponse
        };
      }

      // Check if already processed
      const existingPurchase = await Purchase.findOne({
        where: { paymentReference: reference }
      });

      if (existingPurchase) {
        const result = {
          success: true,
          alreadyProcessed: true,
          purchase: existingPurchase
        };
        
        await this.idempotencyService.cacheResponse(idempotencyKey, result);
        return result;
      }

      // Route to appropriate gateway for verification
      this.walletService.validateCurrency(currency);
      const gatewayConfig = this.gatewayRouting[currency];
      
      if (!gatewayConfig) {
        throw new Error(`No gateway configuration found for currency: ${currency}`);
      }

      console.log(`[Payment Routing] Verifying ${currency} payment via ${gatewayConfig.gateway}`);

      // Verify with selected gateway
      const verificationResult = await gatewayConfig.verifier(reference);
      
      if (!verificationResult.success) {
        const errorResult = {
          success: false,
          message: verificationResult.message || 'Payment verification failed'
        };
        
        await this.idempotencyService.cacheResponse(idempotencyKey, errorResult);
        return errorResult;
      }

      // Process successful payment
      const paymentData = verificationResult.data;
      const processedPayment = await this.processSuccessfulPayment({
        paymentData,
        currency,
        gateway: gatewayConfig.gateway,
        reference
      });

      // Cache successful result
      await this.idempotencyService.cacheResponse(idempotencyKey, processedPayment);

      return processedPayment;

    } catch (error) {
      console.error('[Payment Routing] Verify payment error:', error);
      
      const errorResponse = {
        success: false,
        message: error.message || 'Payment verification failed'
      };
      
      try {
        await this.idempotencyService.cacheResponse(idempotencyKey, errorResponse);
      } catch (cacheError) {
        console.error('[Payment Routing] Failed to cache error response:', cacheError);
      }
      
      throw error;
    }
  }

  /**
   * Process Paystack payment initialization
   */
  async processPaystackPayment({ userId, contentType, contentId, amount, currency, email, contentTitle }) {
    try {
      const response = await paystackClient.post('/transaction/initialize', {
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        currency: currency.toUpperCase(),
        metadata: {
          userId: userId.toString(),
          contentType,
          contentId: contentId.toString(),
          custom_fields: [
            {
              display_name: 'Content Type',
              variable_name: 'content_type',
              value: contentType
            },
            {
              display_name: 'Content ID',
              variable_name: 'content_id',
              value: contentId.toString()
            },
            {
              display_name: 'Content Title',
              variable_name: 'content_title',
              value: contentTitle
            }
          ]
        },
        callback_url: `${process.env.CLIENT_URL}/payment/verify`
      });

      return {
        success: true,
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
        gateway: 'paystack',
        currency
      };
    } catch (error) {
      console.error('[Payment Routing] Paystack initialization error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to initialize Paystack payment');
    }
  }

  /**
   * Process Stripe payment initialization
   */
  async processStripePayment({ userId, contentType, contentId, amount, currency, email, contentTitle }) {
    try {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: contentTitle,
                description: `Purchase access to ${contentType.replace('_', ' ')}`
              },
              unit_amount: Math.round(amount * 100) // Convert to cents
            },
            quantity: 1
          }
        ],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
        client_reference_id: userId.toString(),
        metadata: {
          userId: userId.toString(),
          contentType,
          contentId: contentId.toString(),
          email,
          contentTitle
        }
      });

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url,
        reference: session.id,
        gateway: 'stripe',
        currency
      };
    } catch (error) {
      console.error('[Payment Routing] Stripe initialization error:', error.message);
      throw new Error(error.message || 'Failed to initialize Stripe payment');
    }
  }

  /**
   * Verify Paystack payment
   */
  async verifyPaystackPayment(reference) {
    try {
      const response = await paystackClient.get(`/transaction/verify/${reference}`);
      
      if (response.data.data.status === 'success') {
        return {
          success: true,
          data: response.data.data
        };
      }
      
      return {
        success: false,
        message: 'Payment not successful'
      };
    } catch (error) {
      console.error('[Payment Routing] Paystack verification error:', error.response?.data || error.message);
      throw new Error('Failed to verify Paystack payment');
    }
  }

  /**
   * Verify Stripe payment
   */
  async verifyStripePayment(sessionId) {
    try {
      const session = await stripeClient.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status === 'paid') {
        return {
          success: true,
          data: session
        };
      }
      
      return {
        success: false,
        message: 'Payment not completed'
      };
    } catch (error) {
      console.error('[Payment Routing] Stripe verification error:', error.message);
      throw new Error('Failed to verify Stripe payment');
    }
  }

  /**
   * Process successful payment and update multi-currency wallet
   */
  async processSuccessfulPayment({ paymentData, currency, gateway, reference }) {
    const transaction = await sequelize.transaction();
    
    try {
      // Extract payment details based on gateway
      let userId, contentType, contentId, amount;
      
      if (gateway === 'paystack') {
        userId = parseInt(paymentData.metadata.userId);
        contentType = paymentData.metadata.contentType;
        contentId = paymentData.metadata.contentId;
        amount = paymentData.amount / 100; // Convert from kobo
      } else if (gateway === 'stripe') {
        userId = parseInt(paymentData.metadata.userId);
        contentType = paymentData.metadata.contentType;
        contentId = paymentData.metadata.contentId;
        amount = paymentData.amount_total / 100; // Convert from cents
      }

      console.log(`[Payment Routing] Processing ${currency} payment for user ${userId}, ${contentType} ${contentId}`);

      // Create purchase record
      const purchase = await Purchase.create({
        userId,
        contentType,
        contentId,
        amount,
        currency,
        paymentGateway: gateway,
        paymentReference: reference,
        paymentStatus: 'completed'
      }, { transaction });

      // Get content creator and credit their multi-currency wallet
      const creatorId = await this.getContentCreatorId(contentType, contentId);
      
      if (creatorId) {
        // Credit creator's wallet in the appropriate currency
        await this.walletService.creditWallet({
          userId: creatorId,
          currency,
          amount,
          reference,
          description: `Earnings from ${contentType} purchase`,
          metadata: {
            purchaseId: purchase.id,
            buyerUserId: userId,
            contentType,
            contentId,
            gateway
          }
        });

        console.log(`[Payment Routing] Credited ${amount} ${currency} to creator ${creatorId}'s wallet`);
      }

      await transaction.commit();

      return {
        success: true,
        purchase,
        currency,
        gateway,
        message: 'Payment processed successfully'
      };

    } catch (error) {
      await transaction.rollback();
      console.error('[Payment Routing] Process payment error:', error);
      throw error;
    }
  }

  /**
   * Get content details (price, currency, title)
   */
  async getContentDetails(contentType, contentId) {
    try {
      if (contentType === 'video') {
        return await Video.findByPk(contentId, {
          attributes: ['id', 'title', 'price', 'currency', 'userId']
        });
      } else if (contentType === 'live_class') {
        return await LiveClass.findByPk(contentId, {
          attributes: ['id', 'title', 'price', 'currency', 'userId']
        });
      }
      return null;
    } catch (error) {
      console.error('[Payment Routing] Get content details error:', error);
      throw error;
    }
  }

  /**
   * Get content creator ID
   */
  async getContentCreatorId(contentType, contentId) {
    try {
      const content = await this.getContentDetails(contentType, contentId);
      return content?.userId || null;
    } catch (error) {
      console.error('[Payment Routing] Get creator ID error:', error);
      return null;
    }
  }

  /**
   * Get content currency (from content or default)
   */
  async getContentCurrency(contentType, contentId) {
    try {
      const content = await this.getContentDetails(contentType, contentId);
      return content?.currency || this.getDefaultCurrencyForContent(content);
    } catch (error) {
      console.error('[Payment Routing] Get content currency error:', error);
      return 'NGN'; // Default fallback
    }
  }

  /**
   * Get default currency for content (can be enhanced with business logic)
   */
  getDefaultCurrencyForContent(content) {
    // Default business logic: NGN for local content, USD for international
    // This can be enhanced based on creator location, content settings, etc.
    return 'NGN';
  }

  /**
   * Validate no duplicate purchase exists
   */
  async validateNoDuplicatePurchase(userId, contentType, contentId) {
    const existingPurchase = await Purchase.findOne({
      where: {
        userId,
        contentType,
        contentId,
        paymentStatus: 'completed'
      }
    });

    if (existingPurchase) {
      throw new Error('You have already purchased this content');
    }
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return Object.keys(this.gatewayRouting);
  }

  /**
   * Get gateway for currency
   */
  getGatewayForCurrency(currency) {
    this.walletService.validateCurrency(currency);
    return this.gatewayRouting[currency]?.gateway;
  }

  /**
   * Validate currency-gateway pairing
   */
  validateCurrencyGatewayPairing(currency, gateway) {
    return this.walletService.validateCurrencyGatewayPairing(currency, gateway);
  }
}

module.exports = PaymentRoutingService;