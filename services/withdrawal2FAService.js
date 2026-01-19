const { sendWithdrawalOTP } = require('../utils/email');

/**
 * Withdrawal Two-Factor Authentication Service
 * 
 * Provides email-based 2FA for withdrawal confirmations:
 * - OTP generation and storage
 * - Email delivery via existing nodemailer setup
 * - OTP verification and expiration
 * - Threshold-based 2FA requirements
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

class Withdrawal2FAService {
  constructor() {
    // 2FA configuration
    this.config = {
      // Thresholds for requiring 2FA (amounts above these require email confirmation)
      thresholds: {
        NGN: 100000,  // ₦100,000 (~$120)
        USD: 500      // $500
      },
      
      // OTP settings
      otp: {
        length: 6,                    // 6-digit OTP
        expiryMinutes: 10,           // 10 minutes expiry
        maxAttempts: 3,              // Max 3 verification attempts
        resendCooldown: 2 * 60 * 1000 // 2 minutes between resends
      },
      
      // User tier multipliers for thresholds
      tierMultipliers: {
        default: 1,    // Normal thresholds
        vip: 2,        // 2x higher thresholds
        business: 5    // 5x higher thresholds
      }
    };

    // In-memory stores (in production, use Redis)
    this.pendingWithdrawals = new Map();  // Pending withdrawal requests
    this.otpCodes = new Map();           // Active OTP codes
    this.verificationAttempts = new Map(); // Failed verification attempts
    this.lastResendTime = new Map();     // Last OTP resend timestamps
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if withdrawal requires 2FA
   * @param {number} amount - Withdrawal amount
   * @param {string} currency - Currency code
   * @param {string} userTier - User tier (default, vip, business)
   * @returns {boolean} True if 2FA is required
   */
  requires2FA(amount, currency, userTier = 'default') {
    const baseThreshold = this.config.thresholds[currency] || this.config.thresholds.USD;
    const multiplier = this.config.tierMultipliers[userTier] || 1;
    const threshold = baseThreshold * multiplier;
    
    return amount >= threshold;
  }

  /**
   * Initiate 2FA for withdrawal
   * @param {Object} withdrawalData - Withdrawal request data
   * @param {Object} user - User object
   * @returns {Promise<Object>} 2FA initiation result
   */
  async initiate2FA(withdrawalData, user) {
    try {
      const { amount, currency, bankAccount, reference } = withdrawalData;
      
      // Debug logging to see what's in the user object
      console.log(`[Withdrawal 2FA] User object received:`, JSON.stringify(user, null, 2));
      
      const { id: userId, email, firstname } = user;

      // Validate required user fields
      if (!email) {
        throw new Error('User email is required for 2FA');
      }
      
      if (!firstname) {
        console.log(`[Withdrawal 2FA] Warning: firstname not available for user ${userId}, using fallback`);
      }

      console.log(`[Withdrawal 2FA] Initiating 2FA for user ${userId} (${email}): ${amount} ${currency}`);

      // Generate withdrawal ID and OTP
      const withdrawalId = this.generateWithdrawalId();
      const otp = this.generateOTP();
      
      // Store pending withdrawal
      const pendingWithdrawal = {
        id: withdrawalId,
        userId,
        amount,
        currency,
        bankAccount,
        reference,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.otp.expiryMinutes * 60 * 1000),
        status: 'pending_2fa'
      };
      
      this.pendingWithdrawals.set(withdrawalId, pendingWithdrawal);

      // Store OTP
      const otpData = {
        code: otp,
        withdrawalId,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.otp.expiryMinutes * 60 * 1000),
        attempts: 0
      };
      
      this.otpCodes.set(withdrawalId, otpData);

      // Send OTP email
      await sendWithdrawalOTP(
        email,
        firstname || 'User', // Fallback if firstname is not available
        otp,
        amount,
        currency,
        this.formatBankAccount(bankAccount)
      );

      console.log(`[Withdrawal 2FA] OTP sent to ${email} for withdrawal ${withdrawalId}`);

      return {
        success: true,
        withdrawalId,
        message: `Confirmation code sent to ${this.maskEmail(email)}`,
        expiresIn: this.config.otp.expiryMinutes * 60, // seconds
        resendAvailable: true
      };
    } catch (error) {
      console.error('[Withdrawal 2FA] Initiation error:', error);
      throw new Error('Failed to initiate withdrawal confirmation');
    }
  }

  /**
   * Verify OTP and complete withdrawal
   * @param {string} withdrawalId - Withdrawal ID
   * @param {string} code - OTP code provided by user
   * @param {number} userId - User ID for security check
   * @returns {Promise<Object>} Verification result
   */
  async verifyOTP(withdrawalId, code, userId) {
    try {
      console.log(`[Withdrawal 2FA] Verifying OTP for withdrawal ${withdrawalId}`);

      // Get OTP data
      const otpData = this.otpCodes.get(withdrawalId);
      if (!otpData) {
        return {
          success: false,
          message: 'Invalid or expired confirmation code',
          error: 'otp_not_found'
        };
      }

      // Check if OTP belongs to the user
      if (otpData.userId !== userId) {
        return {
          success: false,
          message: 'Invalid confirmation code',
          error: 'user_mismatch'
        };
      }

      // Check if OTP has expired
      if (Date.now() > otpData.expiresAt) {
        this.otpCodes.delete(withdrawalId);
        this.pendingWithdrawals.delete(withdrawalId);
        return {
          success: false,
          message: 'Confirmation code has expired. Please request a new one.',
          error: 'otp_expired'
        };
      }

      // Check attempt limit
      if (otpData.attempts >= this.config.otp.maxAttempts) {
        this.otpCodes.delete(withdrawalId);
        this.pendingWithdrawals.delete(withdrawalId);
        return {
          success: false,
          message: 'Too many failed attempts. Please start a new withdrawal.',
          error: 'max_attempts_exceeded'
        };
      }

      // Verify OTP code
      if (otpData.code !== code.toString()) {
        otpData.attempts += 1;
        
        const remainingAttempts = this.config.otp.maxAttempts - otpData.attempts;
        
        return {
          success: false,
          message: `Invalid confirmation code. ${remainingAttempts} attempts remaining.`,
          error: 'invalid_code',
          remainingAttempts
        };
      }

      // OTP is valid - get withdrawal data
      const withdrawalData = this.pendingWithdrawals.get(withdrawalId);
      if (!withdrawalData) {
        return {
          success: false,
          message: 'Withdrawal request not found',
          error: 'withdrawal_not_found'
        };
      }

      // Clean up OTP and pending withdrawal
      this.otpCodes.delete(withdrawalId);
      this.pendingWithdrawals.delete(withdrawalId);
      this.verificationAttempts.delete(withdrawalId);

      console.log(`[Withdrawal 2FA] OTP verified successfully for withdrawal ${withdrawalId}`);

      return {
        success: true,
        message: 'Withdrawal confirmed successfully',
        withdrawalData
      };
    } catch (error) {
      console.error('[Withdrawal 2FA] Verification error:', error);
      return {
        success: false,
        message: 'Verification failed. Please try again.',
        error: 'verification_error'
      };
    }
  }

  /**
   * Resend OTP for withdrawal
   * @param {string} withdrawalId - Withdrawal ID
   * @param {number} userId - User ID for security check
   * @param {Object} user - User object for email
   * @returns {Promise<Object>} Resend result
   */
  async resendOTP(withdrawalId, userId, user) {
    try {
      console.log(`[Withdrawal 2FA] Resending OTP for withdrawal ${withdrawalId}`);

      // Check resend cooldown
      const lastResend = this.lastResendTime.get(withdrawalId);
      if (lastResend && (Date.now() - lastResend) < this.config.otp.resendCooldown) {
        const remainingTime = Math.ceil((this.config.otp.resendCooldown - (Date.now() - lastResend)) / 1000);
        return {
          success: false,
          message: `Please wait ${remainingTime} seconds before requesting a new code`,
          error: 'resend_cooldown'
        };
      }

      // Get pending withdrawal
      const withdrawalData = this.pendingWithdrawals.get(withdrawalId);
      if (!withdrawalData || withdrawalData.userId !== userId) {
        return {
          success: false,
          message: 'Withdrawal request not found',
          error: 'withdrawal_not_found'
        };
      }

      // Check if withdrawal has expired
      if (Date.now() > withdrawalData.expiresAt) {
        this.pendingWithdrawals.delete(withdrawalId);
        this.otpCodes.delete(withdrawalId);
        return {
          success: false,
          message: 'Withdrawal request has expired. Please start a new withdrawal.',
          error: 'withdrawal_expired'
        };
      }

      // Generate new OTP
      const newOTP = this.generateOTP();
      
      // Update OTP data
      const otpData = {
        code: newOTP,
        withdrawalId,
        userId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.otp.expiryMinutes * 60 * 1000),
        attempts: 0
      };
      
      this.otpCodes.set(withdrawalId, otpData);
      this.lastResendTime.set(withdrawalId, Date.now());

      // Send new OTP email
      await sendWithdrawalOTP(
        user.email,
        user.firstname,
        newOTP,
        withdrawalData.amount,
        withdrawalData.currency,
        this.formatBankAccount(withdrawalData.bankAccount)
      );

      console.log(`[Withdrawal 2FA] New OTP sent to ${user.email} for withdrawal ${withdrawalId}`);

      return {
        success: true,
        message: `New confirmation code sent to ${this.maskEmail(user.email)}`,
        expiresIn: this.config.otp.expiryMinutes * 60
      };
    } catch (error) {
      console.error('[Withdrawal 2FA] Resend error:', error);
      return {
        success: false,
        message: 'Failed to resend confirmation code',
        error: 'resend_error'
      };
    }
  }

  /**
   * Cancel pending withdrawal
   * @param {string} withdrawalId - Withdrawal ID
   * @param {number} userId - User ID for security check
   * @returns {Object} Cancellation result
   */
  cancelWithdrawal(withdrawalId, userId) {
    const withdrawalData = this.pendingWithdrawals.get(withdrawalId);
    
    if (!withdrawalData || withdrawalData.userId !== userId) {
      return {
        success: false,
        message: 'Withdrawal request not found',
        error: 'withdrawal_not_found'
      };
    }

    // Clean up
    this.pendingWithdrawals.delete(withdrawalId);
    this.otpCodes.delete(withdrawalId);
    this.verificationAttempts.delete(withdrawalId);
    this.lastResendTime.delete(withdrawalId);

    console.log(`[Withdrawal 2FA] Withdrawal ${withdrawalId} cancelled by user ${userId}`);

    return {
      success: true,
      message: 'Withdrawal cancelled successfully'
    };
  }

  /**
   * Get withdrawal status
   * @param {string} withdrawalId - Withdrawal ID
   * @param {number} userId - User ID for security check
   * @returns {Object|null} Withdrawal status
   */
  getWithdrawalStatus(withdrawalId, userId) {
    const withdrawalData = this.pendingWithdrawals.get(withdrawalId);
    const otpData = this.otpCodes.get(withdrawalId);
    
    if (!withdrawalData || withdrawalData.userId !== userId) {
      return null;
    }

    return {
      withdrawalId,
      amount: withdrawalData.amount,
      currency: withdrawalData.currency,
      status: withdrawalData.status,
      expiresAt: withdrawalData.expiresAt,
      otpExpiresAt: otpData?.expiresAt,
      remainingAttempts: otpData ? (this.config.otp.maxAttempts - otpData.attempts) : 0
    };
  }

  /**
   * Generate withdrawal ID
   * @returns {string} Unique withdrawal ID
   */
  generateWithdrawalId() {
    return `wd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate OTP code
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Format bank account for display
   * @param {string|Object} bankAccount - Bank account info
   * @returns {string} Formatted bank account
   */
  formatBankAccount(bankAccount) {
    if (typeof bankAccount === 'string') {
      return bankAccount;
    }
    
    if (bankAccount && bankAccount.accountNumber) {
      // Handle NGN format (bankCode)
      if (bankAccount.bankCode) {
        return `${bankAccount.accountNumber} (${bankAccount.accountName || 'Bank Account'})`;
      }
      // Handle USD format (bankName)
      if (bankAccount.bankName) {
        return `${bankAccount.accountNumber} (${bankAccount.bankName})`;
      }
      // Fallback
      return `${bankAccount.accountNumber} (${bankAccount.accountName || 'Bank Account'})`;
    }
    
    return 'Bank Account';
  }

  /**
   * Mask email for display
   * @param {string} email - Email address
   * @returns {string} Masked email
   */
  maskEmail(email) {
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Start cleanup interval for expired data
   */
  startCleanupInterval() {
    // Clean up expired data every 5 minutes
    setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000);

    // Initial cleanup after 1 minute
    setTimeout(() => {
      this.cleanupExpiredData();
    }, 60 * 1000);
  }

  /**
   * Clean up expired withdrawals and OTPs
   */
  cleanupExpiredData() {
    const now = Date.now();
    let cleanedWithdrawals = 0;
    let cleanedOTPs = 0;

    // Clean expired pending withdrawals
    for (const [withdrawalId, data] of this.pendingWithdrawals.entries()) {
      if (now > data.expiresAt) {
        this.pendingWithdrawals.delete(withdrawalId);
        cleanedWithdrawals++;
      }
    }

    // Clean expired OTPs
    for (const [withdrawalId, data] of this.otpCodes.entries()) {
      if (now > data.expiresAt) {
        this.otpCodes.delete(withdrawalId);
        cleanedOTPs++;
      }
    }

    // Clean old resend timestamps
    for (const [withdrawalId, timestamp] of this.lastResendTime.entries()) {
      if (now - timestamp > 24 * 60 * 60 * 1000) { // 24 hours old
        this.lastResendTime.delete(withdrawalId);
      }
    }

    if (cleanedWithdrawals > 0 || cleanedOTPs > 0) {
      console.log(`[Withdrawal 2FA] Cleanup completed - Withdrawals: ${cleanedWithdrawals}, OTPs: ${cleanedOTPs}`);
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Service statistics
   */
  getStatistics() {
    return {
      pendingWithdrawals: this.pendingWithdrawals.size,
      activeOTPs: this.otpCodes.size,
      config: this.config
    };
  }
}

module.exports = Withdrawal2FAService;