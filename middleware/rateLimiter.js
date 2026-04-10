const rateLimit = require('express-rate-limit');

// Normalize IPv4-mapped IPv6 addresses to prevent shared bucket issue (CVE-2026-30827)
const normalizeIp = (req) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection.remoteAddress;
  return ip ? ip.replace(/^::ffff:/, '') : 'unknown';
};

// Basic rate limiting: 100 requests per 15 minutes per real IP
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
  keyGenerator: normalizeIp,
  validate: { xForwardedForHeader: false }
});
