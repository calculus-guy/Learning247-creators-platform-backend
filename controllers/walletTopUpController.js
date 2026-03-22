const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { paystackClient } = require('../config/paystack');
const MultiCurrencyWalletService = require('../services/multiCurrencyWalletService');
const sequelize = require('../config/db');

const walletService = new MultiCurrencyWalletService();

/**
 * Wallet Top-Up Controller
 * 
 * Handles direct wallet top-ups via payment gateways:
 * - Stripe for USD
 * - Paystack for NGN
 * 
 * Security Features:
 * - Idempotency: Prevents double-crediting with same reference
 * - User validation: Ensures authenticated user matches payment
 * - Payment verification: Validates payment status before crediting
 */

/**
 * Initialize wallet top-up (create payment intent/transaction)
 * POST /api/wallet/topup/initialize
 * Body: { currency: 'NGN' | 'USD', amount: number }
 */
exports.initializeTopUp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, amount } = req.body;

    // Validate input
    if (!currency || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Currency and amount are required'
      });
    }

    walletService.validateCurrency(currency);
    walletService.validateAmount(amount);

    // Minimum top-up amounts
    const minimums = { NGN: 1000, USD: 1 };
    if (amount < minimums[currency]) {
      return res.status(400).json({
        success: false,
        message: `Minimum top-up is ${minimums[currency]} ${currency}`
      });
    }

    // Fetch user email from DB since JWT only contains id and role
    const User = sequelize.models.User;
    const user = await User.findByPk(userId, { attributes: ['id', 'email'] });
    if (!user || !user.email) {
      return res.status(400).json({ success: false, message: 'User email not found' });
    }

    const reference = `topup_${Date.now()}_${userId}_${Math.random().toString(36).substring(2, 9)}`;
    const { v4: uuidv4 } = require('uuid');
    const idempotencyKey = uuidv4();

    if (currency === 'USD') {
      // Stripe Payment Intent
      const amountInCents = Math.round(amount * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          userId: userId.toString(),
          type: 'wallet_topup',
          reference
        },
        description: `Wallet top-up: ${amount} USD`
      });

      return res.status(200).json({
        success: true,
        gateway: 'stripe',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        reference,
        amount,
        currency
      });

    } else if (currency === 'NGN') {
      // Paystack Transaction
      const amountInKobo = Math.round(amount * 100);

      const response = await paystackClient.post('/transaction/initialize', {
        email: user.email,
        amount: amountInKobo,
        currency: 'NGN',
        reference,
        metadata: {
          userId,
          type: 'wallet_topup',
          custom_fields: [
            {
              display_name: 'User ID',
              variable_name: 'user_id',
              value: userId.toString()
            }
          ]
        },
        callback_url: `${process.env.CLIENT_URL}/wallet/topup/verify?reference=${reference}`
      });

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize Paystack transaction');
      }

      return res.status(200).json({
        success: true,
        gateway: 'paystack',
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference,
        amount,
        currency
      });
    }

  } catch (error) {
    console.error('[Wallet Top-Up] Initialize error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize wallet top-up'
    });
  }
};

/**
 * Verify and complete wallet top-up
 * POST /api/wallet/topup/verify
 * Body: { reference: string, gateway: 'stripe' | 'paystack', paymentIntentId?: string }
 */
exports.verifyTopUp = async (req, res) => {
  try {
    const authenticatedUserId = req.user.id;
    const { reference, gateway, paymentIntentId } = req.body;
    const { v4: uuidv4 } = require('uuid');

    if (!reference || !gateway) {
      return res.status(400).json({
        success: false,
        message: 'Reference and gateway are required'
      });
    }

    // Generate idempotency key for this transaction
    const idempotencyKey = uuidv4();

    // SECURITY: Check if this reference has already been processed (idempotency)
    const WalletTransaction = sequelize.models.WalletTransaction;
    if (WalletTransaction) {
      const existingTransaction = await WalletTransaction.findOne({
        where: {
          reference: reference
        }
      });

      if (existingTransaction) {
        return res.status(400).json({
          success: false,
          message: 'This payment has already been processed'
        });
      }
    }

    let paymentData;
    let userId;
    let amount;
    let currency;

    if (gateway === 'stripe') {
      // Verify Stripe payment
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message: 'Payment intent ID is required for Stripe'
        });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (!paymentIntent) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      // Verify reference matches
      if (paymentIntent.metadata.reference !== reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference mismatch'
        });
      }

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: `Payment status: ${paymentIntent.status}`
        });
      }

      userId = parseInt(paymentIntent.metadata.userId);
      amount = paymentIntent.amount / 100;
      currency = 'USD';
      paymentData = paymentIntent;

    } else if (gateway === 'paystack') {
      // Verify Paystack payment
      const response = await paystackClient.get(`/transaction/verify/${reference}`);

      if (!response.data.status || response.data.data.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed'
        });
      }

      userId = parseInt(response.data.data.metadata.userId);
      amount = response.data.data.amount / 100;
      currency = 'NGN';
      paymentData = response.data.data;

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid gateway'
      });
    }

    // SECURITY: Verify that the authenticated user matches the payment user
    if (userId !== authenticatedUserId) {
      console.error(`[Wallet Top-Up] User mismatch: authenticated=${authenticatedUserId}, payment=${userId}`);
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: User mismatch'
      });
    }

    // Credit the wallet
    const result = await walletService.creditWallet({
      userId,
      currency,
      amount,
      reference,
      description: `Wallet top-up via ${gateway}`,
      metadata: {
        gateway,
        paymentId: paymentData.id,
        type: 'topup',
        idempotencyKey,
        externalReference: gateway === 'stripe' ? paymentIntentId : reference
      }
    });

    console.log(`[Wallet Top-Up] Successfully credited ${amount} ${currency} to user ${userId}`);

    return res.status(200).json({
      success: true,
      message: `Successfully topped up ${amount} ${currency}`,
      wallet: result,
      transaction: {
        reference,
        amount,
        currency,
        gateway
      }
    });

  } catch (error) {
    console.error('[Wallet Top-Up] Verify error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to verify wallet top-up'
    });
  }
};

/**
 * Get top-up history
 * GET /api/wallet/topup/history?currency=NGN&limit=20&offset=0
 */
exports.getTopUpHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency, limit = 20, offset = 0 } = req.query;

    const WalletTransaction = sequelize.models.WalletTransaction;

    if (!WalletTransaction) {
      return res.status(500).json({
        success: false,
        message: 'Wallet transaction model not available'
      });
    }

    const where = {
      transaction_type: 'credit'
    };

    // Filter by currency if specified
    if (currency) {
      walletService.validateCurrency(currency);
      
      // Get wallet account for this currency
      const wallet = await walletService.getWalletAccount(userId, currency.toUpperCase());
      if (wallet) {
        where.wallet_account_id = wallet.id;
      } else {
        // No wallet for this currency, return empty
        return res.status(200).json({
          success: true,
          transactions: [],
          pagination: {
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            pages: 0
          }
        });
      }
    } else {
      // Get all user's wallets
      const wallets = await walletService.getAllWalletBalances(userId);
      const walletIds = Object.values(wallets).map(w => w.id).filter(id => id);
      
      if (walletIds.length === 0) {
        return res.status(200).json({
          success: true,
          transactions: [],
          pagination: {
            total: 0,
            limit: parseInt(limit),
            offset: parseInt(offset),
            pages: 0
          }
        });
      }
      
      where.wallet_account_id = { [sequelize.Op.in]: walletIds };
    }

    // Filter for top-up transactions only using JSONB query
    where.metadata = {
      [sequelize.Op.contains]: { type: 'topup' }
    };

    const { count, rows } = await WalletTransaction.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      transactions: rows,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('[Wallet Top-Up] Get history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch top-up history'
    });
  }
};

module.exports = exports;
