// server/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config');
const rateLimiter = require('./middleware/rateLimiter');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const transfersRoutes = require('./routes/transfers');
const ledgerRoutes = require('./routes/ledger');
const onboardingRoutes = require('./routes/onboarding');
const adminRoutes = require('./routes/admin');

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter()); // Global rate limiting protection

// Serve static frontend UI
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount API routes
app.use('/', healthRoutes); // /health and /ready
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/admin', adminRoutes);

// Fallback for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred.'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`   BalanceVault Platform is running on port ${PORT}`);
    console.log(`   Live URL: http://localhost:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   Readiness Check: http://localhost:${PORT}/ready`);
    console.log(`====================================================`);
  });
}

module.exports = app;
