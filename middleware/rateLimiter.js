const rateLimit = require('express-rate-limit');

// Basic rate limiting: 5 requests per 15 minutes for each IP
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 7, // limit each IP to 5 requests per window
  message: "Too many requests, please try again later."
});
