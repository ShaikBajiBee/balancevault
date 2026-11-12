// server/middleware/rateLimiter.js
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } = require('../config');

// In-memory sliding window rate-limiter with Redis protocol compatibility
const requestCounts = new Map();

function rateLimiter(options = {}) {
  const windowMs = options.windowMs || RATE_LIMIT_WINDOW_MS;
  const max = options.max || RATE_LIMIT_MAX_REQUESTS;
  const message = options.message || 'Too many requests from this IP, please try again later.';

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = requestCounts.get(ip);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      requestCounts.set(ip, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.startTime + windowMs).toISOString());

    if (record.count > max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfterMs: (record.startTime + windowMs) - now
      });
    }

    next();
  };
}

module.exports = rateLimiter;
