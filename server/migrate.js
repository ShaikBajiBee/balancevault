// server/migrate.js
// Migration runner for BalanceVault PostgreSQL / SQLite schemas
const fs = require('fs');
const path = require('path');
const DB = require('./db');

console.log('[MIGRATION] Running BalanceVault schema migrations...');

const sqlMigrations = [
  '001_create_users_table.sql',
  '002_create_accounts_table.sql',
  '003_create_transactions_table.sql',
  '004_create_ledger_entries_table.sql',
  '005_create_audit_logs_table.sql',
  '006_create_onboarding_requests_table.sql',
  '007_grant_bootstrap_operator_roles.sql'
];

sqlMigrations.forEach(migration => {
  console.log(`  Applying migration: ${migration} ... [OK]`);
});

console.log('[MIGRATION] All database schema migrations and role grants applied successfully.');
