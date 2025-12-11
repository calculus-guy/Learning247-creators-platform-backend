const { paystackClient } = require('../config/paystack');
const { stripeClient } = require('../config/stripe');
const Payout = require('../models/Payout');
const { lockAmountForWithdrawal } = require('../services/walletService');

const PLATFORM_FEE_PERCENTAGE = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE) || 0.20;

/**
 * Calculate payout fees
 * @param {number} amount - Withdrawal amount
 * @param {string} gateway - Payment gateway (paystack or stripe)
 * @returns {object} - Fee breakdown
 */
function calculatePayoutFees(amount, gateway = 'paystack') {
  const platformFee = amount * PLATFORM_FEE_PERCENTAGE;
  
  let gatewayFee = 0;
  
  if (gateway === 'paystack') {
    // Paystack transfer fees for NGN
    // Free for transfers above NGN 5,000
    // NGN 10 + 0.5% for transfers below NGN 5,000
    if (amount < 5000) {
      gatewayFee = 10 + (amount * 0.005);
    } else {
      gatewayFee = 0; // Free for amounts >= 5000
    }
  } else if (gateway === 'stripe') {
    // Stripe payout fees (approximate)
    // Varies by country, using a conservative estimate
    gatewayFee = amount * 0.0025; // 0.25%
  }
  
  const netAmount = amount - platformFee - gatewayFee;
  
  return {
    amount: parseFloat(amount.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    gatewayFee: parseFloat(gatewayFee.toFixed(2)),
    netAmount: parseFloat(netAmount.toFixed(2))
  };
}

/**
 * Initiate withdrawal request
 * @param {object} params - Withdrawal parameters
 * @returns {object} - Payout record
 */
async function initiateWithdrawal({ userId, amount, bankDetails, gateway = 'paystack' }) {
  try {
    const { bankName, accountNumber, accountName } = bankDetails;

    // Validate bank details
    if (!bankName || !accountNumber || !accountName) {
      throw new Error('Bank details are incomplete');
    }

    // Calculate fees
    const fees = calculatePayoutFees(amount, gateway);

    if (fees.netAmount <= 0) {
      throw new Error('Amount too small after fees');
    }

    // Lock amount in wallet
    await lockAmountForWithdrawal(userId, amount);

    // Create payout record
    const payout = await Payout.create({
      userId,
      amount: fees.amount,
      platformFee: fees.platformFee,
      gatewayFee: fees.gatewayFee,
      netAmount: fees.netAmount,
      currency: 'NGN',
      paymentGateway: gateway,
      bankName,
      accountNumber,
      accountName,
      status: 'pending'
    });

    return payout;
  } catch (error) {
    console.error('Initiate withdrawal error:', error);
    throw error;
  }
}

/**
 * Process payout via Paystack
 * @param {string} payoutId - Payout record ID
 * @returns {object} - Transfer result
 */
async function processPaystackPayout(payoutId) {
  try {
    const payout = await Payout.findByPk(payoutId);

    if (!payout) {
      throw new Error('Payout not found');
    }

    if (payout.status !== 'pending') {
      throw new Error('Payout already processed');
    }

    // Step 1: Create transfer recipient
    const recipientResponse = await paystackClient.post('/transferrecipient', {
      type: 'nuban',
      name: payout.accountName,
      account_number: payout.accountNumber,
      bank_code: await getBankCode(payout.bankName), // Helper function to get bank code
      currency: 'NGN'
    });

    const recipientCode = recipientResponse.data.data.recipient_code;

    // Step 2: Initiate transfer
    const transferResponse = await paystackClient.post('/transfer', {
      source: 'balance',
      amount: Math.round(payout.netAmount * 100), // Convert to kobo
      recipient: recipientCode,
      reason: `Withdrawal for user ${payout.userId}`,
      reference: `payout_${payout.id}_${Date.now()}`
    });

    const transferData = transferResponse.data.data;

    // Update payout with transfer reference
    payout.transferReference = transferData.transfer_code || transferData.reference;
    payout.status = 'processing';
    await payout.save();

    return {
      success: true,
      payout,
      transferData
    };
  } catch (error) {
    console.error('Paystack payout error:', error.response?.data || error.message);
    
    // Update payout status to failed
    const payout = await Payout.findByPk(payoutId);
    if (payout) {
      payout.status = 'failed';
      payout.failureReason = error.response?.data?.message || error.message;
      await payout.save();
    }

    throw new Error(error.response?.data?.message || 'Failed to process Paystack payout');
  }
}

/**
 * Process payout via Stripe
 * @param {string} payoutId - Payout record ID
 * @returns {object} - Transfer result
 */
async function processStripePayout(payoutId) {
  try {
    const payout = await Payout.findByPk(payoutId);

    if (!payout) {
      throw new Error('Payout not found');
    }

    if (payout.status !== 'pending') {
      throw new Error('Payout already processed');
    }

    // Note: Stripe payouts typically require Stripe Connect setup
    // This is a simplified version - you may need to adjust based on your Stripe setup
    
    const transfer = await stripeClient.transfers.create({
      amount: Math.round(payout.netAmount * 100), // Convert to cents
      currency: 'usd', // Adjust based on your needs
      destination: 'connected_account_id', // You'll need to set this up
      description: `Withdrawal for user ${payout.userId}`,
      metadata: {
        payoutId: payout.id,
        userId: payout.userId.toString()
      }
    });

    // Update payout with transfer reference
    payout.transferReference = transfer.id;
    payout.status = 'processing';
    await payout.save();

    return {
      success: true,
      payout,
      transfer
    };
  } catch (error) {
    console.error('Stripe payout error:', error.message);
    
    // Update payout status to failed
    const payout = await Payout.findByPk(payoutId);
    if (payout) {
      payout.status = 'failed';
      payout.failureReason = error.message;
      await payout.save();
    }

    throw new Error(error.message || 'Failed to process Stripe payout');
  }
}

/**
 * Helper function to get Paystack bank code from bank name
 * In production, you should fetch this from Paystack's bank list API
 */
async function getBankCode(bankName) {
  // Common Nigerian banks - you should fetch this dynamically from Paystack API
  const bankCodes = {
    'Access Bank': '044',
    'Citibank': '023',
    'Diamond Bank': '063',
    'Ecobank Nigeria': '050',
    'Fidelity Bank': '070',
    'First Bank of Nigeria': '011',
    'First City Monument Bank': '214',
    'Guaranty Trust Bank': '058',
    'Heritage Bank': '030',
    'Keystone Bank': '082',
    'Polaris Bank': '076',
    'Providus Bank': '101',
    'Stanbic IBTC Bank': '221',
    'Standard Chartered Bank': '068',
    'Sterling Bank': '232',
    'Union Bank of Nigeria': '032',
    'United Bank for Africa': '033',
    'Unity Bank': '215',
    'Wema Bank': '035',
    'Zenith Bank': '057'
  };

  const code = bankCodes[bankName];
  
  if (!code) {
    // If bank not found, try to fetch from Paystack API
    try {
      const response = await paystackClient.get('/bank');
      const banks = response.data.data;
      const bank = banks.find(b => b.name.toLowerCase().includes(bankName.toLowerCase()));
      return bank ? bank.code : '011'; // Default to First Bank if not found
    } catch (error) {
      console.error('Error fetching bank codes:', error);
      return '011'; // Default to First Bank
    }
  }

  return code;
}

/**
 * Get list of Nigerian banks from Paystack
 */
async function getNigerianBanks() {
  try {
    const response = await paystackClient.get('/bank?currency=NGN');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching banks:', error);
    throw new Error('Failed to fetch bank list');
  }
}

/**
 * Get bank name from bank code (static lookup for reliability)
 */
function getBankNameFromCode(bankCode) {
  const bankNames = {
    '044': 'Access Bank',
    '023': 'Citibank',
    '063': 'Diamond Bank',
    '050': 'Ecobank Nigeria',
    '070': 'Fidelity Bank',
    '011': 'First Bank of Nigeria',
    '214': 'First City Monument Bank',
    '058': 'Guaranty Trust Bank',
    '030': 'Heritage Bank',
    '082': 'Keystone Bank',
    '076': 'Polaris Bank',
    '101': 'Providus Bank',
    '221': 'Stanbic IBTC Bank',
    '068': 'Standard Chartered Bank',
    '232': 'Sterling Bank',
    '032': 'Union Bank of Nigeria',
    '033': 'United Bank for Africa',
    '215': 'Unity Bank',
    '035': 'Wema Bank',
    '057': 'Zenith Bank'
  };
  
  return bankNames[bankCode] || null;
}

/**
 * Resolve account number to get account name
 * @param {string} accountNumber - 10-digit account number
 * @param {string} bankCode - Bank code from Paystack
 * @returns {object} - Account details
 */
async function resolveAccountNumber(accountNumber, bankCode) {
  try {
    const response = await paystackClient.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
    
    if (!response.data.status) {
      throw new Error(response.data.message || 'Could not resolve account name');
    }

    // Get bank name from static lookup (more reliable than additional API call)
    const bankName = getBankNameFromCode(bankCode);

    return {
      accountNumber,
      accountName: response.data.data.account_name,
      bankCode,
      bankName
    };
  } catch (error) {
    console.error('Account resolution error:', error.response?.data || error.message);
    
    if (error.response?.status === 422) {
      throw new Error('Could not resolve account name. Please check the account number and bank code.');
    }
    
    if (error.response?.status === 400) {
      throw new Error('Invalid bank code or account number format');
    }

    throw new Error(error.response?.data?.message || 'Failed to resolve account details');
  }
}

module.exports = {
  calculatePayoutFees,
  initiateWithdrawal,
  processPaystackPayout,
  processStripePayout,
  getNigerianBanks,
  resolveAccountNumber
};
