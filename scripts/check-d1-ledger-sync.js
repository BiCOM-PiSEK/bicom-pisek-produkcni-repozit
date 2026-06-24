#!/usr/bin/env node

const flag = String(process.env.D1_LEDGER_SYNC_CONFIRMED || "").toLowerCase();
const confirmed = flag === "true" || flag === "1" || flag === "yes";

if (!confirmed) {
  console.error("[db:migrate] Blocked: D1 migration ledger preflight not confirmed.");
  console.error(
    "[db:migrate] Migrations 0016-0020 were applied manually and must be recorded in d1_migrations before CLI apply."
  );
  console.error(
    "[db:migrate] After ledger sync is completed, rerun with D1_LEDGER_SYNC_CONFIRMED=true npm run db:migrate"
  );
  process.exit(1);
}

console.log("[db:migrate] Ledger preflight confirmed (D1_LEDGER_SYNC_CONFIRMED=true).");
