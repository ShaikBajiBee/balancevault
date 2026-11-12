// server/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'balancevault_super_secret_jwt_key_2026_challenge',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  ADMIN_BOOTSTRAP_TOKEN: process.env.ADMIN_BOOTSTRAP_TOKEN || 'BV_BOOTSTRAP_SECURE_TOKEN_2026',
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 200,          // max requests per window
  TRANSFER_RATE_LIMIT_MAX: 30            // max money movements per window
};
