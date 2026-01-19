const { Sequelize } = require('sequelize');

/**
 * Database Transaction Service
 * 
 * Provides production-grade transaction management for financial operations with:
 * - Row-level locking to prevent race conditions
 * - Automatic deadlock detection and retry with exponential backoff
 * - Proper transaction rollback mechanisms
 * - Transaction boundary management
 * - Comprehensive error handling and logging
 */

class DatabaseTransactionService {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.maxRetries = 3;
    this.baseDelay = 100; // Base delay in milliseconds
    this.maxDelay = 5000; // Maximum delay in milliseconds
  }

  /**
   * Execute a financial operation within a database transaction with retry logic
   * @param {Function} operation - The operation to execute within the transaction
   * @param {Object} options - Transaction options
   * @param {string} options.operationType - Type of operation for logging
   * @param {string} options.userId - User ID for logging
   * @param {string} options.isolationLevel - Transaction isolation level
   * @returns {Promise<any>} Result of the operation
   */
  async executeWithTransaction(operation, options = {}) {
    const {
      operationType = 'financial_operation',
      userId = null,
      isolationLevel = Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    } = options;

    let attempt = 0;
    let lastError = null;

    while (attempt < this.maxRetries) {
      attempt++;
      const transaction = await this.sequelize.transaction({
        isolationLevel,
        logging: (sql) => {
          console.log(`[Transaction ${operationType}] Attempt ${attempt}: ${sql}`);
        }
      });

      try {
        console.log(`[Transaction Service] Starting ${operationType} (attempt ${attempt}/${this.maxRetries}) for user ${userId}`);
        
        // Execute the operation within the transaction
        const result = await operation(transaction);
        
        // Commit the transaction
        await transaction.commit();
        
        console.log(`[Transaction Service] Successfully completed ${operationType} for user ${userId}`);
        return result;

      } catch (error) {
        // Rollback the transaction
        try {
          await transaction.rollback();
          console.log(`[Transaction Service] Rolled back transaction for ${operationType}`);
        } catch (rollbackError) {
          console.error(`[Transaction Service] Error during rollback:`, rollbackError);
        }

        lastError = error;
        
        // Check if this is a deadlock or serialization failure
        if (this.isRetryableError(error)) {
          console.warn(`[Transaction Service] Retryable error on attempt ${attempt}/${this.maxRetries} for ${operationType}:`, error.message);
          
          if (attempt < this.maxRetries) {
            const delay = this.calculateDelay(attempt);
            console.log(`[Transaction Service] Retrying in ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
        }

        // Non-retryable error or max retries exceeded
        console.error(`[Transaction Service] Failed ${operationType} after ${attempt} attempts:`, error);
        throw new DatabaseTransactionError(
          `Transaction failed after ${attempt} attempts: ${error.message}`,
          error,
          operationType,
          attempt
        );
      }
    }

    // This should never be reached, but just in case
    throw new DatabaseTransactionError(
      `Transaction failed after ${this.maxRetries} attempts`,
      lastError,
      operationType,
      this.maxRetries
    );
  }

  /**
   * Execute a wallet operation with row-level locking
   * @param {string} userId - User ID
   * @param {string} currency - Currency code
   * @param {Function} operation - Operation to execute with locked wallet
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Result of the operation
   */
  async executeWalletOperation(userId, currency, operation, options = {}) {
    const operationType = options.operationType || 'wallet_operation';
    
    return this.executeWithTransaction(async (transaction) => {
      // Lock the wallet row to prevent concurrent modifications
      const wallet = await this.lockWallet(userId, currency, transaction);
      
      if (!wallet) {
        throw new WalletNotFoundError(`Wallet not found for user ${userId} and currency ${currency}`);
      }

      // Execute the operation with the locked wallet
      const result = await operation(wallet, transaction);
      
      // The wallet will be automatically unlocked when the transaction commits
      return result;
    }, {
      operationType,
      userId,
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.REPEATABLE_READ
    });
  }

  /**
   * Lock a wallet for exclusive access within a transaction
   * @param {string} userId - User ID
   * @param {string} currency - Currency code
   * @param {Transaction} transaction - Database transaction
   * @returns {Promise<Object>} Locked wallet object
   */
  async lockWallet(userId, currency, transaction) {
    const WalletAccount = this.sequelize.models.WalletAccount || 
                         this.sequelize.model('WalletAccount');

    // Use SELECT FOR UPDATE to lock the specific wallet row
    const wallet = await WalletAccount.findOne({
      where: {
        user_id: userId,
        currency: currency
      },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (wallet) {
      console.log(`[Transaction Service] Locked wallet for user ${userId}, currency ${currency}`);
    }

    return wallet;
  }

  /**
   * Execute multiple wallet operations atomically
   * @param {Array} operations - Array of wallet operations
   * @param {Object} options - Transaction options
   * @returns {Promise<Array>} Results of all operations
   */
  async executeMultiWalletOperation(operations, options = {}) {
    const operationType = options.operationType || 'multi_wallet_operation';
    
    return this.executeWithTransaction(async (transaction) => {
      const results = [];
      const lockedWallets = new Map();

      try {
        // Lock all required wallets first to prevent deadlocks
        for (const op of operations) {
          const walletKey = `${op.userId}-${op.currency}`;
          if (!lockedWallets.has(walletKey)) {
            const wallet = await this.lockWallet(op.userId, op.currency, transaction);
            if (!wallet) {
              throw new WalletNotFoundError(`Wallet not found for user ${op.userId} and currency ${op.currency}`);
            }
            lockedWallets.set(walletKey, wallet);
          }
        }

        // Execute all operations with locked wallets
        for (const op of operations) {
          const walletKey = `${op.userId}-${op.currency}`;
          const wallet = lockedWallets.get(walletKey);
          const result = await op.operation(wallet, transaction);
          results.push(result);
        }

        return results;
      } catch (error) {
        console.error(`[Transaction Service] Multi-wallet operation failed:`, error);
        throw error;
      }
    }, {
      operationType,
      userId: operations.map(op => op.userId).join(','),
      isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });
  }

  /**
   * Create a new wallet account within a transaction
   * @param {string} userId - User ID
   * @param {string} currency - Currency code
   * @param {Transaction} transaction - Database transaction
   * @returns {Promise<Object>} Created wallet
   */
  async createWalletInTransaction(userId, currency, transaction) {
    const WalletAccount = this.sequelize.models.WalletAccount || 
                         this.sequelize.model('WalletAccount');

    const wallet = await WalletAccount.create({
      user_id: userId,
      currency: currency,
      balance_available: 0,
      balance_pending: 0
    }, { transaction });

    console.log(`[Transaction Service] Created wallet for user ${userId}, currency ${currency}`);
    return wallet;
  }

  /**
   * Update wallet balance within a transaction
   * @param {Object} wallet - Wallet object
   * @param {number} availableChange - Change in available balance (in smallest currency unit)
   * @param {number} pendingChange - Change in pending balance (in smallest currency unit)
   * @param {Transaction} transaction - Database transaction
   * @returns {Promise<Object>} Updated wallet
   */
  async updateWalletBalance(wallet, availableChange, pendingChange, transaction) {
    // Ensure all values are numbers (BIGINT might be returned as strings)
    const currentAvailable = parseInt(wallet.balance_available) || 0;
    const currentPending = parseInt(wallet.balance_pending) || 0;
    const availableChangeNum = parseInt(availableChange) || 0;
    const pendingChangeNum = parseInt(pendingChange) || 0;
    
    const newAvailable = currentAvailable + availableChangeNum;
    const newPending = currentPending + pendingChangeNum;

    // Validate that balances don't go negative
    if (newAvailable < 0) {
      throw new InsufficientFundsError(
        `Insufficient available balance. Current: ${currentAvailable}, Required: ${Math.abs(availableChangeNum)}`
      );
    }

    if (newPending < 0) {
      throw new InsufficientFundsError(
        `Insufficient pending balance. Current: ${currentPending}, Required: ${Math.abs(pendingChangeNum)}`
      );
    }

    // Update the wallet
    await wallet.update({
      balance_available: newAvailable,
      balance_pending: newPending,
      updated_at: new Date()
    }, { transaction });

    console.log(`[Transaction Service] Updated wallet balance - Available: ${currentAvailable} -> ${newAvailable}, Pending: ${currentPending} -> ${newPending}`);
    
    return wallet;
  }

  /**
   * Check if an error is retryable (deadlock, serialization failure, etc.)
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   */
  isRetryableError(error) {
    if (!error.original) return false;

    const errorCode = error.original.code;
    const errorMessage = error.original.message || '';

    // PostgreSQL error codes for retryable conditions
    const retryableCodes = [
      '40001', // serialization_failure
      '40P01', // deadlock_detected
      '25P02', // in_failed_sql_transaction (sometimes retryable)
      '08006', // connection_failure
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08001'  // sqlclient_unable_to_establish_sqlconnection
    ];

    // Check for specific error patterns
    const retryablePatterns = [
      /deadlock detected/i,
      /could not serialize access/i,
      /concurrent update/i,
      /connection.*lost/i,
      /connection.*closed/i,
      /connection.*reset/i
    ];

    return retryableCodes.includes(errorCode) || 
           retryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Calculate exponential backoff delay with jitter
   * @param {number} attempt - Current attempt number (1-based)
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt) {
    // Exponential backoff: baseDelay * 2^(attempt-1) + random jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * this.baseDelay;
    const totalDelay = Math.min(exponentialDelay + jitter, this.maxDelay);
    
    return Math.floor(totalDelay);
  }

  /**
   * Sleep for the specified number of milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get transaction statistics for monitoring
   * @returns {Object} Transaction statistics
   */
  getStats() {
    return {
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay,
      maxDelay: this.maxDelay,
      // Add more stats as needed
    };
  }
}

/**
 * Custom error classes for transaction service
 */
class DatabaseTransactionError extends Error {
  constructor(message, originalError, operationType, attempts) {
    super(message);
    this.name = 'DatabaseTransactionError';
    this.originalError = originalError;
    this.operationType = operationType;
    this.attempts = attempts;
    this.isRetryable = false;
  }
}

class WalletNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WalletNotFoundError';
    this.isRetryable = false;
  }
}

class InsufficientFundsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InsufficientFundsError';
    this.isRetryable = false;
  }
}

module.exports = {
  DatabaseTransactionService,
  DatabaseTransactionError,
  WalletNotFoundError,
  InsufficientFundsError
};