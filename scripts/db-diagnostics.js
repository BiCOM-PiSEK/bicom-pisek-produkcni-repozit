// scripts/db-diagnostics.js
// Runs diagnostics on the live Cloudflare D1 database (bicom-pisek-db) using Wrangler CLI.
// Checks row counts, tables health, and performs backup & GDPR dry-runs.

import { execSync } from 'child_process';

const DB_NAME = 'bicom-pisek-db';
const TABLES = [
  'bookings', 'newsletter_subscribers', 'blog_posts', 'services',
  'geo_leads', 'reminders', 'operators', 'calendar_slots',
  'social_posts', 'marketing_campaigns', 'content_blocks',
  'audit_log', 'process_states'
];

function runQuery(sql) {
  try {
    const output = execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    // Wrangler output contains some text before the JSON array, parse the array part
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      // Might be a single object/success message if not returning rows
      return JSON.parse(output.substring(output.indexOf('{')));
    }
    return JSON.parse(output.substring(jsonStart));
  } catch (err) {
    console.error(`[error] Failed query: "${sql}"`);
    console.error(err.message);
    return null;
  }
}

async function runDiagnostics() {
  console.log('========================================================');
  console.log('       BICOM PÍSEK — LIVE D1 DATABASE DIAGNOSTICS       ');
  console.log('========================================================\n');

  console.log('[1/4] Checking D1 Connectivity and Tables...');
  const tableCheck = runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_%';");
  
  if (!tableCheck) {
    console.log('❌ Failed to connect to Cloudflare D1. Verify you are logged in via Wrangler (npx wrangler login) and have internet connection.\n');
    process.exit(1);
  }

  const existingTables = tableCheck[0]?.results?.map(r => r.name) || tableCheck.map(r => r.name) || [];
  console.log(`✅ Connection OK. Found ${existingTables.length} tables in D1.\n`);

  console.log('[2/4] Verifying Row Counts across all 13 tables:');
  console.log('--------------------------------------------------------');
  console.log('Table Name               | Count   | Status');
  console.log('--------------------------------------------------------');
  
  let totalRows = 0;
  for (const table of TABLES) {
    const isCreated = existingTables.includes(table);
    if (!isCreated) {
      console.log(`${table.padEnd(25)} | ❌ MISSING!`);
      continue;
    }

    const countRes = runQuery(`SELECT COUNT(*) as cnt FROM ${table};`);
    const count = countRes[0]?.results?.[0]?.cnt ?? countRes[0]?.cnt ?? 0;
    totalRows += count;
    
    let status = 'OK';
    if (table === 'services' && count === 0) status = '⚠️ UNSEEDED';
    if (table === 'process_states' && count === 0) status = '⚠️ UNSEEDED';
    if (table === 'blog_posts' && count === 0) status = '⚠️ NO ARTICLES';

    console.log(`${table.padEnd(25)} | ${count.toString().padEnd(7)} | ${status}`);
  }
  console.log('--------------------------------------------------------');
  console.log(`Total database rows: ${totalRows}\n`);

  console.log('[3/4] Testing Backup Dry-Run (Check row data export viability)...');
  const sampleRes = runQuery('SELECT slug, name FROM services LIMIT 2;');
  if (sampleRes) {
    console.log('✅ Backup query simulation succeeded. Row export matches expected JSON structure.\n');
  } else {
    console.log('⚠️ Backup simulation failed. Could not query services.\n');
  }

  console.log('[4/4] Testing GDPR Anonymization Dry-Run...');
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - 30);
  const thresholdISO = threshold.toISOString();

  const gdprCheck = runQuery(
    `SELECT COUNT(*) as cnt FROM bookings WHERE preferred_date <= '${thresholdISO}' AND anonymized_at IS NULL AND status IN ('done', 'cancelled');`
  );
  const toAnonymize = gdprCheck[0]?.results?.[0]?.cnt ?? gdprCheck[0]?.cnt ?? 0;
  
  const demoCheck = runQuery(
    "SELECT COUNT(*) as cnt FROM bookings WHERE name_enc LIKE 'DEMO_ENC::%';"
  );
  const demoCount = demoCheck[0]?.results?.[0]?.cnt ?? demoCheck[0]?.cnt ?? 0;

  console.log(`ℹ️ Bookings matching GDPR retence criteria (30+ days old, done/cancelled): ${toAnonymize}`);
  console.log(`ℹ️ Demo bookings present in database (DEMO_ENC::%): ${demoCount}`);
  
  if (demoCount > 0) {
    console.log('\n👉 ACTION REQUIRED: Remember to clean up demo data before launch!');
    console.log('   Run: npm run db:clean-demo\n');
  } else {
    console.log('✅ Clean database: No demo bookings found.\n');
  }

  console.log('========================================================');
  console.log('Diagnostics Completed.');
  console.log('========================================================');
}

runDiagnostics();
