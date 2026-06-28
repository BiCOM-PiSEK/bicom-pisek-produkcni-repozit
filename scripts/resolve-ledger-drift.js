// scripts/resolve-ledger-drift.js
// Synchronizes the d1_migrations ledger table with migrations present in db/migrations.
// This is used when migrations were applied manually or out-of-order, causing a drift.
//
// Usage:
//   node scripts/resolve-ledger-drift.js          <- Dry-run (checks only)
//   node scripts/resolve-ledger-drift.js --apply  <- Applies drift resolution

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const DB_NAME = 'bicom-pisek-db';
const MIGRATIONS_DIR = './db/migrations';
const isApply = process.argv.includes('--apply');
const WRANGLER_JS = path.resolve('node_modules/wrangler/bin/wrangler.js');

function runQuery(sql) {
  try {
    const args = [WRANGLER_JS, 'd1', 'execute', DB_NAME, '--remote', '--json', `--command=${sql}`];
    const output = execFileSync('node', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      const match = output.match(/\{.*\}/s);
      return match ? JSON.parse(match[0]) : null;
    }
    return JSON.parse(output.substring(jsonStart));
  } catch (err) {
    console.error(`[error] Query failed: "${sql}"`);
    console.error(err.message);
    return null;
  }
}

async function resolveDrift() {
  console.log('========================================================');
  console.log('       BICOM PÍSEK — D1 MIGRATIONS LEDGER SYNC          ');
  console.log('========================================================\n');

  console.log('Reading migration files from:', MIGRATIONS_DIR);
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`❌ Migrations directory ${MIGRATIONS_DIR} does not exist.`);
    process.exit(1);
  }

  // Get migration files from repo (excluding new migrations that we actually want to execute)
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && f !== '0021_chat_messages.sql')
    .sort();

  console.log(`Found ${files.length} migrations in repository.`);

  // Get applied migrations from live D1 database
  console.log('Fetching applied migrations from D1 (remote)...');
  const appliedQuery = runQuery('SELECT id, name FROM d1_migrations ORDER BY id ASC;');
  
  if (!appliedQuery) {
    console.error('❌ Failed to read d1_migrations table. Check connection/auth.');
    process.exit(1);
  }

  const appliedRows = appliedQuery[0]?.results || appliedQuery || [];
  console.log(`Found ${appliedRows.length} applied migrations in D1 database.\n`);

  const appliedNames = new Set(appliedRows.map(r => r.name));
  const missingMigrations = [];

  // Compare files with DB
  for (const file of files) {
    if (!appliedNames.has(file)) {
      // Determine next ID or parse ID from filename prefix
      const match = file.match(/^(\d+)_/);
      const parsedId = match ? parseInt(match[1], 10) : null;
      missingMigrations.push({ id: parsedId, name: file });
    }
  }

  if (missingMigrations.length === 0) {
    console.log('✅ Success: Ledger is fully synchronized. No drift detected.');
    process.exit(0);
  }

  console.log(`⚠️ Drift detected: ${missingMigrations.length} migrations exist in repo but not in D1 ledger:`);
  missingMigrations.forEach(m => {
    console.log(`  - [ID: ${m.id}] ${m.name}`);
  });
  console.log('');

  if (!isApply) {
    console.log('👉 DRY RUN ONLY. No changes made.');
    console.log('   To resolve the drift and mark these migrations as applied, run:');
    console.log('   node scripts/resolve-ledger-drift.js --apply\n');
    process.exit(0);
  }

  // Apply drift resolution
  console.log('Applying drift resolution (marking as applied)...');
  
  for (const m of missingMigrations) {
    console.log(`Marking as applied: ${m.name} (ID: ${m.id})...`);
    // Insert into d1_migrations. Let SQLite auto-increment the ID to avoid primary key conflicts.
    if (!/^\d+_[A-Za-z0-9_]+\.sql$/.test(m.name)) {
      console.error(`  ❌ Unexpected migration filename: ${m.name}`);
      process.exit(1);
    }
    const escapedName = m.name.replace(/'/g, "''");
    const sql = `INSERT INTO d1_migrations (name) VALUES ('${escapedName}');`;
    const res = runQuery(sql);
    if (res) {
      console.log(`  ✓ Marked ${m.name} successfully.`);
    } else {
      console.error(`  ❌ Failed to mark ${m.name}.`);
    }
  }

  console.log('\n========================================================');
  console.log('Drift resolution completed.');
  console.log('========================================================');
}

resolveDrift();
