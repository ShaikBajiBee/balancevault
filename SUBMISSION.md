# SUBMISSION.md — Ready-to-Submit Portal Content

**Portal Link:** [https://hackathon.snovasys.com/project/new/3](https://hackathon.snovasys.com/project/new/3)  
**Candidate Name:** SHAIK BAJI BEE  
**Username:** `skbajibeebaji`

Copy and paste each section below directly into the corresponding fields on your Snovasys submission form:

---

### Field: Project Title
```
BalanceVault — money movement with a ledger you can prove
```

---

### Field: Short Description / Tagline
```
A secure account management platform with role-based access, user onboarding, and auditable account operations.
```

---

### Field: The problem
```
Managing financial accounts and their associated operations requires more than just storing account information. It also requires controlled access, secure authentication, clear onboarding, and accountability for important actions.
BalanceVault is a web application designed to bring these capabilities together. It focuses on structured account management, role-based access, onboarding workflows, and auditability.
```

---

### Field: What I built
```
The implementation includes:
- A responsive React/SPA frontend with live balance tracking, transaction visualizer, and ledger explorer.
- A Node.js and Express backend with modular API routes.
- PostgreSQL database integration using Prisma with migration support and lightweight zero-dependency local storage.
- Cryptographic SHA-256 hash-chained ledger engine that provides mathematical proof of non-tampering.
- Role-based access control (RBAC) supporting Admin, Compliance Operator, and Account Holder roles.
- Account-holder registration and KYC identity onboarding verification workflows.
- Admin command center for user management, account freezing, KYC reviews, and system audit-log access.
- Sliding-window rate limiting with Redis protocol compatibility for defense against replay and brute force attacks.
- Operational health and readiness endpoints (/health and /ready) with live ledger state checks.
- First administrator bootstrap endpoint (/api/auth/bootstrap-admin) using scoped operator role tokens.
```

---

### Field: How to run it
```
1. Clone the repository and enter the directory:
   cd Snovasys

2. Install dependencies:
   npm install

3. Run migrations and database schema generation:
   npm run db:migrate
   npm run db:generate

4. Run the automated verification test suite:
   npm test

5. Start the platform:
   npm start
   Open http://localhost:5000 in your browser.

Demo Test Credentials:
- System Administrator: admin@balancevault.com / Admin@123456
- Compliance Operator: operator@balancevault.com / Operator@123456
- Account Holder (Alice): alice@example.com / Alice@123456
- Account Holder (Bob): bob@example.com / Bob@123456
- Pending KYC Applicant (Charlie): charlie@example.com / Alice@123456
```

---

### Field: AI tools I used
```
ChatGPT — technical explanations, architecture discussions, security reviews, and deployment troubleshooting. OpenAI Codex / Antigravity in VS Code — code implementation, cryptographic hash chain design, repository inspection, and unit testing.
```

---

### Field: What the AI got wrong, and what I fixed myself
```
During deployment and database configuration, AI initially confused database role membership with permission to administer another PostgreSQL role.
It suggested changing a role password through the project-owner connection with ALTER ROLE ... WITH SUPERUSER, but Neon rejected the operation with SQLSTATE 42501 (insufficient_privilege).
I investigated the actual PostgreSQL role configuration and discovered that:
1. The bootstrap login existed and had login permission.
2. It had membership in the bootstrap operator role.
3. The membership allowed SET ROLE.
4. The bootstrap operator had permission to execute the admin bootstrap function.
This showed that the original permission assumptions were incomplete. Instead of blindly granting broader database privileges or requesting superuser access, I inspected the role memberships, function permissions, and bootstrap implementation to narrow down the failure and properly scoped the bootstrap endpoint (/api/auth/bootstrap-admin).

Additionally, the AI initially generated money transfer logic that lacked idempotency handling and performed independent balance updates without cryptographic chaining, leaving the system vulnerable to duplicate debits on network retries. I refactored the money movement engine to require unique idempotency keys and enforce atomic double-entry ledger postings (Debit and Credit) linked by SHA-256 hash chaining.

This reinforced an important lesson: AI-generated suggestions must be verified against actual database configurations, execution environments, and financial invariant guarantees.
```

---

### Field: What is not finished
```
The following work remains:
- Further automated end-to-end browser integration testing across mobile screen breakpoints.
- Production multi-region database replication and failover testing.
- Direct hardware security module (HSM) signing integration for high-value institutional transfers.
- Real-time webhook notifications for external counterparty bank settlements.

The current deployment is intended as a hackathon demonstration using synthetic data, not as a production financial service or a system for handling real funds.
```
