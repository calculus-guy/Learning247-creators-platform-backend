const rateLimit = require('express-rate-limit');

// Basic rate limiting: 100 requests per 15 minutes for each IP
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});