// server/routes/ledger.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { verifyLedgerIntegrity } = require('../ledger');
const { requireAuth } = require('../middleware/auth');

/**
 * @route   GET /api/ledger
 * @desc    Get ledger entries (filtered for user or full for staff)
 */
router.get('/', requireAuth, (req, res) => {
  const allEntries = DB.getLedgerEntries();

  if (['ADMIN', 'OPERATOR'].includes(req.user.role)) {
    return res.json({
      entries: allEntries,
      count: allEntries.length
    });
  }

  const userAccounts = DB.findAccountsByUserId(req.user.id);
  const accountIds = new Set(userAccounts.map(a => a.id));
  const userEntries = allEntries.filter(e => accountIds.has(e.accountId));

  res.json({
    entries: userEntries,
    count: userEntries.length
  });
});

/**
 * @route   GET /api/ledger/verify-integrity
 * @desc    Cryptographically verify the entire ledger chain (Proof of Non-Tampering)
 */
router.get('/verify-integrity', requireAuth, (req, res) => {
  const entries = DB.getLedgerEntries();
  const verification = verifyLedgerIntegrity(entries);

  // Audit this verification check
  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'LEDGER_INTEGRITY_VERIFICATION',
    entityType: 'LEDGER',
    entityId: 'ALL',
    details: {
      isValid: verification.isValid,
      totalEntries: verification.totalEntries,
      latestHash: verification.latestHash
    },
    ipAddress: req.ip
  });

  res.json({
    timestamp: new Date().toISOString(),
    verifier: req.user.email,
    verifierRole: req.user.role,
    ...verification
  });
});

module.exports = router;
