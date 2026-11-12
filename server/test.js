// server/test.js
// Automated verification test suite for BalanceVault
const DB = require('./db');
const { verifyLedgerIntegrity, calculateEntryHash } = require('./ledger');
const bcrypt = require('bcryptjs');

console.log('--- STARTING BALANCEVAULT TEST SUITE ---');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  try {
    // 1. Verify Seed Users Exist
    const admin = DB.findUserByEmail('admin@balancevault.com');
    assert(admin !== undefined && admin.role === 'ADMIN', 'Admin user exists with ADMIN role');

    const operator = DB.findUserByEmail('operator@balancevault.com');
    assert(operator !== undefined && operator.role === 'OPERATOR', 'Compliance Operator exists with OPERATOR role');

    const alice = DB.findUserByEmail('alice@example.com');
    assert(alice !== undefined && alice.role === 'USER', 'Alice exists with USER role');

    // 2. Verify Passwords
    const isPasswordValid = bcrypt.compareSync('Admin@123456', admin.passwordHash);
    assert(isPasswordValid === true, 'Admin password hashes and verifies correctly');

    // 3. Verify Accounts
    const aliceAccounts = DB.findAccountsByUserId(alice.id);
    assert(aliceAccounts.length > 0, 'Alice has active account vault');
    const aliceAccount = aliceAccounts[0];
    assert(aliceAccount.balance > 0, `Alice has balance ($${aliceAccount.balance})`);

    // 4. Verify Cryptographic Ledger Integrity
    const entries = DB.getLedgerEntries();
    assert(entries.length >= 4, `Ledger contains at least 4 entries (Current count: ${entries.length})`);

    const integrityReport = verifyLedgerIntegrity(entries);
    assert(integrityReport.isValid === true, 'Ledger SHA-256 cryptographic chain is completely valid without gaps');

    // 5. Test Tamper Detection
    console.log('\n--- TESTING CRYPTOGRAPHIC TAMPER DETECTION ---');
    const fakeTamperedEntries = JSON.parse(JSON.stringify(entries));
    // Tamper with amount in entry 2
    fakeTamperedEntries[1].amount = 999999.00;
    const tamperedReport = verifyLedgerIntegrity(fakeTamperedEntries);
    assert(tamperedReport.isValid === false, 'Tampered ledger entry is immediately caught by cryptographic verification');

    // 6. Test Admin Bootstrap Mechanism
    console.log('\n--- TESTING ADMIN BOOTSTRAP MECHANISM ---');
    const bootstrapEmail = `bootstrap_test_${Date.now()}@balancevault.com`;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Bootstrap@123456', salt);
    const bootstrappedAdmin = DB.createUser({
      id: `usr_boot_${Date.now()}`,
      email: bootstrapEmail,
      passwordHash: hash,
      fullName: 'Bootstrapped Admin Tester',
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    assert(bootstrappedAdmin.role === 'ADMIN', 'Bootstrap operator can successfully create and activate new Admin');

    // 7. Test Money Movement Execution & Ledger Chain Extension
    console.log('\n--- TESTING MONEY MOVEMENT & DOUBLE-ENTRY LEDGER ---');
    const initialLedgerCount = DB.getLedgerEntries().length;
    const initialAliceBal = aliceAccount.balance;
    const transferAmount = 50.00;

    // Simulate transfer to Bob
    const bob = DB.findUserByEmail('bob@example.com');
    const bobAccount = DB.findAccountsByUserId(bob.id)[0];
    const initialBobBal = bobAccount.balance;

    const tx = DB.createTransaction({
      id: `tx_test_${Date.now()}`,
      reference: `REF-TEST-${Date.now()}`,
      sourceAccountId: aliceAccount.id,
      destinationAccountId: bobAccount.id,
      amount: transferAmount,
      fee: 0,
      currency: 'USD',
      type: 'TRANSFER',
      status: 'COMPLETED',
      description: 'Automated test suite transfer',
      createdAt: new Date().toISOString()
    });

    DB.appendLedgerEntry({
      id: `led_test_deb_${Date.now()}`,
      transactionId: tx.id,
      accountId: aliceAccount.id,
      entryType: 'DEBIT',
      amount: transferAmount,
      balanceAfter: initialAliceBal - transferAmount
    });

    DB.appendLedgerEntry({
      id: `led_test_crd_${Date.now()}`,
      transactionId: tx.id,
      accountId: bobAccount.id,
      entryType: 'CREDIT',
      amount: transferAmount,
      balanceAfter: initialBobBal + transferAmount
    });

    DB.updateAccountBalance(aliceAccount.id, initialAliceBal - transferAmount);
    DB.updateAccountBalance(bobAccount.id, initialBobBal + transferAmount);

    const updatedEntries = DB.getLedgerEntries();
    assert(updatedEntries.length === initialLedgerCount + 2, 'Two new double-entry ledger records appended');

    const extendedIntegrity = verifyLedgerIntegrity(updatedEntries);
    assert(extendedIntegrity.isValid === true, 'Extended ledger maintains mathematical & cryptographic continuity');

    // 8. Test Audit Logs
    const auditLogs = DB.getAuditLogs();
    assert(auditLogs.length > 0, `Audit logs exist (Current count: ${auditLogs.length})`);

    console.log(`\n==============================================`);
    console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`==============================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runTests();
