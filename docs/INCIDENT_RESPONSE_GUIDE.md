# INCIDENT_RESPONSE_GUIDE — Bicom Písek

> Operační návod pro řešení produkčních incidentů a monitorovacích alertů.

---

## 🚨 Alert Flow

```
Monitoring system detects problem
         ↓
Query `synthetic_test_results` / `bug_registry` / alert trigger
         ↓
Email alert sent (Resend SMTP → team inbox)
         ↓
Team member receives notification
         ↓
Classify severity + diagnose
         ↓
Execute runbook OR escalate
```

---

## 📋 Common Scenarios & Responses

### Scenario 1: Hamburger Menu Not Expanding (Mobile)

**Alert:** "Hamburger menu broken on 375px viewport"

**Diagnosis:**
```bash
# 1. Check CSS media queries
grep -n "@media.*375\|@media.*small" src/pages/index.js

# 2. Test locally
npm run dev
# Browser DevTools: Emulate device width 375px → click menu → verify expansion

# 3. Check z-index stack conflicts
grep -n "z-index\|z-10\|z-20" src/**/*.css | sort
```

**Remediation (Quick):**
```css
/* Add to _middleware.js or inline in html */
.hamburger-menu {
  position: relative;
  z-index: 1000;  /* Ensure above other elements */
}

.hamburger-menu.expanded {
  display: block;  /* Force visibility */
}
```

**Remediation (Full):**
1. Edit `src/pages/index.js` → CSS section → update media query breakpoint
2. Test locally across viewports (320px, 375px, 768px, 1024px)
3. Commit: `fix: hamburger menu z-index & expansion at 375px`
4. Push to `main` → Cloudflare Pages auto-deploys
5. Verify in production: https://bicom-pisek.cz with Chrome DevTools mobile emulation

---

### Scenario 2: Email Alerts Not Arriving (Monitoring)

**Alert:** "Resend delivery failed: 550 Invalid recipient"

**Diagnosis:**
```bash
# 1. Verify Resend API key is set
npx wrangler pages secret list --project-name bicom-pisek | grep RESEND

# 2. Check if domain is verified in Resend dashboard
# Go to: https://resend.com/emails → Domains → bicom-pisek.cz → DKIM/SPF

# 3. Query failed sends in D1
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT * FROM audit_log WHERE action LIKE '%email%' AND status='failed' LIMIT 10;"

# 4. Test email delivery directly
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer {RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "alerts@bicom-pisek.cz",
    "to": "your@email.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

**Remediation:**
1. **If domain not verified:** Follow Resend setup → add DKIM/SPF records to DNS
2. **If key invalid:** Run `npx wrangler pages secret put RESEND_API_KEY --project-name bicom-pisek` → paste new key
3. **If recipient invalid:** Update alert recipient email in `/admin/settings` or D1 `monitoring_config.alert_email`
4. **Test:** Trigger test alert → check inbox + spam folder within 60s

---

### Scenario 3: D1 Database Connection Timeout

**Alert:** "Error: Database timeout at /api/booking-availability"

**Diagnosis:**
```bash
# 1. Check D1 production status
npx wrangler d1 execute bicom-pisek-db --remote --command "SELECT 1;"

# 2. Query performance logs
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT query_time_ms, query_type, status FROM performance_logs WHERE status='timeout' ORDER BY created_at DESC LIMIT 20;"

# 3. Check table lock contention
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT table_name, COUNT(*) as lock_count FROM sqlite_master WHERE type='table' GROUP BY table_name ORDER BY lock_count DESC;"

# 4. Identify slow queries
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT * FROM performance_logs WHERE query_time_ms > 500 ORDER BY created_at DESC LIMIT 10;"
```

**Remediation:**
1. **Immediate:** Enable maintenance mode while investigating
   ```bash
   npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
   # Enter: true
   ```

2. **Investigate:** Check if there's a runaway query
   ```bash
   # Kill any stuck connections (D1 auto-cleanup in 5min)
   # Or restart Pages deployment via Cloudflare Dashboard
   ```

3. **Optimize:** If query is slow, add index or rewrite
   ```bash
   npx wrangler d1 execute bicom-pisek-db --remote --command \
     "CREATE INDEX idx_booking_slot ON bookings(slot_start) WHERE status='confirmed';"
   ```

4. **Resume:** Re-enable access
   ```bash
   npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
   # Enter: false
   ```

5. **Document:** Add incident note to this runbook + update ROADMAP if structural fix needed

---

### Scenario 4: Monitoring Synthetic Test Failure

**Alert:** "/api/_monitor-health returned 500"

**Diagnosis:**
```bash
# 1. Check error logs
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT * FROM bug_registry WHERE severity='error' ORDER BY created_at DESC LIMIT 20;"

# 2. Trigger health check manually
curl -s https://bicom-pisek.cz/api/_monitor-health \
  -H "Authorization: Bearer {INTERNAL_API_SECRET}"

# 3. Check if API secret is set
npx wrangler pages secret list --project-name bicom-pisek | grep INTERNAL_API_SECRET

# 4. View real-time logs (Pages Functions)
npx wrangler tail --project-name bicom-pisek
```

**Remediation:**
1. Check if Pages build succeeded: Cloudflare Dashboard → Pages → bicom-pisek → Deployments
2. If build failed, view error logs + fix code locally → push to main
3. If API secret missing: `npx wrangler pages secret put INTERNAL_API_SECRET --project-name bicom-pisek`
4. If D1 connection issue: Follow **Scenario 3** steps
5. Verify recovery: `curl -s https://bicom-pisek.cz/api/_monitor-health` should return 200

---

### Scenario 5: Performance Degradation (High LCP)

**Alert:** "LCP (Largest Contentful Paint) = 3500ms (threshold 2500ms)"

**Diagnosis:**
```bash
# 1. Query performance logs
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT * FROM performance_logs WHERE metric_name='LCP' AND created_at > datetime('now', '-1 hour') ORDER BY metric_value DESC LIMIT 20;"

# 2. Check if issue is frontend (JS, CSS, images) or backend (API response time)
# Open https://bicom-pisek.cz in Chrome DevTools → Lighthouse
# Run performance audit → identify bottleneck

# 3. Check Page Insights
# Open https://pagespeed.web.dev/ → https://bicom-pisek.cz → analyze
```

**Remediation:**
1. **If asset size too large:** Compress images/CSS (ImageOptim, PurgeCSS)
2. **If API too slow:** Query `/api/*` endpoints, add caching layer (KV, CloudFlare Cache)
3. **If render-blocking JS:** Defer/async scripts; move to Workers if compute
4. **If hero image loads late:** Use `loading="eager"` + WebP + srcset
5. Test locally: `npm run build && npm run preview`
6. Benchmark improvement: Re-run Lighthouse after fix

---

## 🔧 Maintenance Mode (Emergency Stop)

### Activate Maintenance
```bash
npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
# Enter: true
# Confirm: y

# Result: All requests redirect to https://bicom-pisek.cz/?maintenance=1
# Shows: "Under Maintenance — Please check back soon"
```

### Deactivate Maintenance
```bash
npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
# Enter: false
# Confirm: y

# Result: Normal operation resumes
```

### What Happens During Maintenance
- Public web blocked (503-like response)
- Admin console: Works (if you bypass via direct /admin link + valid JWT)
- API: Blocked (returns 503)
- Monitoring: Still pings (to verify maintenance is intentional)

---

## 📞 Escalation Paths

| Severity | Response Time | Action | Escalate To |
|----------|---|---|---|
| **CRITICAL** (app down, data loss, security breach) | < 15 min | Enable maintenance → diagnose → fix OR rollback → notify clients | Product Owner + DevOps Lead |
| **HIGH** (performance degraded, partial feature down) | < 1 hour | Diagnose → apply quick fix → monitor → notify if extended | Tech Lead + Support |
| **MEDIUM** (single user report, minor feature bug) | < 4 hours | Diagnose → document in `bug_registry` → add to next sprint | Dev Team |
| **LOW** (cosmetic, typo, future nice-to-have) | Next sprint | Document in GitHub Issues → add `cesta-b-4` label | Backlog |

---

## 📝 Post-Incident Procedure

After each incident:
1. **Document in audit log:**
   ```bash
   # Manually add to WORK-DIARY.md or create GitHub Issue
   ```

2. **Update this runbook** with new scenario if applicable

3. **Add monitoring test** to prevent recurrence:
   ```bash
   # Example: If hamburger broke on mobile, add synthetic test for 375px viewport
   ```

4. **Review in team standup** — discuss root cause + preventive measures

5. **Archive logs:**
   ```bash
   npx wrangler d1 execute bicom-pisek-db --remote --command \
     ".dump" > backups/incident-dump-$(date +%Y-%m-%d_%H%M).sql
   ```

---

## 📚 Related Docs
- [PRODUCTION-DEPLOYMENT-RUNBOOK.md](PRODUCTION-DEPLOYMENT-RUNBOOK.md) — Deployment & smoke tests
- [PRODUCTION-SECRETS-CHECKLIST.md](PRODUCTION-SECRETS-CHECKLIST.md) — Secret management
- [docs/CMS_GUIDE.md](CMS_GUIDE.md) — CMS operations (if content broken)
- [docs/ROADMAP.md](ROADMAP.md) — Project status context
- [Cloudflare Dashboard](https://dash.cloudflare.com/) — Pages logs, worker tails, D1 admin
- [Resend Email Dashboard](https://resend.com/) — Email delivery logs + domain verification
