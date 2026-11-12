// server/db.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { calculateEntryHash, calculateAuditHash, GENESIS_HASH } = require('./ledger');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'balancevault.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = {
  users: [],
  accounts: [],
  transactions: [],
  ledgerEntries: [],
  auditLogs: [],
  onboardingRequests: []
};

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(content);
      return;
    } catch (err) {
      console.error('[DB] Failed to parse db file, initializing fresh:', err.message);
    }
  }
  initializeSeedData();
}

function initializeSeedData() {
  console.log('[DB] Initializing seed data for BalanceVault...');
  const salt = bcrypt.genSaltSync(10);

  const adminPasswordHash = bcrypt.hashSync('Admin@123456', salt);
  const operatorPasswordHash = bcrypt.hashSync('Operator@123456', salt);
  const alicePasswordHash = bcrypt.hashSync('Alice@123456', salt);
  const bobPasswordHash = bcrypt.hashSync('Bob@123456', salt);

  const adminUser = {
    id: 'usr_admin_001',
    email: 'admin@balancevault.com',
    passwordHash: adminPasswordHash,
    fullName: 'System Administrator',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T09:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T09:00:00Z').toISOString()
  };

  const operatorUser = {
    id: 'usr_operator_001',
    email: 'operator@balancevault.com',
    passwordHash: operatorPasswordHash,
    fullName: 'Compliance Operator',
    role: 'OPERATOR',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T09:15:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T09:15:00Z').toISOString()
  };

  const aliceUser = {
    id: 'usr_alice_001',
    email: 'alice@example.com',
    passwordHash: alicePasswordHash,
    fullName: 'Alice Walker',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T10:00:00Z').toISOString()
  };

  const bobUser = {
    id: 'usr_bob_001',
    email: 'bob@example.com',
    passwordHash: bobPasswordHash,
    fullName: 'Bob Martinez',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T10:30:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T10:30:00Z').toISOString()
  };

  const charlieUser = {
    id: 'usr_charlie_001',
    email: 'charlie@example.com',
    passwordHash: alicePasswordHash,
    fullName: 'Charlie Davis',
    role: 'USER',
    status: 'PENDING_ONBOARDING',
    createdAt: new Date('2026-11-07T11:00:00Z').toISOString(),
    updatedAt: new Date('2026-11-07T11:00:00Z').toISOString()
  };

  // Accounts
  const aliceAccount = {
    id: 'acc_alice_usd',
    userId: aliceUser.id,
    accountNumber: 'BV-10029384-US',
    currency: 'USD',
    balance: 5400.00,
    availableBalance: 5400.00,
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T10:05:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T10:05:00Z').toISOString()
  };

  const bobAccount = {
    id: 'acc_bob_usd',
    userId: bobUser.id,
    accountNumber: 'BV-77884912-US',
    currency: 'USD',
    balance: 1850.00,
    availableBalance: 1850.00,
    status: 'ACTIVE',
    createdAt: new Date('2026-11-06T10:35:00Z').toISOString(),
    updatedAt: new Date('2026-11-06T10:35:00Z').toISOString()
  };

  // Onboarding Request for Charlie (Pending approval demo)
  const charlieOnboarding = {
    id: 'onb_charlie_001',
    userId: charlieUser.id,
    idDocumentType: 'PASSPORT',
    idDocumentNumber: 'P89201934',
    occupation: 'Senior Systems Architect',
    monthlyIncome: 9500,
    riskScore: 12,
    status: 'PENDING',
    reviewerId: null,
    reviewNotes: null,
    createdAt: new Date('2026-11-07T11:05:00Z').toISOString(),
    updatedAt: new Date('2026-11-07T11:05:00Z').toISOString()
  };

  // Seed Initial Transactions & Cryptographic Ledger Chain
  const tx1 = {
    id: 'tx_genesis_alice',
    reference: 'REF-GENESIS-ALICE-01',
    sourceAccountId: null,
    destinationAccountId: aliceAccount.id,
    amount: 5000.00,
    fee: 0.00,
    currency: 'USD',
    type: 'DEPOSIT',
    status: 'COMPLETED',
    idempotencyKey: 'IDEMP-GENESIS-01',
    description: 'Initial Vault Funding (Seed Capital)',
    createdAt: new Date('2026-11-06T10:10:00Z').toISOString()
  };

  const tx2 = {
    id: 'tx_genesis_bob',
    reference: 'REF-GENESIS-BOB-01',
    sourceAccountId: null,
    destinationAccountId: bobAccount.id,
    amount: 2250.00,
    fee: 0.00,
    currency: 'USD',
    type: 'DEPOSIT',
    status: 'COMPLETED',
    idempotencyKey: 'IDEMP-GENESIS-02',
    description: 'Initial Vault Funding (Seed Capital)',
    createdAt: new Date('2026-11-06T10:40:00Z').toISOString()
  };

  const tx3 = {
    id: 'tx_transfer_01',
    reference: 'REF-TRF-20261108-001',
    sourceAccountId: bobAccount.id,
    destinationAccountId: aliceAccount.id,
    amount: 400.00,
    fee: 0.00,
    currency: 'USD',
    type: 'TRANSFER',
    status: 'COMPLETED',
    idempotencyKey: 'IDEMP-TRF-001',
    description: 'Invoice settlement: Q3 Security Audit',
    createdAt: new Date('2026-11-08T14:20:00Z').toISOString()
  };

  // Build Ledger Entries with unbroken SHA-256 chain
  const ledgerEntries = [];

  // Entry 1: Alice Initial Deposit
  const entry1 = {
    id: 'led_0001',
    transactionId: tx1.id,
    accountId: aliceAccount.id,
    entryType: 'CREDIT',
    amount: 5000.00,
    balanceAfter: 5000.00,
    sequenceNumber: 1,
    previousHash: GENESIS_HASH,
    createdAt: tx1.createdAt
  };
  entry1.currentHash = calculateEntryHash(entry1);
  ledgerEntries.push(entry1);

  // Entry 2: Bob Initial Deposit
  const entry2 = {
    id: 'led_0002',
    transactionId: tx2.id,
    accountId: bobAccount.id,
    entryType: 'CREDIT',
    amount: 2250.00,
    balanceAfter: 2250.00,
    sequenceNumber: 2,
    previousHash: entry1.currentHash,
    createdAt: tx2.createdAt
  };
  entry2.currentHash = calculateEntryHash(entry2);
  ledgerEntries.push(entry2);

  // Entry 3: Transfer Debit from Bob
  const entry3 = {
    id: 'led_0003',
    transactionId: tx3.id,
    accountId: bobAccount.id,
    entryType: 'DEBIT',
    amount: 400.00,
    balanceAfter: 1850.00,
    sequenceNumber: 3,
    previousHash: entry2.currentHash,
    createdAt: tx3.createdAt
  };
  entry3.currentHash = calculateEntryHash(entry3);
  ledgerEntries.push(entry3);

  // Entry 4: Transfer Credit to Alice
  const entry4 = {
    id: 'led_0004',
    transactionId: tx3.id,
    accountId: aliceAccount.id,
    entryType: 'CREDIT',
    amount: 400.00,
    balanceAfter: 5400.00,
    sequenceNumber: 4,
    previousHash: entry3.currentHash,
    createdAt: tx3.createdAt
  };
  entry4.currentHash = calculateEntryHash(entry4);
  ledgerEntries.push(entry4);

  // Seed Initial Audit Logs
  const auditLogs = [];
  const log1 = {
    id: 'aud_0001',
    actorId: adminUser.id,
    actorRole: 'ADMIN',
    action: 'SYSTEM_GENESIS_INITIALIZATION',
    entityType: 'SYSTEM',
    entityId: 'GENESIS',
    details: { message: 'BalanceVault cryptographic ledger initialized with Genesis block' },
    ipAddress: '127.0.0.1',
    userAgent: 'BalanceVault-Bootstrap/1.0',
    timestamp: new Date('2026-11-06T09:00:00Z').toISOString(),
    previousHash: GENESIS_HASH
  };
  log1.currentHash = calculateAuditHash(log1);
  auditLogs.push(log1);

  const log2 = {
    id: 'aud_0002',
    actorId: operatorUser.id,
    actorRole: 'OPERATOR',
    action: 'ACCOUNT_ONBOARDING_APPROVED',
    entityType: 'ACCOUNT',
    entityId: aliceAccount.id,
    details: { accountNumber: aliceAccount.accountNumber, owner: aliceUser.fullName },
    ipAddress: '192.168.1.45',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    timestamp: new Date('2026-11-06T10:05:00Z').toISOString(),
    previousHash: log1.currentHash
  };
  log2.currentHash = calculateAuditHash(log2);
  auditLogs.push(log2);

  db = {
    users: [adminUser, operatorUser, aliceUser, bobUser, charlieUser],
    accounts: [aliceAccount, bobAccount],
    transactions: [tx1, tx2, tx3],
    ledgerEntries,
    auditLogs,
    onboardingRequests: [charlieOnboarding]
  };

  saveDb();
  console.log('[DB] Seed data initialized successfully.');
}

// Load database immediately
loadDb();

// Database Query Helpers
const DB = {
  // Users
  findUserByEmail: (email) => db.users.find(u => u.email.toLowerCase() === email.toLowerCase()),
  findUserById: (id) => db.users.find(u => u.id === id),
  getAllUsers: () => db.users.map(({ passwordHash, ...safeUser }) => safeUser),
  createUser: (userData) => {
    db.users.push(userData);
    saveDb();
    const { passwordHash, ...safeUser } = userData;
    return safeUser;
  },
  updateUser: (id, updates) => {
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...updates, updatedAt: new Date().toISOString() };
    saveDb();
    const { passwordHash, ...safeUser } = db.users[idx];
    return safeUser;
  },

  // Accounts
  findAccountById: (id) => db.accounts.find(a => a.id === id),
  findAccountByNumber: (num) => db.accounts.find(a => a.accountNumber === num),
  findAccountsByUserId: (userId) => db.accounts.filter(a => a.userId === userId),
  getAllAccounts: () => db.accounts,
  createAccount: (accountData) => {
    db.accounts.push(accountData);
    saveDb();
    return accountData;
  },
  updateAccountBalance: (id, newBalance) => {
    const acc = db.accounts.find(a => a.id === id);
    if (acc) {
      acc.balance = Number(newBalance);
      acc.availableBalance = Number(newBalance);
      acc.updatedAt = new Date().toISOString();
      saveDb();
    }
    return acc;
  },
  updateAccountStatus: (id, status) => {
    const acc = db.accounts.find(a => a.id === id);
    if (acc) {
      acc.status = status;
      acc.updatedAt = new Date().toISOString();
      saveDb();
    }
    return acc;
  },

  // Transactions
  findTransactionById: (id) => db.transactions.find(t => t.id === id),
  findTransactionByIdempotency: (key) => db.transactions.find(t => t.idempotencyKey === key),
  getAllTransactions: () => db.transactions,
  createTransaction: (txData) => {
    db.transactions.push(txData);
    saveDb();
    return txData;
  },

  // Ledger Entries
  getLedgerEntries: () => db.ledgerEntries,
  getLatestLedgerEntry: () => {
    if (db.ledgerEntries.length === 0) return null;
    return db.ledgerEntries[db.ledgerEntries.length - 1];
  },
  appendLedgerEntry: (entryData) => {
    const latest = db.ledgerEntries[db.ledgerEntries.length - 1];
    const sequenceNumber = latest ? latest.sequenceNumber + 1 : 1;
    const previousHash = latest ? latest.currentHash : GENESIS_HASH;

    const entry = {
      ...entryData,
      sequenceNumber,
      previousHash,
      createdAt: entryData.createdAt || new Date().toISOString()
    };
    entry.currentHash = calculateEntryHash(entry);

    db.ledgerEntries.push(entry);
    saveDb();
    return entry;
  },

  // Audit Logs
  getAuditLogs: () => db.auditLogs,
  appendAuditLog: (logData) => {
    const latest = db.auditLogs[db.auditLogs.length - 1];
    const previousHash = latest ? latest.currentHash : GENESIS_HASH;

    const log = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...logData,
      timestamp: new Date().toISOString(),
      previousHash
    };
    log.currentHash = calculateAuditHash(log);

    db.auditLogs.push(log);
    saveDb();
    return log;
  },

  // Onboarding Requests
  getOnboardingRequests: () => db.onboardingRequests,
  findOnboardingByUserId: (userId) => db.onboardingRequests.find(o => o.userId === userId),
  findOnboardingById: (id) => db.onboardingRequests.find(o => o.id === id),
  createOnboardingRequest: (reqData) => {
    db.onboardingRequests.push(reqData);
    saveDb();
    return reqData;
  },
  updateOnboardingStatus: (id, status, reviewerId, reviewNotes) => {
    const req = db.onboardingRequests.find(o => o.id === id);
    if (req) {
      req.status = status;
      req.reviewerId = reviewerId;
      req.reviewNotes = reviewNotes;
      req.updatedAt = new Date().toISOString();
      saveDb();
    }
    return req;
  },

  // Reset / Reseed utility
  resetDatabase: () => {
    initializeSeedData();
    return true;
  }
};

module.exports = DB;
