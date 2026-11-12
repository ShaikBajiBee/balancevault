# BalanceVault — Money Movement with a Ledger You Can Prove

A secure account management platform featuring role-based access control (RBAC), multi-step user onboarding, double-entry financial transfers, and a mathematically auditable SHA-256 cryptographic ledger.

Built for the **Snovasys Fresher Hiring Challenge 2026**  
Candidate: **SHAIK BAJI BEE** (`skbajibeebaji`)

---

## 🌟 Key Features

1. **Provable Cryptographic Ledger (SHA-256 Hash Chain):**
   - Every financial operation is recorded as an immutable ledger block.
   - Each entry links back to the previous block via cryptographic hash chaining (`Genesis -> Block 1 -> Block 2 ... Block N`).
   - Built-in one-click mathematical integrity verifier (`GET /api/ledger/verify-integrity`) that proves zero data tampering across the entire ledger.
2. **Double-Entry Balance Accounting:**
   - Transfers atomically generate balanced `DEBIT` and `CREDIT` entries.
   - Enforces pre-flight balance invariant assertions and blocks transfers between frozen or invalid accounts.
   - Idempotency key protection prevents double-debiting on network retries.
3. **Role-Based Access Control (RBAC):**
   - **`ADMIN`**: Platform management, user freeze/activation, audit log inspection, and first-admin bootstrap.
   - **`OPERATOR`**: Compliance monitoring, KYC onboarding approvals, account freeze controls.
   - **`USER`**: Account vault holder, balance tracking, statement viewing, and money movement.
4. **User Onboarding & KYC Workflow:**
   - Registration into `PENDING_ONBOARDING` state.
   - Submission of government ID, occupation, income, and automated risk scoring (1–100).
   - Compliance review queue with approval that unlocks active vault accounts and courtesy welcome grants.
5. **Operational Health & Auditability:**
   - Kubernetes/container-compatible `/health` (liveness) and `/ready` (readiness with ledger verification) probes.
   - Cryptographically signed audit log stream tracking all administrative and security actions.
   - Sliding-window rate limiting with RFC-compliant response headers.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+ recommended)
- npm (v9+)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <your-private-repo-url>
   cd Snovasys
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run database migrations (or verify schema):**
   ```bash
   npm run db:migrate
   ```

4. **Run automated test suite (13/13 passing):**
   ```bash
   npm test
   ```

5. **Start the application:**
   ```bash
   npm start
   ```
   Open your browser at: **[http://localhost:5000](http://localhost:5000)**

---

## 👥 Seed & Demo Accounts

For demonstration and testing, the application comes pre-loaded with active personas:

| Role | Email | Password | Starting Balance | Permissions / Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@balancevault.com` | `Admin@123456` | — | Platform administration, audit trail, user controls |
| **Operator** | `operator@balancevault.com` | `Operator@123456` | — | Compliance officer, KYC approvals, account freeze |
| **User (Alice)** | `alice@example.com` | `Alice@123456` | $5,400.00 | Active user, outbound/inbound transfers |
| **User (Bob)** | `bob@example.com` | `Bob@123456` | $1,850.00 | Active user, recipient for transfers |
| **User (Charlie)** | `charlie@example.com` | `Alice@123456` | $0.00 | Pending KYC verification flow demonstration |

*(You can also use the one-click persona switcher under the **Bootstrap & Switcher** tab in the UI).*

---

## 🛡️ First Administrator Bootstrap

To bootstrap the first administrator using the secure operator token:

**Endpoint:** `POST /api/auth/bootstrap-admin`  
**Payload:**
```json
{
  "bootstrapToken": "BV_BOOTSTRAP_SECURE_TOKEN_2026",
  "fullName": "Primary Audit Administrator",
  "email": "newadmin@balancevault.com",
  "password": "Admin@123456"
}
```

---

## 🔬 Cryptographic Proof Verification

To verify the mathematical non-tampering proof of the ledger at any time:

- **Via Web UI:** Open the **Provable Ledger** tab and click **"Verify Cryptographic Integrity"**.
- **Via API:**
  ```bash
  curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/ledger/verify-integrity
  ```
  **Response:**
  ```json
  {
    "isValid": true,
    "totalEntries": 4,
    "latestSequenceNumber": 4,
    "latestHash": "0743bdf37bb523...",
    "genesisHash": "0000000000000000000000000000000000000000000000000000000000000000",
    "message": "All 4 ledger entries cryptographically verified. Zero tampering detected."
  }
  ```

---

## 📁 Repository Structure

```
├── public/                 # Interactive frontend single-page application
│   ├── index.html          # Clean dashboard, ledger explorer, transfer UI
│   └── app.js              # State management, API client, verification visualizer
├── server/                 # Node.js backend
│   ├── index.js            # Express server initialization & routing
│   ├── config.js           # Environment & token configuration
│   ├── db.js               # Database layer with transactional persistence & seed data
│   ├── ledger.js           # SHA-256 cryptographic ledger engine & proof validator
│   ├── migrate.js          # Migration runner
│   ├── test.js             # Automated verification test suite (13 passing tests)
│   ├── middleware/         # Auth (JWT/RBAC), Rate Limiting, Audit loggers
│   └── routes/             # Health, Auth, Accounts, Transfers, Ledger, Admin, Onboarding
├── prisma/
│   └── schema.prisma       # Complete PostgreSQL/Prisma schema
├── PROMPTS.md              # Engineering prompt history, AI error corrections & fixes
├── SUBMISSION.md           # Pre-formatted submission answers for the hiring portal
└── package.json            # Project manifest & run scripts
```

---

## 📄 License
MIT License &bull; Developed by Shaik Baji Bee for Snovasys Hiring Challenge 2026.
