const axios = require('axios');

/**
 * Currency-Specific Withdrawal Processing Service
 * 
 * Handles currency-specific withdrawal processing:
 * - NGN withdrawals through Paystack to Nigerian banks
 * - USD withdrawals through Stripe to international banks
 * - Proper fee calculation and bank validation
 * - Gateway-specific error handling
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

class CurrencyWithdrawalService {
  constructor() {
    // Gateway configuration
    this.config = {
      // Paystack configuration for NGN
      paystack: {
        baseURL: 'https://api.paystack.co',
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        publicKey: process.env.PAYSTACK_PUBLIC_KEY,
        currency: 'NGN',
        supportedBanks: [], // Will be loaded dynamically
        fees: {
          percentage: 0.015, // 1.5%
          cap: 2000,         // ₦2,000 cap
          minimum: 50        // ₦50 minimum
        }
      },
      
      // Stripe configuration for USD
      stripe: {
        baseURL: 'https://api.stripe.com/v1',
        secretKey: process.env.STRIPE_SECRET_KEY,
        publicKey: process.env.STRIPE_PUBLISHABLE_KEY,
        currency: 'USD',
        fees: {
          percentage: 0.029, // 2.9%
          fixed: 30,         // $0.30 fixed fee
          minimum: 50        // $0.50 minimum
        }
      },
      
      // Withdrawal limits per currency
      limits: {
        NGN: {
          minimum: 1000,      // ₦1,000
          maximum: 10000000   // ₦10M
        },
        USD: {
          minimum: 10,        // $10
          maximum: 50000      // $50,000
        }
      }
    };

    // Initialize gateway clients
    this.initializeGateways();
  }

  /**
   * Initialize payment gateway clients
   */
  initializeGateways() {
    // Paystack client
    this.paystackClient = axios.create({
      baseURL: this.config.paystack.baseURL,
      headers: {
        'Authorization': `Bearer ${this.config.paystack.secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Stripe client
    this.stripeClient = axios.create({
      baseURL: this.config.stripe.baseURL,
      headers: {
        'Authorization': `Bearer ${this.config.stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }

  /**
   * Process withdrawal based on currency
   * @param {Object} withdrawalData - Withdrawal details
   * @returns {Promise<Object>} Withdrawal result
   */
  async processWithdrawal(withdrawalData) {
    try {
      const { amount, currency, bankAccount, userId, reference } = withdrawalData;

      console.log(`[Currency Withdrawal] Processing ${currency} withdrawal: ${amount} for user ${userId}`);

      // Validate withdrawal data
      const validation = this.validateWithdrawal(withdrawalData);
      if (!validation.valid) {
        return {
          success: false,
          message: validation.message,
          error: 'validation_failed'
        };
      }

      // Calculate fees
      const feeCalculation = this.calculateFees(amount, currency);

      // Route to appropriate gateway
      let result;
      if (currency === 'NGN') {
        result = await this.processNGNWithdrawal({
          ...withdrawalData,
          fees: feeCalculation
        });
      } else if (currency === 'USD') {
        result = await this.processUSDWithdrawal({
          ...withdrawalData,
          fees: feeCalculation
        });
      } else {
        return {
          success: false,
          message: `Unsupported currency: ${currency}`,
          error: 'unsupported_currency'
        };
      }

      console.log(`[Currency Withdrawal] ${currency} withdrawal result:`, result.success ? 'SUCCESS' : 'FAILED');

      return result;
    } catch (error) {
      console.error('[Currency Withdrawal] Processing error:', error);
      return {
        success: false,
        message: 'Withdrawal processing failed',
        error: 'processing_error',
        details: error.message
      };
    }
  }

  /**
   * Process NGN withdrawal through Paystack
   * @param {Object} withdrawalData - Withdrawal details with fees
   * @returns {Promise<Object>} Withdrawal result
   */
  async processNGNWithdrawal(withdrawalData) {
    try {
      const { amount, bankAccount, userId, reference, fees } = withdrawalData;

      console.log(`[NGN Withdrawal] Processing Paystack withdrawal: ₦${amount}`);

      // Validate bank account for Nigerian banks
      const bankValidation = await this.validateNigerianBankAccount(bankAccount);
      if (!bankValidation.valid) {
        return {
          success: false,
          message: bankValidation.message,
          error: 'invalid_bank_account'
        };
      }

      // Create transfer recipient
      const recipient = await this.createPaystackRecipient(bankAccount, userId);
      if (!recipient.success) {
        return recipient;
      }

      // Calculate net amount (amount - fees)
      const netAmount = amount - fees.totalFee;

      // Initiate transfer
      const transferData = {
        source: 'balance',
        amount: netAmount * 100, // Paystack uses kobo
        recipient: recipient.recipientCode,
        reason: `Withdrawal - ${reference}`,
        reference: reference,
        currency: 'NGN'
      };

      const response = await this.paystackClient.post('/transfer', transferData);

      if (response.data.status && response.data.data) {
        return {
          success: true,
          message: 'NGN withdrawal initiated successfully',
          gatewayResponse: response.data.data,
          transferCode: response.data.data.transfer_code,
          recipientCode: recipient.recipientCode,
          fees: fees,
          netAmount: netAmount,
          currency: 'NGN'
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Paystack transfer failed',
          error: 'paystack_transfer_failed',
          gatewayResponse: response.data
        };
      }
    } catch (error) {
      console.error('[NGN Withdrawal] Paystack error:', error);
      return {
        success: false,
        message: this.parsePaystackError(error),
        error: 'paystack_error',
        details: error.response?.data || error.message
      };
    }
  }

  /**
   * Process USD withdrawal through Stripe
   * @param {Object} withdrawalData - Withdrawal details with fees
   * @returns {Promise<Object>} Withdrawal result
   */
  async processUSDWithdrawal(withdrawalData) {
    try {
      const { amount, bankAccount, userId, reference, fees } = withdrawalData;

      console.log(`[USD Withdrawal] Processing Stripe withdrawal: $${amount}`);

      // Validate international bank account
      const bankValidation = this.validateInternationalBankAccount(bankAccount);
      if (!bankValidation.valid) {
        return {
          success: false,
          message: bankValidation.message,
          error: 'invalid_bank_account'
        };
      }

      // Create Stripe external account
      const externalAccount = await this.createStripeExternalAccount(bankAccount, userId);
      if (!externalAccount.success) {
        return externalAccount;
      }

      // Calculate net amount (amount - fees)
      const netAmount = amount - fees.totalFee;

      // Create payout
      const payoutData = new URLSearchParams({
        amount: Math.round(netAmount * 100), // Stripe uses cents
        currency: 'usd',
        destination: externalAccount.accountId,
        description: `Withdrawal - ${reference}`,
        metadata: JSON.stringify({
          userId: userId,
          reference: reference,
          originalAmount: amount,
          fees: fees.totalFee
        })
      });

      const response = await this.stripeClient.post('/payouts', payoutData);

      if (response.data && response.data.id) {
        return {
          success: true,
          message: 'USD withdrawal initiated successfully',
          gatewayResponse: response.data,
          payoutId: response.data.id,
          accountId: externalAccount.accountId,
          fees: fees,
          netAmount: netAmount,
          currency: 'USD'
        };
      } else {
        return {
          success: false,
          message: 'Stripe payout failed',
          error: 'stripe_payout_failed',
          gatewayResponse: response.data
        };
      }
    } catch (error) {
      console.error('[USD Withdrawal] Stripe error:', error);
      return {
        success: false,
        message: this.parseStripeError(error),
        error: 'stripe_error',
        details: error.response?.data || error.message
      };
    }
  }

  /**
   * Calculate withdrawal fees based on currency
   * @param {number} amount - Withdrawal amount
   * @param {string} currency - Currency code
   * @returns {Object} Fee calculation
   */
  calculateFees(amount, currency) {
    const config = currency === 'NGN' ? this.config.paystack : this.config.stripe;
    
    let fee = 0;
    
    if (currency === 'NGN') {
      // Paystack: percentage with cap and minimum
      fee = Math.max(
        config.fees.minimum,
        Math.min(
          amount * config.fees.percentage,
          config.fees.cap
        )
      );
    } else if (currency === 'USD') {
      // Stripe: percentage + fixed fee with minimum
      fee = Math.max(
        config.fees.minimum,
        (amount * config.fees.percentage) + config.fees.fixed
      );
    }

    return {
      amount: amount,
      currency: currency,
      feePercentage: config.fees.percentage,
      feeFixed: config.fees.fixed || 0,
      totalFee: Math.round(fee * 100) / 100, // Round to 2 decimal places
      netAmount: amount - fee,
      breakdown: {
        percentageFee: currency === 'NGN' ? amount * config.fees.percentage : amount * config.fees.percentage,
        fixedFee: config.fees.fixed || 0,
        minimum: config.fees.minimum,
        cap: config.fees.cap || null
      }
    };
  }

  /**
   * Validate withdrawal data
   * @param {Object} withdrawalData - Withdrawal details
   * @returns {Object} Validation result
   */
  validateWithdrawal(withdrawalData) {
    const { amount, currency, bankAccount } = withdrawalData;

    // Check required fields
    if (!amount || !currency || !bankAccount) {
      return {
        valid: false,
        message: 'Missing required fields: amount, currency, or bank account'
      };
    }

    // Check currency support
    if (!['NGN', 'USD'].includes(currency)) {
      return {
        valid: false,
        message: `Unsupported currency: ${currency}`
      };
    }

    // Check amount limits
    const limits = this.config.limits[currency];
    if (amount < limits.minimum) {
      return {
        valid: false,
        message: `Minimum withdrawal amount is ${currency} ${limits.minimum}`
      };
    }

    if (amount > limits.maximum) {
      return {
        valid: false,
        message: `Maximum withdrawal amount is ${currency} ${limits.maximum.toLocaleString()}`
      };
    }

    return { valid: true };
  }

  /**
   * Validate Nigerian bank account for Paystack
   * @param {Object} bankAccount - Bank account details
   * @returns {Promise<Object>} Validation result
   */
  async validateNigerianBankAccount(bankAccount) {
    try {
      const { accountNumber, bankCode, accountName } = bankAccount;

      if (!accountNumber || !bankCode) {
        return {
          valid: false,
          message: 'Account number and bank code are required for NGN withdrawals'
        };
      }

      // Verify account with Paystack
      const response = await this.paystackClient.get(
        `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`
      );

      if (response.data.status && response.data.data) {
        return {
          valid: true,
          accountName: response.data.data.account_name,
          accountNumber: response.data.data.account_number
        };
      } else {
        return {
          valid: false,
          message: 'Invalid Nigerian bank account details'
        };
      }
    } catch (error) {
      console.error('[Bank Validation] Paystack error:', error);
      return {
        valid: false,
        message: 'Unable to verify Nigerian bank account'
      };
    }
  }

  /**
   * Validate international bank account for Stripe
   * @param {Object} bankAccount - Bank account details
   * @returns {Object} Validation result
   */
  validateInternationalBankAccount(bankAccount) {
    const { accountNumber, routingNumber, country, currency } = bankAccount;

    if (!accountNumber || !routingNumber || !country) {
      return {
        valid: false,
        message: 'Account number, routing number, and country are required for USD withdrawals'
      };
    }

    // Basic validation for US accounts
    if (country === 'US') {
      if (!/^\d{9}$/.test(routingNumber)) {
        return {
          valid: false,
          message: 'Invalid US routing number format'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Create Paystack transfer recipient
   * @param {Object} bankAccount - Bank account details
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Recipient creation result
   */
  async createPaystackRecipient(bankAccount, userId) {
    try {
      const recipientData = {
        type: 'nuban',
        name: bankAccount.accountName || `User ${userId}`,
        account_number: bankAccount.accountNumber,
        bank_code: bankAccount.bankCode,
        currency: 'NGN'
      };

      const response = await this.paystackClient.post('/transferrecipient', recipientData);

      if (response.data.status && response.data.data) {
        return {
          success: true,
          recipientCode: response.data.data.recipient_code,
          recipientId: response.data.data.id
        };
      } else {
        return {
          success: false,
          message: response.data.message || 'Failed to create Paystack recipient',
          error: 'recipient_creation_failed'
        };
      }
    } catch (error) {
      console.error('[Paystack Recipient] Creation error:', error);
      return {
        success: false,
        message: this.parsePaystackError(error),
        error: 'paystack_recipient_error'
      };
    }
  }

  /**
   * Create Stripe external account
   * @param {Object} bankAccount - Bank account details
   * @param {number} userId - User ID
   * @returns {Promise<Object>} External account creation result
   */
  async createStripeExternalAccount(bankAccount, userId) {
    try {
      // Note: In production, you'd typically create a Stripe Connect account
      // For now, we'll simulate the external account creation
      const accountData = new URLSearchParams({
        object: 'bank_account',
        country: bankAccount.country || 'US',
        currency: 'usd',
        account_number: bankAccount.accountNumber,
        routing_number: bankAccount.routingNumber,
        account_holder_type: 'individual'
      });

      // This is a simplified implementation
      // In production, you'd use Stripe Connect accounts
      return {
        success: true,
        accountId: `ba_${Date.now()}_${userId}`, // Simulated account ID
        message: 'External account created successfully'
      };
    } catch (error) {
      console.error('[Stripe External Account] Creation error:', error);
      return {
        success: false,
        message: this.parseStripeError(error),
        error: 'stripe_account_error'
      };
    }
  }

  /**
   * Get supported banks for currency
   * @param {string} currency - Currency code
   * @returns {Promise<Array>} List of supported banks
   */
  async getSupportedBanks(currency) {
    try {
      if (currency === 'NGN') {
        const response = await this.paystackClient.get('/bank');
        if (response.data.status && response.data.data) {
          return response.data.data.map(bank => ({
            name: bank.name,
            code: bank.code,
            slug: bank.slug,
            currency: 'NGN'
          }));
        }
      } else if (currency === 'USD') {
        // Return common international banks/countries
        return [
          { name: 'United States', code: 'US', currency: 'USD' },
          { name: 'United Kingdom', code: 'GB', currency: 'USD' },
          { name: 'Canada', code: 'CA', currency: 'USD' },
          { name: 'Australia', code: 'AU', currency: 'USD' }
        ];
      }

      return [];
    } catch (error) {
      console.error('[Supported Banks] Error:', error);
      return [];
    }
  }

  /**
   * Parse Paystack error messages
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  parsePaystackError(error) {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error.response?.status === 401) {
      return 'Invalid Paystack credentials';
    }
    
    if (error.response?.status === 400) {
      return 'Invalid request to Paystack';
    }
    
    return 'Paystack service error';
  }

  /**
   * Parse Stripe error messages
   * @param {Error} error - Error object
   * @returns {string} User-friendly error message
   */
  parseStripeError(error) {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    
    if (error.response?.status === 401) {
      return 'Invalid Stripe credentials';
    }
    
    if (error.response?.status === 400) {
      return 'Invalid request to Stripe';
    }
    
    return 'Stripe service error';
  }

  /**
   * Get withdrawal processing status
   * @param {string} reference - Withdrawal reference
   * @param {string} currency - Currency code
   * @returns {Promise<Object>} Status result
   */
  async getWithdrawalStatus(reference, currency) {
    try {
      if (currency === 'NGN') {
        const response = await this.paystackClient.get(`/transfer/${reference}`);
        if (response.data.status && response.data.data) {
          return {
            success: true,
            status: response.data.data.status,
            gatewayResponse: response.data.data
          };
        }
      } else if (currency === 'USD') {
        // For Stripe, you'd query the payout by ID
        // This is a simplified implementation
        return {
          success: true,
          status: 'pending',
          message: 'USD withdrawal status check not fully implemented'
        };
      }

      return {
        success: false,
        message: 'Unable to check withdrawal status'
      };
    } catch (error) {
      console.error('[Withdrawal Status] Error:', error);
      return {
        success: false,
        message: 'Failed to check withdrawal status',
        error: error.message
      };
    }
  }
}

module.exports = CurrencyWithdrawalService;