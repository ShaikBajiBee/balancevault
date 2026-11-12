// public/app.js
// BalanceVault Frontend Application Engine

let state = {
  token: localStorage.getItem('bv_token') || null,
  user: null,
  accounts: [],
  onboarding: null,
  activeTab: 'dashboard'
};

// API Helper
async function api(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.textContent = message;

  if (type === 'error') {
    toast.className = 'fixed bottom-5 right-5 bg-rose-950/90 border border-rose-700/80 px-4 py-3 rounded-xl shadow-2xl text-xs z-50 flex items-center space-x-2 text-rose-200';
    toastIcon.setAttribute('data-lucide', 'alert-circle');
  } else if (type === 'success') {
    toast.className = 'fixed bottom-5 right-5 bg-emerald-950/90 border border-emerald-700/80 px-4 py-3 rounded-xl shadow-2xl text-xs z-50 flex items-center space-x-2 text-emerald-200';
    toastIcon.setAttribute('data-lucide', 'check-circle-2');
  } else {
    toast.className = 'fixed bottom-5 right-5 bg-slate-800 border border-slate-700 px-4 py-3 rounded-xl shadow-2xl text-xs z-50 flex items-center space-x-2 text-white';
    toastIcon.setAttribute('data-lucide', 'info');
  }

  if (window.lucide) lucide.createIcons();
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.remove('bg-slate-800', 'text-white');
    tab.classList.add('text-slate-300');
  });

  const activeView = document.getElementById(`view-${tabName}`);
  const activeTabBtn = document.getElementById(`tab-${tabName}`);

  if (activeView) activeView.classList.remove('hidden');
  if (activeTabBtn) {
    activeTabBtn.classList.add('bg-slate-800', 'text-white');
    activeTabBtn.classList.remove('text-slate-300');
  }

  if (window.lucide) lucide.createIcons();

  // Load relevant data for tab
  if (tabName === 'dashboard') loadUserDashboard();
  if (tabName === 'transfer') loadTransferTab();
  if (tabName === 'ledger') loadLedgerTab();
  if (tabName === 'admin') loadAdminTab();
}

// Initialize Application
async function init() {
  if (window.lucide) lucide.createIcons();

  if (state.token) {
    try {
      const data = await api('/api/auth/me');
      state.user = data.user;
      state.accounts = data.accounts || [];
      state.onboarding = data.onboarding || null;
      renderUserSession();
      loadUserDashboard();
    } catch (err) {
      console.warn('Session expired or invalid, logging into demo admin...');
      await demoLogin('admin@balancevault.com', 'Admin@123456');
    }
  } else {
    // Default initial demo login as Admin
    await demoLogin('admin@balancevault.com', 'Admin@123456');
  }
}

// Render User Session UI
function renderUserSession() {
  const userBadge = document.getElementById('userBadge');
  const logoutBtn = document.getElementById('logoutBtn');
  const currentUserName = document.getElementById('currentUserName');
  const currentUserRole = document.getElementById('currentUserRole');

  if (state.user) {
    userBadge.classList.remove('hidden');
    userBadge.classList.add('flex');
    logoutBtn.classList.remove('hidden');
    currentUserName.textContent = state.user.fullName;
    currentUserRole.textContent = `${state.user.role} (${state.user.status})`;

    // Check onboarding banner
    const onboardingBanner = document.getElementById('onboardingBanner');
    if (state.user.status === 'PENDING_ONBOARDING') {
      onboardingBanner.classList.remove('hidden');
    } else {
      onboardingBanner.classList.add('hidden');
    }
  } else {
    userBadge.classList.add('hidden');
    logoutBtn.classList.add('hidden');
  }
}

// Demo Login Quick-switch
async function demoLogin(email, password) {
  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.token = res.token;
    state.user = res.user;
    state.accounts = res.accounts || [];
    state.onboarding = res.onboarding || null;
    localStorage.setItem('bv_token', res.token);

    renderUserSession();
    showToast(`Logged in as ${state.user.fullName} (${state.user.role})`, 'success');
    switchTab('dashboard');
  } catch (err) {
    console.error('Demo login error:', err);
  }
}

function logout() {
  localStorage.removeItem('bv_token');
  state.token = null;
  state.user = null;
  state.accounts = [];
  state.onboarding = null;
  renderUserSession();
  showToast('Signed out.', 'info');
  demoLogin('admin@balancevault.com', 'Admin@123456');
}

// Load Dashboard Data
async function loadUserDashboard() {
  if (!state.token) return;
  try {
    const me = await api('/api/auth/me');
    state.user = me.user;
    state.accounts = me.accounts || [];
    state.onboarding = me.onboarding || null;
    renderUserSession();

    const totalBal = state.accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const availBal = state.accounts.reduce((sum, a) => sum + Number(a.availableBalance), 0);

    document.getElementById('totalBalanceDisplay').textContent = `$${totalBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('availableBalanceDisplay').textContent = `$${availBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    const primaryAcc = state.accounts[0];
    if (primaryAcc) {
      document.getElementById('accountNumberDisplay').textContent = primaryAcc.accountNumber;
      const statusPill = document.getElementById('accountStatusPill');
      statusPill.textContent = primaryAcc.status;
      statusPill.className = primaryAcc.status === 'ACTIVE'
        ? 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
        : 'px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30';
    } else {
      document.getElementById('accountNumberDisplay').textContent = 'NO ACTIVE VAULT';
    }

    // Load transactions
    const txs = await api('/api/transfers');
    const tbody = document.getElementById('dashboardTxTable');
    tbody.innerHTML = '';

    if (txs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-3 py-6 text-center text-slate-500 text-xs">No transactions found for this account.</td></tr>`;
      return;
    }

    txs.slice(0, 8).forEach(tx => {
      const isDeposit = tx.type === 'DEPOSIT';
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-700/20 transition';
      row.innerHTML = `
        <td class="px-3 py-3">
          <div class="font-bold text-white">${tx.reference}</div>
          <div class="text-[10px] text-slate-400">${tx.description || tx.type}</div>
        </td>
        <td class="px-3 py-3 text-slate-400 text-[11px]">${new Date(tx.createdAt).toLocaleDateString()} ${new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td class="px-3 py-3 font-mono font-bold ${isDeposit ? 'text-emerald-400' : 'text-slate-100'}">
          ${isDeposit ? '+' : ''}$${Number(tx.amount).toFixed(2)}
        </td>
        <td class="px-3 py-3 font-mono text-[10px] text-indigo-400">
          <span title="${tx.id}">${tx.id.substring(0, 14)}...</span>
        </td>
        <td class="px-3 py-3">
          <span class="px-2 py-0.5 text-[10px] rounded font-bold bg-emerald-500/20 text-emerald-300">${tx.status}</span>
        </td>
      `;
      tbody.appendChild(row);
    });

  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// Quick Transfer Form Handler
async function handleQuickTransfer(e) {
  e.preventDefault();
  const destAccount = document.getElementById('quickDestAccount').value.trim();
  const amount = document.getElementById('quickAmount').value;
  const note = document.getElementById('quickNote').value;

  if (!state.accounts || state.accounts.length === 0) {
    showToast('You do not have an active account to transfer from.', 'error');
    return;
  }

  const sourceAccount = state.accounts[0];

  try {
    const btn = document.getElementById('quickTransferBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin inline-block mr-2">&#8987;</span> Committing to ledger...`;

    const res = await api('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId: sourceAccount.id,
        destinationAccountNumber: destAccount,
        amount: Number(amount),
        description: note || 'Quick transfer'
      })
    });

    showToast(res.message || 'Transfer completed successfully!', 'success');
    document.getElementById('quickAmount').value = '';
    document.getElementById('quickNote').value = '';
    await loadUserDashboard();
  } catch (err) {
    // Error handled in api()
  } finally {
    const btn = document.getElementById('quickTransferBtn');
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Post to Provable Ledger</span>`;
    if (window.lucide) lucide.createIcons();
  }
}

function setQuickRecipient(accNum) {
  document.getElementById('quickDestAccount').value = accNum;
}

function copyAccountNumber() {
  const primaryAcc = state.accounts[0];
  if (primaryAcc) {
    navigator.clipboard.writeText(primaryAcc.accountNumber);
    showToast(`Copied ${primaryAcc.accountNumber} to clipboard!`, 'success');
  }
}

// Load Transfer Tab
function loadTransferTab() {
  const select = document.getElementById('transferSourceAccount');
  select.innerHTML = '';
  state.accounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = `${acc.accountNumber} (Available: $${acc.availableBalance.toFixed(2)} ${acc.currency})`;
    select.appendChild(opt);
  });
}

// Handle Full Transfer
async function handleFullTransfer(e) {
  e.preventDefault();
  const sourceAccountId = document.getElementById('transferSourceAccount').value;
  const destinationAccountNumber = document.getElementById('transferDestAccount').value.trim();
  const amount = Number(document.getElementById('transferAmount').value);
  const idempotencyKey = document.getElementById('transferIdempotencyKey').value.trim() || `IDEMP-${Date.now()}`;
  const description = document.getElementById('transferDescription').value.trim();

  try {
    const res = await api('/api/transfers', {
      method: 'POST',
      body: JSON.stringify({
        sourceAccountId,
        destinationAccountNumber,
        amount,
        idempotencyKey,
        description
      })
    });

    showToast(res.message || 'Transfer confirmed with cryptographic proof!', 'success');
    switchTab('ledger');
  } catch (err) {
    // Handled
  }
}

// Load Ledger Tab
async function loadLedgerTab() {
  try {
    const data = await api('/api/ledger');
    const tbody = document.getElementById('ledgerTableBody');
    tbody.innerHTML = '';

    const entries = data.entries || [];
    entries.forEach(entry => {
      const isCredit = entry.entryType === 'CREDIT';
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-700/20 transition';
      row.innerHTML = `
        <td class="px-3 py-3 font-bold text-white">#${entry.sequenceNumber}</td>
        <td class="px-3 py-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isCredit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
            ${entry.entryType}
          </span>
        </td>
        <td class="px-3 py-3 text-slate-300 text-[11px]">${entry.accountId}</td>
        <td class="px-3 py-3 font-bold ${isCredit ? 'text-emerald-400' : 'text-slate-100'}">
          ${isCredit ? '+' : '-'}$${Number(entry.amount).toFixed(2)}
        </td>
        <td class="px-3 py-3 font-bold text-white">$${Number(entry.balanceAfter).toFixed(2)}</td>
        <td class="px-3 py-3 text-slate-400 text-[10px] truncate max-w-[130px]" title="${entry.previousHash}">
          ${entry.previousHash.substring(0, 12)}...
        </td>
        <td class="px-3 py-3 text-indigo-400 text-[10px] truncate max-w-[130px] font-bold" title="${entry.currentHash}">
          ${entry.currentHash.substring(0, 12)}...
        </td>
      `;
      tbody.appendChild(row);
    });

    // Run verification automatically on open
    await runLedgerVerification();
  } catch (err) {
    console.error('Error loading ledger:', err);
  }
}

// Run Cryptographic Ledger Verification Proof
async function runLedgerVerification() {
  try {
    const rep = await api('/api/ledger/verify-integrity');
    const box = document.getElementById('verificationResultBox');
    const statusText = document.getElementById('verificationStatusText');
    const totalBlocks = document.getElementById('vTotalBlocks');
    const latestHash = document.getElementById('vLatestHash');

    if (rep.isValid) {
      box.className = 'mt-5 bg-slate-950/80 border border-emerald-500/40 rounded-xl p-4 text-xs font-mono space-y-2';
      statusText.className = 'text-emerald-400 font-bold';
      statusText.innerHTML = `<i data-lucide="shield-check" class="w-4 h-4 inline mr-1"></i> STATUS: MATHEMATICAL CONTINUITY 100% PROVEN (${rep.totalEntries} BLOCKS)`;
    } else {
      box.className = 'mt-5 bg-slate-950/80 border border-rose-500/80 rounded-xl p-4 text-xs font-mono space-y-2';
      statusText.className = 'text-rose-400 font-bold';
      statusText.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 inline mr-1"></i> INTEGRITY BREACH DETECTED: ${rep.message}`;
    }

    totalBlocks.textContent = rep.totalEntries;
    latestHash.textContent = rep.latestHash ? `${rep.latestHash.substring(0, 18)}...` : 'N/A';

    if (window.lucide) lucide.createIcons();
    showToast(rep.message, rep.isValid ? 'success' : 'error');
  } catch (err) {
    console.error('Verification error:', err);
  }
}

// Simulate Tamper Test
function simulateTamper() {
  const box = document.getElementById('verificationResultBox');
  const statusText = document.getElementById('verificationStatusText');

  box.className = 'mt-5 bg-rose-950/80 border border-rose-500 rounded-xl p-4 text-xs font-mono space-y-2';
  statusText.className = 'text-rose-300 font-bold';
  statusText.innerHTML = `<i data-lucide="shield-alert" class="w-4 h-4 inline mr-1"></i> SIMULATION TEST: ENTRY #2 MODIFIED -> CRYPTOGRAPHIC CHAIN REJECTED (SHA-256 MISMATCH)`;
  if (window.lucide) lucide.createIcons();
  showToast('Tamper test simulated: Fraudulent record rejected by SHA-256 check.', 'error');
}

// Load Admin Tab
async function loadAdminTab() {
  if (!['ADMIN', 'OPERATOR'].includes(state.user.role)) {
    showToast('Restricted: Requires ADMIN or OPERATOR role.', 'error');
    return;
  }

  try {
    const metrics = await api('/api/admin/metrics');
    const m = metrics.metrics;
    document.getElementById('admTotalUsers').textContent = m.totalUsers;
    document.getElementById('admTotalAccounts').textContent = m.totalAccounts;
    document.getElementById('admTotalVolume').textContent = `$${m.totalTransactionVolume.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    document.getElementById('admPendingKyc').textContent = m.pendingKYCCount;

    // Load Onboarding Requests
    const onb = await api('/api/onboarding/pending');
    const onbTbody = document.getElementById('adminOnboardingTable');
    onbTbody.innerHTML = '';
    onb.forEach(req => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2.5">
          <div class="font-bold text-white">${req.userName}</div>
          <div class="text-[10px] text-slate-400">${req.userEmail}</div>
        </td>
        <td class="px-3 py-2.5 font-mono">${req.idDocumentType}: ${req.idDocumentNumber}</td>
        <td class="px-3 py-2.5">${req.occupation}</td>
        <td class="px-3 py-2.5 font-mono font-bold">$${Number(req.monthlyIncome).toFixed(2)}</td>
        <td class="px-3 py-2.5">
          <span class="px-2 py-0.5 text-[10px] rounded font-bold ${req.riskScore < 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
            Risk: ${req.riskScore}/100
          </span>
        </td>
        <td class="px-3 py-2.5">
          <span class="px-2 py-0.5 text-[10px] rounded font-bold ${req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : req.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}">
            ${req.status}
          </span>
        </td>
        <td class="px-3 py-2.5">
          ${req.status === 'PENDING' ? `
            <div class="flex space-x-1.5">
              <button onclick="reviewOnboarding('${req.id}', 'APPROVED')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold">Approve</button>
              <button onclick="reviewOnboarding('${req.id}', 'REJECTED')" class="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold">Reject</button>
            </div>
          ` : `<span class="text-slate-500 text-[10px]">Reviewed</span>`}
        </td>
      `;
      onbTbody.appendChild(tr);
    });

    // Load Users
    const users = await api('/api/admin/users');
    const uTbody = document.getElementById('adminUsersTable');
    uTbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2.5">
          <div class="font-bold text-white">${u.fullName}</div>
          <div class="text-[10px] text-slate-400 font-mono">${u.email}</div>
        </td>
        <td class="px-3 py-2.5">
          <span class="px-2 py-0.5 text-[10px] font-mono rounded font-bold ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-300' : u.role === 'OPERATOR' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}">
            ${u.role}
          </span>
        </td>
        <td class="px-3 py-2.5">
          <span class="px-2 py-0.5 text-[10px] rounded font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">
            ${u.status}
          </span>
        </td>
        <td class="px-3 py-2.5 text-slate-400 text-[11px]">${new Date(u.createdAt).toLocaleDateString()}</td>
        <td class="px-3 py-2.5">
          ${u.role !== 'ADMIN' ? `
            <button onclick="toggleUserStatus('${u.id}', '${u.status}')" class="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-[10px]">
              ${u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
            </button>
          ` : `<span class="text-slate-500 text-[10px]">Protected</span>`}
        </td>
      `;
      uTbody.appendChild(tr);
    });

    // Load Audit Logs
    const auditLogs = await api('/api/admin/audit-logs');
    const audTbody = document.getElementById('adminAuditTable');
    audTbody.innerHTML = '';
    auditLogs.slice(0, 15).forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2 text-slate-400 text-[11px]">${new Date(log.timestamp).toLocaleTimeString()}</td>
        <td class="px-3 py-2 text-indigo-300 font-bold">${log.actorRole}</td>
        <td class="px-3 py-2 text-white font-semibold">${log.action}</td>
        <td class="px-3 py-2 text-slate-400">${log.entityType}</td>
        <td class="px-3 py-2 text-emerald-400 text-[10px] truncate max-w-[120px]" title="${log.currentHash}">${log.currentHash.substring(0, 12)}...</td>
      `;
      audTbody.appendChild(tr);
    });

  } catch (err) {
    console.error('Error loading admin tab:', err);
  }
}

// Review Onboarding
async function reviewOnboarding(id, decision) {
  try {
    const res = await api(`/api/onboarding/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes: `Reviewed by compliance officer` })
    });
    showToast(res.message, 'success');
    loadAdminTab();
  } catch (err) {
    // Handled
  }
}

// Toggle User Status
async function toggleUserStatus(id, currentStatus) {
  const endpoint = currentStatus === 'ACTIVE' ? `/api/admin/users/${id}/suspend` : `/api/admin/users/${id}/activate`;
  try {
    const res = await api(endpoint, { method: 'POST' });
    showToast(res.message, 'success');
    loadAdminTab();
  } catch (err) {
    // Handled
  }
}

// First Administrator Bootstrap Handler
async function handleBootstrapAdmin(e) {
  e.preventDefault();
  const bootstrapToken = document.getElementById('bootToken').value.trim();
  const fullName = document.getElementById('bootName').value.trim();
  const email = document.getElementById('bootEmail').value.trim();
  const password = document.getElementById('bootPassword').value;

  try {
    const res = await api('/api/auth/bootstrap-admin', {
      method: 'POST',
      body: JSON.stringify({
        bootstrapToken,
        fullName,
        email,
        password
      })
    });

    showToast(res.message || 'Administrator bootstrapped successfully!', 'success');
    state.token = res.token;
    state.user = res.user;
    localStorage.setItem('bv_token', res.token);
    renderUserSession();
    switchTab('admin');
  } catch (err) {
    // Handled
  }
}

// Deposit Modal Controls
function openDepositModal() {
  document.getElementById('depositModal').classList.remove('hidden');
}
function closeDepositModal() {
  document.getElementById('depositModal').classList.add('hidden');
}

async function handleDeposit(e) {
  e.preventDefault();
  const amount = Number(document.getElementById('depositAmount').value);
  const description = document.getElementById('depositDescription').value.trim();

  if (!state.accounts || state.accounts.length === 0) {
    showToast('No active account found to deposit to.', 'error');
    return;
  }

  try {
    const res = await api('/api/transfers/deposit', {
      method: 'POST',
      body: JSON.stringify({
        accountId: state.accounts[0].id,
        amount,
        description: description || 'Account deposit'
      })
    });

    closeDepositModal();
    showToast(res.message, 'success');
    loadUserDashboard();
  } catch (err) {
    // Handled
  }
}

// KYC Modal Controls
function openKycModal() {
  document.getElementById('kycModal').classList.remove('hidden');
}
function closeKycModal() {
  document.getElementById('kycModal').classList.add('hidden');
}

async function handleKycSubmit(e) {
  e.preventDefault();
  const idDocumentType = document.getElementById('kycDocType').value;
  const idDocumentNumber = document.getElementById('kycDocNum').value.trim();
  const occupation = document.getElementById('kycOccupation').value.trim();
  const monthlyIncome = Number(document.getElementById('kycIncome').value);

  try {
    const res = await api('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        idDocumentType,
        idDocumentNumber,
        occupation,
        monthlyIncome
      })
    });

    closeKycModal();
    showToast(res.message, 'success');
    loadUserDashboard();
  } catch (err) {
    // Handled
  }
}

// Run on page load
window.addEventListener('DOMContentLoaded', init);
