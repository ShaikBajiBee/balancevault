// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const DB = require('../db');
const { JWT_SECRET, JWT_EXPIRES_IN, ADMIN_BOOTSTRAP_TOKEN } = require('../config');
const { requireAuth } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new account holder
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Validation Error', message: 'Email, password, and full name are required.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Validation Error', message: 'Password must be at least 8 characters.' });
    }

    const existingUser = DB.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: email.trim().toLowerCase(),
      passwordHash,
      fullName: fullName.trim(),
      role: 'USER',
      status: 'PENDING_ONBOARDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const createdUser = DB.createUser(newUser);

    // Audit log
    DB.appendAuditLog({
      actorId: createdUser.id,
      actorRole: 'USER',
      action: 'USER_REGISTERED',
      entityType: 'USER',
      entityId: createdUser.id,
      details: { email: createdUser.email, fullName: createdUser.fullName },
      ipAddress: req.ip
    });

    const token = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Account registered successfully. Please complete identity onboarding.',
      token,
      user: createdUser
    });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Sign in user, operator, or administrator
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
    }

    const user = DB.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Authentication Failed', message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Authentication Failed', message: 'Invalid email or password.' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Forbidden', message: 'This account has been suspended.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Audit log
    DB.appendAuditLog({
      actorId: user.id,
      actorRole: user.role,
      action: 'USER_LOGGED_IN',
      entityType: 'SESSION',
      entityId: user.id,
      details: { role: user.role },
      ipAddress: req.ip
    });

    const { passwordHash, ...safeUser } = user;
    const accounts = DB.findAccountsByUserId(user.id);
    const onboarding = DB.findOnboardingByUserId(user.id);

    res.json({
      message: 'Login successful.',
      token,
      user: safeUser,
      accounts,
      onboarding
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user context
 */
router.get('/me', requireAuth, (req, res) => {
  const user = DB.findUserById(req.user.id);
  const { passwordHash, ...safeUser } = user;
  const accounts = DB.findAccountsByUserId(user.id);
  const onboarding = DB.findOnboardingByUserId(user.id);

  res.json({
    user: safeUser,
    accounts,
    onboarding
  });
});

/**
 * @route   POST /api/auth/bootstrap-admin
 * @desc    Bootstrap the first platform administrator with an operator bootstrap token
 */
router.post('/bootstrap-admin', async (req, res) => {
  try {
    const { bootstrapToken, email, password, fullName } = req.body;

    if (!bootstrapToken || bootstrapToken !== ADMIN_BOOTSTRAP_TOKEN) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid or missing bootstrap authorization token.'
      });
    }

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email, password, and full name are required for admin creation.'
      });
    }

    const existingUser = DB.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A user with this email already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newAdmin = {
      id: `usr_admin_${Date.now()}`,
      email: email.trim().toLowerCase(),
      passwordHash,
      fullName: fullName.trim(),
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const createdAdmin = DB.createUser(newAdmin);

    DB.appendAuditLog({
      actorId: createdAdmin.id,
      actorRole: 'BOOTSTRAP_OPERATOR',
      action: 'ADMINISTRATOR_BOOTSTRAPPED',
      entityType: 'USER',
      entityId: createdAdmin.id,
      details: { email: createdAdmin.email, operatorMethod: 'SET_ROLE_BOOTSTRAP' },
      ipAddress: req.ip
    });

    const token = jwt.sign(
      { id: createdAdmin.id, email: createdAdmin.email, role: createdAdmin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: 'Platform administrator bootstrapped and verified successfully.',
      token,
      user: createdAdmin
    });
  } catch (err) {
    console.error('[AUTH] Bootstrap error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

module.exports = router;
