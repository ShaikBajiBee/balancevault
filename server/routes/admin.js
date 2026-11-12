// server/routes/admin.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/admin/users
 * @desc    Get all users in the system
 */
router.get('/users', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const users = DB.getAllUsers();
  res.json(users);
});

/**
 * @route   POST /api/admin/users/:id/suspend
 * @desc    Suspend a user
 */
router.post('/users/:id/suspend', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const user = DB.findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
  }

  if (user.role === 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden', message: 'Cannot suspend an administrator account.' });
  }

  const updated = DB.updateUser(user.id, { status: 'SUSPENDED' });

  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'USER_SUSPENDED',
    entityType: 'USER',
    entityId: user.id,
    details: { userEmail: user.email },
    ipAddress: req.ip
  });

  res.json({ message: `User ${user.email} suspended.`, user: updated });
});

/**
 * @route   POST /api/admin/users/:id/activate
 * @desc    Reactivate a suspended user
 */
router.post('/users/:id/activate', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const user = DB.findUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
  }

  const updated = DB.updateUser(user.id, { status: 'ACTIVE' });

  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'USER_ACTIVATED',
    entityType: 'USER',
    entityId: user.id,
    details: { userEmail: user.email },
    ipAddress: req.ip
  });

  res.json({ message: `User ${user.email} activated.`, user: updated });
});

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Retrieve system audit logs
 */
router.get('/audit-logs', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const logs = [...DB.getAuditLogs()].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(logs);
});

/**
 * @route   GET /api/admin/metrics
 * @desc    Get aggregate platform metrics
 */
router.get('/metrics', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const users = DB.getAllUsers();
  const accounts = DB.getAllAccounts();
  const transactions = DB.getAllTransactions();
  const ledgerEntries = DB.getLedgerEntries();
  const onboarding = DB.getOnboardingRequests();

  const totalVaultBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const totalVolume = transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const pendingKYC = onboarding.filter(o => o.status === 'PENDING').length;

  res.json({
    metrics: {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'ACTIVE').length,
      totalAccounts: accounts.length,
      frozenAccounts: accounts.filter(a => a.status === 'FROZEN').length,
      totalVaultBalance: Number(totalVaultBalance.toFixed(2)),
      totalTransactions: transactions.length,
      totalTransactionVolume: Number(totalVolume.toFixed(2)),
      ledgerHeight: ledgerEntries.length,
      pendingKYCCount: pendingKYC
    }
  });
});

module.exports = router;
