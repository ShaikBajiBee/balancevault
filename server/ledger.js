// server/ledger.js
const crypto = require('crypto');

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Calculates SHA-256 hash of a ledger entry
 */
function calculateEntryHash({ sequenceNumber, previousHash, transactionId, accountId, entryType, amount, balanceAfter, createdAt }) {
  const payload = [
    sequenceNumber,
    previousHash,
    transactionId,
    accountId,
    entryType,
    Number(amount).toFixed(2),
    Number(balanceAfter).toFixed(2),
    new Date(createdAt).toISOString()
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Calculates SHA-256 hash of an audit log entry
 */
function calculateAuditHash({ id, actorId, actorRole, action, entityType, entityId, timestamp, previousHash, details }) {
  const payload = [
    id,
    actorId || 'SYSTEM',
    actorRole,
    action,
    entityType,
    entityId || 'NONE',
    new Date(timestamp).toISOString(),
    previousHash,
    JSON.stringify(details || {})
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Verifies the mathematical and cryptographic integrity of the entire ledger chain
 */
function verifyLedgerIntegrity(entries) {
  if (!entries || entries.length === 0) {
    return {
      isValid: true,
      totalEntries: 0,
      message: 'Ledger is empty. Genesis state intact.'
    };
  }

  // Sort by sequence number ascending
  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];

    // Check sequence number monotonicity
    if (entry.sequenceNumber !== i + 1) {
      return {
        isValid: false,
        brokenSequence: entry.sequenceNumber,
        expectedSequence: i + 1,
        message: `Sequence gap or disorder at sequence #${entry.sequenceNumber}`
      };
    }

    // Check previous hash continuity
    if (entry.previousHash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenSequence: entry.sequenceNumber,
        expectedPrevHash,
        actualPrevHash: entry.previousHash,
        message: `Broken cryptographic link at entry #${entry.sequenceNumber}: previousHash mismatch`
      };
    }

    // Recompute current hash
    const recalculatedHash = calculateEntryHash(entry);
    if (recalculatedHash !== entry.currentHash) {
      return {
        isValid: false,
        brokenSequence: entry.sequenceNumber,
        expectedHash: recalculatedHash,
        actualHash: entry.currentHash,
        message: `Data tampering detected at entry #${entry.sequenceNumber}: payload signature does not match`
      };
    }

    expectedPrevHash = entry.currentHash;
  }

  return {
    isValid: true,
    totalEntries: sorted.length,
    latestSequenceNumber: sorted[sorted.length - 1].sequenceNumber,
    latestHash: sorted[sorted.length - 1].currentHash,
    genesisHash: GENESIS_HASH,
    message: `All ${sorted.length} ledger entries cryptographically verified. Zero tampering detected.`
  };
}

module.exports = {
  GENESIS_HASH,
  calculateEntryHash,
  calculateAuditHash,
  verifyLedgerIntegrity
};
