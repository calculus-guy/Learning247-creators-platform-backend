const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);
const MultiCurrencyWalletService = require('../services/multiCurrencyWalletService');

const walletService = new MultiCurrencyWalletService();

/**
 * Wallet Top-Up Controller
 * 
 * Handles direct wallet top-ups via payment gateways:
 * - Stripe for USD
 * - Paystack for NGN
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

    const reference = `topup_${Date.now()}_${userId}`;

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
        description: `Wallet top-up: $${amount} USD`
      });

      return res.status(200).json({
        success: true,
        gateway: 'stripe',
        clientSecret: paymentIntent.client_secret,
        reference,
        amount,
        currency
      });

    } else if (currency === 'NGN') {
      // Paystack Transaction
      const amountInKobo = Math.round(amount * 100);

      const response = await paystack.transaction.initialize({
        email: req.user.email,
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

      if (!response.status) {
        throw new Error('Failed to initialize Paystack transaction');
      }

      return res.status(200).json({
        success: true,
        gateway: 'paystack',
        authorizationUrl: response.data.authorization_url,
        accessCode: response.data.access_code,
        reference,
        amount,
        currency
      });
    }

  } catch (error) {
    console.error('Initialize top-up error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to initialize wallet top-up'
    });
  }
};

/**
 * Verify and complete wallet top-up
 * POST /api/wallet/topup/verify
 * Body: { reference: string, gateway: 'stripe' | 'paystack' }
 */
exports.verifyTopUp = async (req, res) => {
  try {
    const { reference, gateway } = req.body;

    if (!reference || !gateway) {
      return res.status(400).json({
        success: false,
        message: 'Reference and gateway are required'
      });
    }

    let paymentData;
    let userId;
    let amount;
    let currency;

    if (gateway === 'stripe') {
      // Verify Stripe payment
      const paymentIntents = await stripe.paymentIntents.list({
        limit: 1
      });

      const paymentIntent = paymentIntents.data.find(
        pi => pi.metadata.reference === reference
      );

      if (!paymentIntent) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
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
      const response = await paystack.transaction.verify(reference);

      if (!response.status || response.data.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed'
        });
      }

      userId = parseInt(response.data.metadata.userId);
      amount = response.data.amount / 100;
      currency = 'NGN';
      paymentData = response.data;

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid gateway'
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
        type: 'topup'
      }
    });

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
    console.error('Verify top-up error:', error);
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

    const sequelize = require('../config/db');
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
      }
    } else {
      // Get all user's wallets
      const wallets = await walletService.getAllWalletBalances(userId);
      const walletIds = Object.values(wallets).map(w => w.id);
      where.wallet_account_id = { [sequelize.Op.in]: walletIds };
    }

    // Filter for top-up transactions only
    where['metadata.type'] = 'topup';

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
    console.error('Get top-up history error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch top-up history'
    });
  }
};

module.exports = exports;
