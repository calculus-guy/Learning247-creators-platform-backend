const sequelize = require('../config/db');

/**
 * Database Transaction Service
 * 
 * Provides helper functions for managing Sequelize transactions
 * Ensures atomicity and automatic rollback on failure
 */

class DatabaseTransactionService {
  /**
   * Execute a function within a managed transaction
   * Automatically commits on success or rolls back on error
   * 
   * @param {Function} callback - Async function to execute within transaction
   * @returns {Promise<any>} - Result from callback function
   * 
   * @example
   * const result = await executeWithTransaction(async (t) => {
   *   const user = await User.create({ name: 'John' }, { transaction: t });
   *   const wallet = await Wallet.create({ userId: user.id }, { transaction: t });
   *   return { user, wallet };
   * });
   */
  async executeWithTransaction(callback) {
    const transaction = await sequelize.transaction();

    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Execute multiple operations atomically
   * All operations succeed or all fail
   * 
   * @param {Array<Function>} operations - Array of async functions
   * @returns {Promise<Array>} - Array of results
   * 
   * @example
   * const results = await executeAtomic([
   *   async (t) => User.create({ name: 'John' }, { transaction: t }),
   *   async (t) => Wallet.create({ userId: 1 }, { transaction: t })
   * ]);
   */
  async executeAtomic(operations) {
    return this.executeWithTransaction(async (t) => {
      const results = [];
      for (const operation of operations) {
        const result = await operation(t);
        results.push(result);
      }
      return results;
    });
  }

  /**
   * Execute with retry logic
   * Retries transaction on deadlock or serialization errors
   * 
   * @param {Function} callback - Async function to execute
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @returns {Promise<any>} - Result from callback
   */
  async executeWithRetry(callback, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeWithTransaction(callback);
      } catch (error) {
        lastError = error;

        // Retry on deadlock or serialization errors
        const isRetryable = 
          error.name === 'SequelizeDatabaseError' &&
          (error.message.includes('deadlock') || 
           error.message.includes('serialization') ||
           error.message.includes('could not serialize'));

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Check if currently in a transaction
   * 
   * @param {Object} transaction - Transaction object to check
   * @returns {boolean}
   */
  isInTransaction(transaction) {
    return transaction && !transaction.finished;
  }

  /**
   * Get a new transaction instance
   * Use this when you need manual control over commit/rollback
   * 
   * @returns {Promise<Transaction>}
   * 
   * @example
   * const t = await getTransaction();
   * try {
   *   await User.create({ name: 'John' }, { transaction: t });
   *   await t.commit();
   * } catch (error) {
   *   await t.rollback();
   *   throw error;
   * }
   */
  async getTransaction() {
    return sequelize.transaction();
  }
}

module.exports = new DatabaseTransactionService();
