// server/routes/accounts.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * @route   GET /api/accounts
 * @desc    Get accounts for current user (or all accounts if Admin/Operator)
 */
router.get('/', requireAuth, (req, res) => {
  if (['ADMIN', 'OPERATOR'].includes(req.user.role)) {
    const allAccounts = DB.getAllAccounts().map(acc => {
      const owner = DB.findUserById(acc.userId);
      return {
        ...acc,
        ownerName: owner ? owner.fullName : 'Unknown',
        ownerEmail: owner ? owner.email : 'Unknown'
      };
    });
    return res.json(allAccounts);
  }

  const userAccounts = DB.findAccountsByUserId(req.user.id);
  res.json(userAccounts);
});

/**
 * @route   GET /api/accounts/:id
 * @desc    Get specific account details with ledger entries
 */
router.get('/:id', requireAuth, (req, res) => {
  const account = DB.findAccountById(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Not Found', message: 'Account not found.' });
  }

  // Ensure user owns account or has staff privileges
  if (account.userId !== req.user.id && !['ADMIN', 'OPERATOR'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden', message: 'You cannot view accounts belonging to another user.' });
  }

  const ledgerEntries = DB.getLedgerEntries().filter(e => e.accountId === account.id);
  const owner = DB.findUserById(account.userId);

  res.json({
    ...account,
    ownerName: owner ? owner.fullName : 'Unknown',
    ownerEmail: owner ? owner.email : 'Unknown',
    ledgerEntries
  });
});

/**
 * @route   POST /api/accounts
 * @desc    Create a new account vault for an onboarded user
 */
router.post('/', requireAuth, (req, res) => {
  const { currency = 'USD' } = req.body;

  const user = DB.findUserById(req.user.id);
  if (user.status !== 'ACTIVE' && req.user.role === 'USER') {
    return res.status(403).json({
      error: 'Onboarding Incomplete',
      message: 'You must complete KYC onboarding and receive approval before creating an account vault.'
    });
  }

  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  const newAccount = {
    id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    accountNumber: `BV-${randomDigits}-${currency.toUpperCase()}`,
    currency: currency.toUpperCase(),
    balance: 0.00,
    availableBalance: 0.00,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  DB.createAccount(newAccount);

  DB.appendAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'ACCOUNT_CREATED',
    entityType: 'ACCOUNT',
    entityId: newAccount.id,
    details: { accountNumber: newAccount.accountNumber, currency: newAccount.currency },
    ipAddress: req.ip
  });

  res.status(201).json({
    message: 'Account vault created successfully.',
    account: newAccount
  });
});

/**
 * @route   POST /api/accounts/:id/freeze
 * @desc    Freeze an account (Admin or Compliance Operator)
 */
router.post('/:id/freeze', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const account = DB.findAccountById(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Not Found', message: 'Account not found.' });
  }

  const { reason = 'Compliance hold / suspicious activity review' } = req.body;
  const updated = DB.updateAccountStatus(account.id, 'FROZEN');

  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'ACCOUNT_FROZEN',
    entityType: 'ACCOUNT',
    entityId: account.id,
    details: { reason, previousStatus: account.status },
    ipAddress: req.ip
  });

  res.json({
    message: `Account ${account.accountNumber} has been frozen.`,
    account: updated
  });
});

/**
 * @route   POST /api/accounts/:id/unfreeze
 * @desc    Unfreeze an account (Admin only)
 */
router.post('/:id/unfreeze', requireAuth, requireRole(['ADMIN']), (req, res) => {
  const account = DB.findAccountById(req.params.id);
  if (!account) {
    return res.status(404).json({ error: 'Not Found', message: 'Account not found.' });
  }

  const updated = DB.updateAccountStatus(account.id, 'ACTIVE');

  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'ACCOUNT_UNFROZEN',
    entityType: 'ACCOUNT',
    entityId: account.id,
    details: { previousStatus: account.status },
    ipAddress: req.ip
  });

  res.json({
    message: `Account ${account.accountNumber} has been restored to active status.`,
    account: updated
  });
});

module.exports = router;
