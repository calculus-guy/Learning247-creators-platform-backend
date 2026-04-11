const rateLimit = require('express-rate-limit');

const normalizeIp = (req) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection.remoteAddress;
  return ip ? ip.replace(/^::ffff:/, '') : 'unknown';
};

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  keyGenerator: normalizeIp,
  validate: { keyGenerator: false, xForwardedForHeader: false }
});
