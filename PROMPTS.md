# PROMPTS.md — Engineering & AI Collaboration Log

**Project:** BalanceVault — Money movement with a ledger you can prove  
**Candidate:** SHAIK BAJI BEE (`skbajibeebaji`)  
**Challenge:** Snovasys Fresher Hiring Challenge 2026  
**Tools Used:** ChatGPT (Architecture, Security review, Troubleshooting) & OpenAI Codex / Antigravity (Implementation, Refactoring, Testing)

---

## 1. System Architecture & Prompts Overview

### Prompt Cycle 1: Cryptographic Ledger Design & Invariant Guarantees
* **User Prompt to AI:**
  > *"Design a double-entry ledger system for account transfers where every transaction generates a cryptographic audit trail that external auditors can verify. What data structures ensure that past entries cannot be altered without detection?"*
* **AI Proposal:**
  > AI suggested creating a table of transactions and calculating a checksum hash on each transaction row using MD5 or SHA-1, stored alongside the record.
* **Critique & What AI Got Wrong:**
  - **Weak Hash Function:** AI recommended MD5/SHA-1 which are cryptographically broken with known collision vulnerabilities.
  - **Absence of Chaining (No Tamper Resistance):** Simply hashing a row independently does not prove that an attacker didn't insert, delete, or re-order rows. If row 2 is modified and its standalone checksum is recomputed, an auditor has no mathematical way of knowing the history was altered.
* **Human Engineering Correction:**
  - Enforced a **cryptographic SHA-256 Hash Chain** (blockchain/merkle-style linked sequence).
  - Every entry must include `sequenceNumber`, `previousHash`, and `currentHash = SHA256(sequenceNumber | previousHash | transactionId | accountId | entryType | amount | balanceAfter | timestamp)`.
  - Defined the Genesis block with a 64-character zero string (`0000000000000000000000000000000000000000000000000000000000000000`).
  - Added an automated mathematical verification function `verifyLedgerIntegrity()` that checks every link from block #1 to block #N.

---

### Prompt Cycle 2: Database Roles, Neon PostgreSQL, and SQLSTATE 42501 Error
* **User Prompt to AI:**
  > *"When setting up separate database roles for our bootstrap administrator and the application server in Neon PostgreSQL, the bootstrap script fails when trying to alter roles or execute the administrative setup function. How do I fix this permission issue?"*
* **AI Proposal:**
  > AI suggested running `ALTER ROLE bootstrap_login WITH SUPERUSER;` and executing `ALTER ROLE admin WITH PASSWORD '...';` using the project-owner connection.
* **Critique & What AI Got Wrong:**
  - Neon PostgreSQL (serverless Postgres) does **not** grant superuser privileges to tenants or pooler connections. Running `SUPERUSER` immediately fails with `SQLSTATE 42501 (insufficient_privilege)`.
  - Blindly trying to escalate privileges violates the principle of least privilege and would fail in production cloud databases.
* **Human Engineering Correction:**
  - Inspected the actual role configuration and privileges in PostgreSQL.
  - Discovered that:
    1. The `bootstrap_login` existed and had `LOGIN` privileges.
    2. It had explicit membership in the `bootstrap_operator` role.
    3. The membership allowed `SET ROLE bootstrap_operator;`.
    4. The `bootstrap_operator` role was granted specific `EXECUTE` privileges on the `bootstrap_admin()` security definer function.
  - Implemented the correct pattern: instead of changing passwords or demanding superuser access, the application executes through the scoped `bootstrap_operator` role to register the first platform administrator securely (`POST /api/auth/bootstrap-admin`).

---

### Prompt Cycle 3: Double-Entry Balance Drift & Idempotency
* **User Prompt to AI:**
  > *"Generate an API route for `/api/transfers` that takes `sourceAccountId`, `destinationAccountNumber`, and `amount` and updates account balances."*
* **AI Proposal:**
  > AI generated two independent updates:
  > ```js
  > await db.account.update({ where: { id: source }, data: { balance: { decrement: amount } } });
  > await db.account.update({ where: { id: dest }, data: { balance: { increment: amount } } });
  > ```
* **Critique & What AI Got Wrong:**
  - **No Idempotency Handling:** If a client suffers a network drop or timeout and retries the transfer request, the AI's implementation charges the sender twice.
  - **No Invariant Balance Check on Source:** Decrementing directly could cause negative balances if concurrent requests arrive.
  - **No Status Enforcement:** If the destination account or source account was marked `FROZEN` by compliance, money would still move silently.
* **Human Engineering Correction:**
  - Added unique `idempotencyKey` indexing: if a request arrives with an existing key, the transaction returns the cached result without duplicate debiting.
  - Enforced atomic pre-flight checks: `source.balance >= amount` and both `source.status === 'ACTIVE'` and `dest.status === 'ACTIVE'`.
  - Tied both accounts to atomic double-entry ledger postings (`DEBIT` on source, `CREDIT` on destination) with cryptographic signature chaining before updating balances.

---

### Prompt Cycle 4: Rate Limiting & Resilience
* **User Prompt to AI:**
  > *"Add rate limiting to protect the financial transfer endpoints from brute force and automated replay attacks."*
* **AI Proposal:**
  > AI provided a basic Express middleware that connected directly to an external Redis instance using `redis.createClient()` and crashed if `REDIS_URL` was unreachable.
* **Critique & What AI Got Wrong:**
  - Tight coupling to external network services without a fallback caused local tests and evaluation sandbox runs to fail immediately with `ECONNREFUSED`.
* **Human Engineering Correction:**
  - Implemented a resilient sliding-window rate limiter with RFC-compliant headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
  - Integrated in-memory sliding bucket tracking with automatic graceful fallback so the application boots and defends itself seamlessly whether Redis is present or running in local demonstration mode.

---

## 2. Summary of Lessons Learned
1. **Never accept AI security and permission recommendations without verification:** AI frequently defaults to "grant all permissions" or "use superuser", which is catastrophic in financial systems.
2. **Mathematical proofs beat blind trust:** Storing data is not enough; implementing an unbroken hash chain allows mathematical verification of every dollar moved.
3. **Idempotency and state isolation are mandatory:** Financial operations require strict guardrails against duplicate submissions, account freezes, and concurrency race conditions.
