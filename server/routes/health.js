// server/routes/health.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { verifyLedgerIntegrity } = require('../ledger');

/**
 * @route   GET /health
 * @desc    Kubernetes / Docker Liveness probe
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'BalanceVault-API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /ready
 * @desc    Kubernetes / Platform Readiness probe
 */
router.get('/ready', (req, res) => {
  try {
    // Check DB access
    const usersCount = DB.getAllUsers().length;
    // Check Ledger state
    const entries = DB.getLedgerEntries();
    const ledgerCheck = verifyLedgerIntegrity(entries);

    if (!ledgerCheck.isValid) {
      return res.status(503).json({
        status: 'DEGRADED',
        reason: 'Ledger integrity check failed',
        details: ledgerCheck
      });
    }

    res.status(200).json({
      status: 'READY',
      checks: {
        database: 'CONNECTED',
        usersRegistered: usersCount,
        ledgerIntegrity: 'VALIDATED',
        ledgerHeight: entries.length,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'NOT_READY',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
