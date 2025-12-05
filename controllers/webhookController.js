const crypto = require('crypto');
const { PAYSTACK_WEBHOOK_SECRET } = require('../config/paystack');
const { STRIPE_WEBHOOK_SECRET, stripeClient } = require('../config/stripe');
const { processSuccessfulPayment } = require('../services/paymentService');
const Purchase = require('../models/Purchase');
const Payout = require('../models/Payout');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { sendPurchaseConfirmationEmail, sendSaleNotificationEmail } = require('../utils/email');
const User = require('../models/User');
const Video = require('../models/Video');
const LiveClass = require('../models/liveClass');

/**
 * Handle Paystack Webhook
 * POST /api/webhooks/paystack
 */
exports.handlePaystackWebhook = async (req, res) => {
  try {
    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.error('[Paystack Webhook] Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    console.log('[Paystack Webhook] Event type:', event.event);

    // Handle charge.success event (payment completed)
    if (event.event === 'charge.success') {
      const { reference, amount, currency, metadata, customer } = event.data;

      // Extract metadata
      const userId = metadata.userId;
      const contentType = metadata.contentType;
      const contentId = metadata.contentId;

      // Process the payment
      const result = await processSuccessfulPayment({
        userId,
        contentType,
        contentId,
        amount: amount / 100, // Convert from kobo to naira
        currency,
        reference,
        gateway: 'paystack'
      });

      // Log transaction
      await Transaction.create({
        userId,
        transactionType: 'purchase',
        amount: amount / 100,
        currency,
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
 * Handle Stripe Webhook
 * POST /api/webhooks/stripe
 */
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripeClient.webhooks.constructEvent(
      req.body,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[Stripe Webhook] Event type:', event.type);

  try {
    // Handle checkout.session.completed event (payment completed)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Extract metadata
      const userId = parseInt(session.metadata.userId);
      const contentType = session.metadata.contentType;
      const contentId = session.metadata.contentId;
      const email = session.metadata.email;

      // Process the payment
      const result = await processSuccessfulPayment({
        userId,
        contentType,
        contentId,
        amount: session.amount_total / 100, // Convert from cents
        currency: session.currency,
        reference: session.id,
        gateway: 'stripe'
      });

      // Log transaction
      await Transaction.create({
        userId,
        transactionType: 'purchase',
        amount: session.amount_total / 100,
        currency: session.currency,
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
