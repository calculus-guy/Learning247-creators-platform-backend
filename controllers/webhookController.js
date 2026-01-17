const crypto = require('crypto');
const { PAYSTACK_WEBHOOK_SECRET } = require('../config/paystack');
const { STRIPE_WEBHOOK_SECRET, stripeClient } = require('../config/stripe');
const PaymentRoutingService = require('../services/paymentRoutingService');
const WebhookSecurityService = require('../services/webhookSecurityService');
const Purchase = require('../models/Purchase');
const Payout = require('../models/Payout');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { sendPurchaseConfirmationEmail, sendSaleNotificationEmail } = require('../utils/email');
const User = require('../models/User');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');

// Initialize services
const paymentRoutingService = new PaymentRoutingService();
const webhookSecurityService = new WebhookSecurityService();

/**
 * Handle Paystack Webhook with Enhanced Security
 * POST /api/webhooks/paystack
 */
exports.handlePaystackWebhook = async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const signature = req.headers['x-paystack-signature'];
    const payload = JSON.stringify(req.body);
    
    // Enhanced security validation
    const validationResult = await webhookSecurityService.validateWebhook({
      provider: 'paystack',
      payload,
      signature,
      secret: PAYSTACK_WEBHOOK_SECRET,
      eventId: req.body.data?.reference || `paystack_${Date.now()}`,
      clientIP
    });

    if (!validationResult.valid) {
      console.error('[Paystack Webhook] Security validation failed:', validationResult.message);
      return res.status(400).send('Webhook validation failed');
    }

    if (validationResult.duplicate) {
      console.log('[Paystack Webhook] Duplicate event, returning success');
      return res.status(200).send('Duplicate event processed');
    }

    const event = req.body;
    console.log('[Paystack Webhook] Processing event type:', event.event);

    // Handle charge.success event (payment completed)
    if (event.event === 'charge.success') {
      const { reference, amount, currency, metadata, customer } = event.data;

      // Extract metadata
      const userId = metadata.userId;
      const contentType = metadata.contentType;
      const contentId = metadata.contentId;

      // Check if already processed
      const existingPurchase = await Purchase.findOne({
        where: { paymentReference: reference }
      });

      if (existingPurchase) {
        console.log('[Paystack Webhook] Payment already processed:', reference);
        return res.status(200).send('Already processed');
      }

      // Process the payment using routing service
      const result = await paymentRoutingService.processSuccessfulPayment({
        paymentData: event.data,
        currency: currency.toUpperCase(),
        gateway: 'paystack',
        reference
      });

      // Log transaction
      await Transaction.create({
        userId,
        transactionType: 'purchase',
        amount: amount / 100,
        currency: currency.toUpperCase(),
        referenceType: 'purchase',
        referenceId: result.purchase.id,
        description: `Purchase of ${contentType} via Paystack`,
        metadata: { reference, gateway: 'paystack' }
      });

      // Send email notifications
      try {
        const user = await User.findByPk(userId);
        let content;
        if (contentType === 'video') {
          content = await Video.findByPk(contentId);
        } else if (contentType === 'live_class') {
          content = await LiveClass.findByPk(contentId);
        }

        if (user && content) {
          // Send confirmation to student
          await sendPurchaseConfirmationEmail(user.email, user.firstname, content.title, amount / 100);
          
          // Send notification to creator
          const creator = await User.findByPk(content.userId);
          if (creator) {
            await sendSaleNotificationEmail(creator.email, creator.firstname, content.title, user.firstname, amount / 100);
          }
        }
      } catch (emailError) {
        console.error('[Paystack Webhook] Email notification error:', emailError);
        // Don't fail the webhook if email fails
      }

      console.log('[Paystack Webhook] Payment processed successfully:', reference);
    }

    // Handle transfer.success event (payout completed)
    if (event.event === 'transfer.success') {
      const { reference, amount, recipient } = event.data;

      const payout = await Payout.findOne({
        where: { transferReference: reference }
      });

      if (payout) {
        // Update payout status
        payout.status = 'completed';
        await payout.save();

        // Update wallet
        const wallet = await Wallet.findOne({
          where: { userId: payout.userId }
        });

        if (wallet) {
          // Move from pending to withdrawn
          wallet.withdrawnAmount = parseFloat(wallet.withdrawnAmount) + parseFloat(payout.amount);
          wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(payout.amount);
          await wallet.save();
        }

        // Log transaction
        await Transaction.create({
          userId: payout.userId,
          transactionType: 'payout',
          amount: payout.netAmount,
          currency: payout.currency,
          referenceType: 'payout',
          referenceId: payout.id,
          description: 'Withdrawal via Paystack',
          metadata: { reference, gateway: 'paystack' }
        });

        // Send email notification
        try {
          const user = await User.findByPk(payout.userId);
          if (user) {
            const { sendWithdrawalConfirmationEmail } = require('../utils/email');
            await sendWithdrawalConfirmationEmail(
              user.email,
              user.firstname,
              payout.amount,
              payout.netAmount,
              payout.bankName,
              payout.accountNumber
            );
          }
        } catch (emailError) {
          console.error('[Paystack Webhook] Email notification error:', emailError);
        }

        console.log('[Paystack Webhook] Payout completed:', reference);
      }
    }

    // Handle transfer.failed event (payout failed)
    if (event.event === 'transfer.failed') {
      const { reference } = event.data;

      const payout = await Payout.findOne({
        where: { transferReference: reference }
      });

      if (payout) {
        // Update payout status
        payout.status = 'failed';
        payout.failureReason = event.data.message || 'Transfer failed';
        await payout.save();

        // Release locked amount in wallet
        const wallet = await Wallet.findOne({
          where: { userId: payout.userId }
        });

        if (wallet) {
          wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(payout.amount);
          await wallet.save();
        }

        // Send email notification
        try {
          const user = await User.findByPk(payout.userId);
          if (user) {
            const { sendWithdrawalFailureEmail } = require('../utils/email');
            await sendWithdrawalFailureEmail(
              user.email,
              user.firstname,
              payout.amount,
              payout.failureReason
            );
          }
        } catch (emailError) {
          console.error('[Paystack Webhook] Email notification error:', emailError);
        }

        console.log('[Paystack Webhook] Payout failed:', reference);
      }
    }

    return res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('[Paystack Webhook] Error:', error);
    return res.status(500).send('Webhook processing error');
  }
};

/**
 * Get webhook security statistics
 * GET /api/webhooks/security/stats
 */
exports.getWebhookSecurityStats = async (req, res) => {
  try {
    const stats = webhookSecurityService.getSecurityStats();
    
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[Webhook Security] Get stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get security statistics'
    });
  }
};

/**
 * Block IP address (admin endpoint)
 * POST /api/webhooks/security/block-ip
 */
exports.blockIP = async (req, res) => {
  try {
    const { ip, reason } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }
    
    webhookSecurityService.blockIP(ip, reason || 'Manual block');
    
    return res.status(200).json({
      success: true,
      message: `IP ${ip} has been blocked`
    });
  } catch (error) {
    console.error('[Webhook Security] Block IP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to block IP address'
    });
  }
};

/**
 * Unblock IP address (admin endpoint)
 * POST /api/webhooks/security/unblock-ip
 */
exports.unblockIP = async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({
        success: false,
        message: 'IP address is required'
      });
    }
    
    webhookSecurityService.unblockIP(ip);
    
    return res.status(200).json({
      success: true,
      message: `IP ${ip} has been unblocked`
    });
  } catch (error) {
    console.error('[Webhook Security] Unblock IP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unblock IP address'
    });
  }
};

/**
 * Handle Stripe Webhook with Enhanced Security
 * POST /api/webhooks/stripe
 */
exports.handleStripeWebhook = async (req, res) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const signature = req.headers['stripe-signature'];
    const payload = req.body;
    
    // Enhanced security validation
    const validationResult = await webhookSecurityService.validateWebhook({
      provider: 'stripe',
      payload,
      signature,
      secret: STRIPE_WEBHOOK_SECRET,
      eventId: req.body.id || `stripe_${Date.now()}`,
      clientIP
    });

    if (!validationResult.valid) {
      console.error('[Stripe Webhook] Security validation failed:', validationResult.message);
      return res.status(400).send('Webhook validation failed');
    }

    if (validationResult.duplicate) {
      console.log('[Stripe Webhook] Duplicate event, returning success');
      return res.status(200).json({ received: true });
    }

    // Parse event using Stripe's method for additional validation
    let event;
    try {
      event = stripeClient.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[Stripe Webhook] Event construction failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('[Stripe Webhook] Processing event type:', event.type);

    try {
      // Handle checkout.session.completed event (payment completed)
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Extract metadata
        const userId = parseInt(session.metadata.userId);
        const contentType = session.metadata.contentType;
        const contentId = session.metadata.contentId;
        const email = session.metadata.email;

        // Check if already processed
        const existingPurchase = await Purchase.findOne({
          where: { paymentReference: session.id }
        });

        if (existingPurchase) {
          console.log('[Stripe Webhook] Payment already processed:', session.id);
          return res.status(200).json({ received: true });
        }

        // Process the payment using routing service
        const result = await paymentRoutingService.processSuccessfulPayment({
          paymentData: session,
          currency: session.currency.toUpperCase(),
          gateway: 'stripe',
          reference: session.id
        });

        // Log transaction
        await Transaction.create({
          userId,
          transactionType: 'purchase',
          amount: session.amount_total / 100,
          currency: session.currency.toUpperCase(),
          referenceType: 'purchase',
          referenceId: result.purchase.id,
          description: `Purchase of ${contentType} via Stripe`,
          metadata: { sessionId: session.id, gateway: 'stripe' }
        });

        // Send email notifications
        try {
          const user = await User.findByPk(userId);
          let content;
          if (contentType === 'video') {
            content = await Video.findByPk(contentId);
          } else if (contentType === 'live_class') {
            content = await LiveClass.findByPk(contentId);
          }

          if (user && content) {
            // Send confirmation to student
            await sendPurchaseConfirmationEmail(user.email, user.firstname, content.title, session.amount_total / 100);
            
            // Send notification to creator
            const creator = await User.findByPk(content.userId);
            if (creator) {
              await sendSaleNotificationEmail(creator.email, creator.firstname, content.title, user.firstname, session.amount_total / 100);
            }
          }
        } catch (emailError) {
          console.error('[Stripe Webhook] Email notification error:', emailError);
          // Don't fail the webhook if email fails
        }

        console.log('[Stripe Webhook] Payment processed successfully:', session.id);
      }

    // Handle transfer.created event (payout initiated)
    if (event.type === 'transfer.created') {
      const transfer = event.data.object;
      console.log('[Stripe Webhook] Transfer created:', transfer.id);
    }

    // Handle transfer.updated event (payout status changed)
    if (event.type === 'transfer.updated') {
      const transfer = event.data.object;

      const payout = await Payout.findOne({
        where: { transferReference: transfer.id }
      });

      if (payout) {
        if (transfer.status === 'paid') {
          // Update payout status
          payout.status = 'completed';
          await payout.save();

          // Update wallet
          const wallet = await Wallet.findOne({
            where: { userId: payout.userId }
          });

          if (wallet) {
            wallet.withdrawnAmount = parseFloat(wallet.withdrawnAmount) + parseFloat(payout.amount);
            wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(payout.amount);
            await wallet.save();
          }

          // Log transaction
          await Transaction.create({
            userId: payout.userId,
            transactionType: 'payout',
            amount: payout.netAmount,
            currency: payout.currency,
            referenceType: 'payout',
            referenceId: payout.id,
            description: 'Withdrawal via Stripe',
            metadata: { transferId: transfer.id, gateway: 'stripe' }
          });

          // Send email notification
          try {
            const user = await User.findByPk(payout.userId);
            if (user) {
              const { sendWithdrawalConfirmationEmail } = require('../utils/email');
              await sendWithdrawalConfirmationEmail(
                user.email,
                user.firstname,
                payout.amount,
                payout.netAmount,
                payout.bankName,
                payout.accountNumber
              );
            }
          } catch (emailError) {
            console.error('[Stripe Webhook] Email notification error:', emailError);
          }

          console.log('[Stripe Webhook] Payout completed:', transfer.id);
        } else if (transfer.status === 'failed') {
          // Update payout status
          payout.status = 'failed';
          payout.failureReason = transfer.failure_message || 'Transfer failed';
          await payout.save();

          // Release locked amount in wallet
          const wallet = await Wallet.findOne({
            where: { userId: payout.userId }
          });

          if (wallet) {
            wallet.pendingAmount = parseFloat(wallet.pendingAmount) - parseFloat(payout.amount);
            await wallet.save();
          }

          // Send email notification
          try {
            const user = await User.findByPk(payout.userId);
            if (user) {
              const { sendWithdrawalFailureEmail } = require('../utils/email');
              await sendWithdrawalFailureEmail(
                user.email,
                user.firstname,
                payout.amount,
                payout.failureReason
              );
            }
          } catch (emailError) {
            console.error('[Stripe Webhook] Email notification error:', emailError);
          }

          console.log('[Stripe Webhook] Payout failed:', transfer.id);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return res.status(500).send('Webhook processing error');
  }
};
