const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { walletOperations, transfers } = require('../middleware/financialRateLimiter');
const fraudDetectionMiddleware = require('../middleware/fraudDetectionMiddleware');
const {
  initializeWallets,
  getAllBalances,
  getCurrencyBalance,
  creditWallet,
  transferBetweenWallets,
  getRequiredGateway,
  validateGatewayPairing,
  getCurrencyBalanceWithHistory,
  getAllBalancesDetailed,
  getFilteredTransactions,
  getBalanceAnalytics,
  getBalanceSummary
} = require('../controllers/multiCurrencyWalletController');

/**
 * Multi-Currency Wallet Routes
 * 
 * All routes require authentication and provide multi-currency wallet functionality
 * with strict currency isolation and gateway routing enforcement.
 */

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/multi-wallet/initialize
 * @desc    Initialize multi-currency wallets for user (NGN and USD)
 * @access  Private
 */
router.post('/initialize', walletOperations, fraudDetectionMiddleware.walletOperations, initializeWallets);

/**
 * @route   GET /api/multi-wallet/balances
 * @desc    Get all wallet balances for authenticated user
 * @access  Private
 */
router.get('/balances', getAllBalances);

/**
 * @route   GET /api/multi-wallet/balance/:currency/history
 * @desc    Get balance for specific currency with transaction history
 * @access  Private
 * @param   {string} currency - Currency code (NGN/USD)
 * @query   {string} startDate - Start date (ISO string)
 * @query   {string} endDate - End date (ISO string)
 * @query   {number} limit - Results limit (default: 50)
 * @query   {number} offset - Results offset (default: 0)
 */
router.get('/balance/:currency/history', getCurrencyBalanceWithHistory);

/**
 * @route   GET /api/multi-wallet/balances/detailed
 * @desc    Get all currency balances with optional transaction history
 * @access  Private
 * @query   {string} currencies - Comma-separated currency codes (optional)
 * @query   {boolean} includeHistory - Include transaction history
 * @query   {number} historyLimit - Limit for transaction history (default: 10)
 */
router.get('/balances/detailed', getAllBalancesDetailed);

/**
 * @route   GET /api/multi-wallet/transactions
 * @desc    Get filtered transaction history across currencies
 * @access  Private
 * @query   {string} currency - Currency filter (optional)
 * @query   {string} types - Comma-separated transaction types (optional)
 * @query   {string} startDate - Start date filter
 * @query   {string} endDate - End date filter
 * @query   {number} limit - Results limit (default: 50)
 * @query   {number} offset - Results offset (default: 0)
 */
router.get('/transactions', getFilteredTransactions);

/**
 * @route   GET /api/multi-wallet/analytics/:currency
 * @desc    Get balance analytics for a currency
 * @access  Private
 * @param   {string} currency - Currency code (NGN/USD)
 * @query   {string} period - Period for analytics (day/week/month, default: day)
 * @query   {number} periods - Number of periods to analyze (default: 30)
 */
router.get('/analytics/:currency', getBalanceAnalytics);

/**
 * @route   GET /api/multi-wallet/summary
 * @desc    Get balance summary across all currencies
 * @access  Private
 */
router.get('/summary', getBalanceSummary);

/**
 * @route   GET /api/multi-wallet/balance/:currency
 * @desc    Get balance for specific currency (NGN or USD)
 * @access  Private
 * @param   {string} currency - Currency code (NGN/USD)
 */
router.get('/balance/:currency', getCurrencyBalance);

/**
 * @route   POST /api/multi-wallet/credit
 * @desc    Credit wallet with earnings or refunds
 * @access  Private
 * @body    {string} currency - Currency code
 * @body    {number} amount - Amount to credit
 * @body    {string} reference - Transaction reference
 * @body    {string} description - Transaction description
 * @body    {object} metadata - Additional metadata
 */
router.post('/credit', walletOperations, fraudDetectionMiddleware.walletOperations, creditWallet);

/**
 * @route   POST /api/multi-wallet/transfer
 * @desc    Transfer funds between wallets (same currency only)
 * @access  Private
 * @body    {number} toUserId - Recipient user ID
 * @body    {string} currency - Currency code
 * @body    {number} amount - Amount to transfer
 * @body    {string} description - Transfer description
 */
router.post('/transfer', transfers, fraudDetectionMiddleware.transfers, transferBetweenWallets);

/**
 * @route   GET /api/multi-wallet/gateway/:currency
 * @desc    Get required payment gateway for currency
 * @access  Private
 * @param   {string} currency - Currency code (NGN/USD)
 */
router.get('/gateway/:currency', getRequiredGateway);

/**
 * @route   POST /api/multi-wallet/validate-gateway
 * @desc    Validate currency-gateway pairing
 * @access  Private
 * @body    {string} currency - Currency code
 * @body    {string} gateway - Gateway name
 */
router.post('/validate-gateway', validateGatewayPairing);

/**
 * @route   GET /api/multi-wallet/stats
 * @desc    Get wallet statistics for authenticated user (deprecated - use /summary)
 * @access  Private
 */
router.get('/stats', getBalanceSummary);

module.exports = router;