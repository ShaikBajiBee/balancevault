// server/routes/transfers.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { requireAuth } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const { TRANSFER_RATE_LIMIT_MAX } = require('../config');

/**
 * @route   POST /api/transfers
 * @desc    Execute money movement with double-entry cryptographic ledger posting
 */
router.post('/', requireAuth, rateLimiter({ max: TRANSFER_RATE_LIMIT_MAX, message: 'Transfer rate limit exceeded. Please wait a few moments.' }), (req, res) => {
  try {
    const { sourceAccountId, destinationAccountNumber, amount, description, idempotencyKey } = req.body;

    // Check idempotency
    if (idempotencyKey) {
      const existingTx = DB.findTransactionByIdempotency(idempotencyKey);
      if (existingTx) {
        return res.status(200).json({
          message: 'Transfer already processed (Idempotency match).',
          transaction: existingTx
        });
      }
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Transfer amount must be a positive number.' });
    }

    if (!sourceAccountId || !destinationAccountNumber) {
      return res.status(400).json({ error: 'Validation Error', message: 'Source account and destination account number are required.' });
    }

    const sourceAccount = DB.findAccountById(sourceAccountId);
    if (!sourceAccount) {
      return res.status(404).json({ error: 'Not Found', message: 'Source account not found.' });
    }

    // Authorization check
    if (sourceAccount.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to transfer from this account.' });
    }

    if (sourceAccount.status === 'FROZEN') {
      return res.status(403).json({ error: 'Account Frozen', message: 'Source account is frozen. Outgoing transfers are blocked.' });
    }

    const destAccount = DB.findAccountByNumber(destinationAccountNumber.trim());
    if (!destAccount) {
      return res.status(404).json({ error: 'Not Found', message: `Destination account "${destinationAccountNumber}" does not exist.` });
    }

    if (destAccount.id === sourceAccount.id) {
      return res.status(400).json({ error: 'Validation Error', message: 'Cannot transfer funds to the same account.' });
    }

    if (destAccount.status === 'FROZEN') {
      return res.status(403).json({ error: 'Account Frozen', message: 'Destination account is frozen. Inbound transfers are suspended.' });
    }

    // Balance check
    if (sourceAccount.balance < transferAmount) {
      return res.status(400).json({
        error: 'Insufficient Funds',
        message: `Available balance ($${sourceAccount.balance.toFixed(2)}) is less than requested amount ($${transferAmount.toFixed(2)}).`
      });
    }

    // Execute atomic balance updates & cryptographic ledger entries
    const newSourceBalance = Number((sourceAccount.balance - transferAmount).toFixed(2));
    const newDestBalance = Number((destAccount.balance + transferAmount).toFixed(2));

    const txReference = `REF-TRF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const transaction = DB.createTransaction({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      reference: txReference,
      sourceAccountId: sourceAccount.id,
      destinationAccountId: destAccount.id,
      amount: transferAmount,
      fee: 0.00,
      currency: sourceAccount.currency,
      type: 'TRANSFER',
      status: 'COMPLETED',
      idempotencyKey: idempotencyKey || null,
      description: description || 'Account to account transfer',
      createdAt: new Date().toISOString()
    });

    // Post DEBIT entry to source account
    const debitEntry = DB.appendLedgerEntry({
      id: `led_${Date.now()}_deb`,
      transactionId: transaction.id,
      accountId: sourceAccount.id,
      entryType: 'DEBIT',
      amount: transferAmount,
      balanceAfter: newSourceBalance
    });

    // Post CREDIT entry to destination account
    const creditEntry = DB.appendLedgerEntry({
      id: `led_${Date.now()}_crd`,
      transactionId: transaction.id,
      accountId: destAccount.id,
      entryType: 'CREDIT',
      amount: transferAmount,
      balanceAfter: newDestBalance
    });

    // Update balances
    DB.updateAccountBalance(sourceAccount.id, newSourceBalance);
    DB.updateAccountBalance(destAccount.id, newDestBalance);

    // Append audit log
    DB.appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'MONEY_TRANSFER_EXECUTED',
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      details: {
        reference: transaction.reference,
        amount: transferAmount,
        fromAccount: sourceAccount.accountNumber,
        toAccount: destAccount.accountNumber,
        debitHash: debitEntry.currentHash,
        creditHash: creditEntry.currentHash
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      message: 'Transfer executed and posted to cryptographic ledger successfully.',
      transaction,
      entries: [debitEntry, creditEntry],
      updatedBalance: newSourceBalance
    });
  } catch (err) {
    console.error('[TRANSFER] Error executing transfer:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * @route   POST /api/transfers/deposit
 * @desc    Deposit funds into an account
 */
router.post('/deposit', requireAuth, (req, res) => {
  try {
    const { accountId, amount, description } = req.body;

    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'Deposit amount must be a positive number.' });
    }

    const account = DB.findAccountById(accountId);
    if (!account) {
      return res.status(404).json({ error: 'Not Found', message: 'Account not found.' });
    }

    if (account.userId !== req.user.id && !['ADMIN', 'OPERATOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not authorized to deposit into this account.' });
    }

    if (account.status === 'FROZEN') {
      return res.status(403).json({ error: 'Account Frozen', message: 'Cannot deposit into a frozen account.' });
    }

    const newBalance = Number((account.balance + depositAmount).toFixed(2));
    const txReference = `REF-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const transaction = DB.createTransaction({
      id: `tx_${Date.now()}_dep`,
      reference: txReference,
      sourceAccountId: null,
      destinationAccountId: account.id,
      amount: depositAmount,
      fee: 0.00,
      currency: account.currency,
      type: 'DEPOSIT',
      status: 'COMPLETED',
      description: description || 'Account deposit',
      createdAt: new Date().toISOString()
    });

    const creditEntry = DB.appendLedgerEntry({
      id: `led_${Date.now()}_crd`,
      transactionId: transaction.id,
      accountId: account.id,
      entryType: 'CREDIT',
      amount: depositAmount,
      balanceAfter: newBalance
    });

    DB.updateAccountBalance(account.id, newBalance);

    DB.appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'FUNDS_DEPOSITED',
      entityType: 'TRANSACTION',
      entityId: transaction.id,
      details: {
        accountNumber: account.accountNumber,
        amount: depositAmount,
        creditHash: creditEntry.currentHash
      },
      ipAddress: req.ip
    });

    res.status(200).json({
      message: 'Deposit confirmed and cryptographically ledgered.',
      transaction,
      entry: creditEntry,
      updatedBalance: newBalance
    });
  } catch (err) {
    console.error('[TRANSFER] Error executing deposit:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * @route   GET /api/transfers
 * @desc    Get transaction history
 */
router.get('/', requireAuth, (req, res) => {
  const userAccounts = DB.findAccountsByUserId(req.user.id);
  const accountIds = new Set(userAccounts.map(a => a.id));

  let txs = DB.getAllTransactions();
  if (req.user.role !== 'ADMIN' && req.user.role !== 'OPERATOR') {
    txs = txs.filter(t => accountIds.has(t.sourceAccountId) || accountIds.has(t.destinationAccountId));
  }

  // Sort descending
  txs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(txs);
});

module.exports = router;
