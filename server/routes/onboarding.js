// server/routes/onboarding.js
const express = require('express');
const router = express.Router();
const DB = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

/**
 * @route   POST /api/onboarding
 * @desc    Submit KYC verification and onboarding details
 */
router.post('/', requireAuth, (req, res) => {
  try {
    const { idDocumentType, idDocumentNumber, occupation, monthlyIncome } = req.body;

    if (!idDocumentType || !idDocumentNumber || !occupation || !monthlyIncome) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Document type, document number, occupation, and monthly income are required.'
      });
    }

    const existingReq = DB.findOnboardingByUserId(req.user.id);
    if (existingReq && existingReq.status === 'APPROVED') {
      return res.status(400).json({ error: 'Already Onboarded', message: 'Your account is already verified and active.' });
    }

    // Algorithmic initial risk assessment score (1-100 scale: lower is lower risk)
    const incomeNum = Number(monthlyIncome);
    let riskScore = 15;
    if (incomeNum > 10000) riskScore = 10;
    else if (incomeNum < 2000) riskScore = 35;

    const onboardingData = {
      id: `onb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user.id,
      idDocumentType: idDocumentType.toUpperCase(),
      idDocumentNumber: idDocumentNumber.trim(),
      occupation: occupation.trim(),
      monthlyIncome: incomeNum,
      riskScore,
      status: 'PENDING',
      reviewerId: null,
      reviewNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = DB.createOnboardingRequest(onboardingData);

    DB.appendAuditLog({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'ONBOARDING_SUBMITTED',
      entityType: 'ONBOARDING',
      entityId: saved.id,
      details: { docType: saved.idDocumentType, riskScore: saved.riskScore },
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Onboarding application submitted for compliance review.',
      onboarding: saved
    });
  } catch (err) {
    console.error('[ONBOARDING] Error submitting onboarding:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * @route   GET /api/onboarding/status
 * @desc    Get onboarding status for current user
 */
router.get('/status', requireAuth, (req, res) => {
  const reqData = DB.findOnboardingByUserId(req.user.id);
  res.json({ onboarding: reqData || null });
});

/**
 * @route   GET /api/onboarding/pending
 * @desc    List all onboarding applications (Admin / Operator only)
 */
router.get('/pending', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const requests = DB.getOnboardingRequests().map(o => {
    const user = DB.findUserById(o.userId);
    return {
      ...o,
      userName: user ? user.fullName : 'Unknown',
      userEmail: user ? user.email : 'Unknown'
    };
  });
  res.json(requests);
});

/**
 * @route   POST /api/onboarding/:id/review
 * @desc    Approve or reject onboarding application
 */
router.post('/:id/review', requireAuth, requireRole(['ADMIN', 'OPERATOR']), (req, res) => {
  const { decision, notes } = req.body; // 'APPROVED' or 'REJECTED'

  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'Validation Error', message: 'Decision must be APPROVED or REJECTED' });
  }

  const onboarding = DB.findOnboardingById(req.params.id);
  if (!onboarding) {
    return res.status(404).json({ error: 'Not Found', message: 'Onboarding application not found.' });
  }

  const updatedOnboarding = DB.updateOnboardingStatus(onboarding.id, decision, req.user.id, notes || '');

  // If approved, activate user and generate primary account vault
  if (decision === 'APPROVED') {
    DB.updateUser(onboarding.userId, { status: 'ACTIVE' });

    // Check if user already has an account; if not, create initial primary vault
    const existingAccounts = DB.findAccountsByUserId(onboarding.userId);
    if (existingAccounts.length === 0) {
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      const newAccount = {
        id: `acc_${Date.now()}_primary`,
        userId: onboarding.userId,
        accountNumber: `BV-${randomDigits}-USD`,
        currency: 'USD',
        balance: 100.00, // Courtesy welcome grant for demo
        availableBalance: 100.00,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      DB.createAccount(newAccount);

      // Ledger entry for welcome grant
      const tx = DB.createTransaction({
        id: `tx_${Date.now()}_welcome`,
        reference: `REF-WELCOME-${Date.now()}`,
        sourceAccountId: null,
        destinationAccountId: newAccount.id,
        amount: 100.00,
        fee: 0.00,
        currency: 'USD',
        type: 'DEPOSIT',
        status: 'COMPLETED',
        description: 'New User Onboarding Welcome Grant',
        createdAt: new Date().toISOString()
      });

      DB.appendLedgerEntry({
        id: `led_${Date.now()}_wel`,
        transactionId: tx.id,
        accountId: newAccount.id,
        entryType: 'CREDIT',
        amount: 100.00,
        balanceAfter: 100.00
      });
    }
  }

  DB.appendAuditLog({
    actorId: req.user.id,
    actorRole: req.user.role,
    action: `ONBOARDING_${decision}`,
    entityType: 'ONBOARDING',
    entityId: onboarding.id,
    details: { decision, notes, targetUserId: onboarding.userId },
    ipAddress: req.ip
  });

  res.json({
    message: `Onboarding application has been ${decision.toLowerCase()}.`,
    onboarding: updatedOnboarding
  });
});

module.exports = router;
