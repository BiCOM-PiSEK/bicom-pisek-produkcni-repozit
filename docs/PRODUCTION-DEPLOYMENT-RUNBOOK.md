# PRODUCTION-DEPLOYMENT-RUNBOOK — Bicom Písek

> Operační návod pro nasazení aplikace na produkci (Cloudflare Pages).

---

## 📋 Přehled

- **Infrastruktura:** Cloudflare Pages (frontend) + Workers (API) + D1 (database) + R2 (media) + KV (cache)
- **Repository:** https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit
- **Production domain:** https://bicom-pisek.cz
- **Branch:** `main` (auto-deploy from Pages build)
- **Build status:** Check [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → bicom-pisek → Build History

---

## 🚀 Deployment Pipeline

### 1. Lokální Setup (Developer Machine)
```bash
# Clone repo (personal fork)
git clone https://github.com/{YOUR_GITHUB_USERNAME}/bicom-pisek-produkcni-repozit.git
cd bicom-pisek-produkcni-repozit

# Install dependencies
npm install

# Verify local env
cat .dev.vars                    # Dev environment variables (D1 local, KV mock)
npm run dev                      # Start local Pages dev server + workers
```

### 2. Commit & Push to `main`
```bash
git add .
git commit -m "feat: describe change

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main              # Push to personal fork
```

### 3. GitHub Pull Request (Optional but Recommended)
- Create PR from fork → upstream (BiCOM-PiSEK/bicom-pisek-produkcni-repozit) → `main`
- Wait for CodeRabbit review
- Address review comments
- Squash & merge to main (upstream)
- If your local fork lags behind upstream/main or production, rebase/sync first so you do not reintroduce already-solved production state.

### 4. Cloudflare Pages Auto-Deploy
- Once merged to `upstream/main`, Pages automatically triggers a build
- Build checks out `main`, runs `npm run build`
- Artifacts deployed to https://bicom-pisek.cz
- View build logs in Cloudflare Dashboard → Pages → bicom-pisek → Build History

---

## ⚙️ wrangler.toml Configuration

### Environment Structure
```toml
# Global (shared across all envs)
account_id = "..." 
name = "bicom-pisek"
type = "pages"
main = "functions/pages.js"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "bicom-pisek-db"
database_id = "..."

# R2 Media Storage
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "bicom-multimedia"

# KV Namespace
[[kv_namespaces]]
binding = "CACHE"
id = "..."

# Queues (booking, social jobs)
[[queues.consumers]]
queue = "booking-jobs"
handler = "booking"

[[queues.consumers]]
queue = "social-jobs"
handler = "social"

# Workers AI (Llama 3)
[ai]
binding = "AI"

# Environment-Specific Overrides
[env.production]
route = "bicom-pisek.cz/*"
[[env.production.d1_databases]]
binding = "DB"
database_name = "bicom-pisek-db"  # Production D1 resource

[[env.production.r2_buckets]]
binding = "MEDIA"
bucket_name = "bicom-multimedia"

[env.preview]
route = "*.pages.dev/*"
# Uses same D1/R2/KV resources (can be different if needed)
```

### Adding New Secrets

**For Pages (Production/Preview):**
```bash
# Set a Pages secret (accessible to both production & preview env)
npx wrangler pages secret put SECRET_NAME --project-name bicom-pisek

# Prompted: Enter value → press Enter
# Secret is now available in functions as `env.SECRET_NAME`
```

**Common Secrets:**
- `RESEND_API_KEY` — Email delivery (monitoring alerts, user notifications)
- `INTERNAL_API_SECRET` — Internal API authentication (health checks, CMS operations)
- `MAINTENANCE_ENABLED` — Boolean flag (true = maintenance page, false = full access)
- `SECRET_GOOGLE_CALENDAR_IMPERSONATE` — Google Calendar Domain-Wide Delegation key
- `SECRET_IDOKLAD_CLIENT_ID/SECRET` — Invoicing system
- `SECRET_META_IG_USER_ID` — Instagram/Facebook integration
- `SECRET_STRIPE_PROD_*` — Stripe production keys (checkout, webhook)
- `SECRET_RESEND_MONITORING_API_KEY` — Resend API for monitoring alerts (separate from user notifications)

**Check stored secrets:**
```bash
npx wrangler pages secret list --project-name bicom-pisek
```

---

## 🧪 Smoke Tests (Post-Deployment)

Run these checks after deployment to verify production health:

### 1. Frontend Availability
```bash
curl -s https://bicom-pisek.cz | head -20
# Should return HTTP 200 + HTML (no 503 maintenance page)
```

### 2. API Health Check
```bash
curl -s https://bicom-pisek.cz/api/_monitor-health \
  -H "Authorization: Bearer {INTERNAL_API_SECRET}"
# Should return: { "status": "ok", "timestamp": "..." }
```

### 3. Synthetic Monitoring Test
```bash
curl -X POST https://bicom-pisek.cz/api/synthetic-test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {INTERNAL_API_SECRET}" \
  -d '{"test_name":"smoke_test","url":"https://bicom-pisek.cz"}'
# Should queue test; check `synthetic_test_results` table in D1
```

### 4. Email Alert Delivery
```bash
# Trigger a test alert (monitoring should send email)
curl -X POST https://bicom-pisek.cz/api/_perf-log \
  -H "Content-Type: application/json" \
  -d '{"metrics":{"LCP":5000}}'
# Email should arrive in inbox within 60s
```

### 5. Database Integrity
```bash
# Connect to production D1 via MCP or CLI
npx wrangler d1 execute bicom-pisek-db --remote --command \
  "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table';"
# Should return 25+ tables
```

---

## 🔍 Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| Cloudflare Pages build fails | Missing env vars or build script error | Check `wrangler pages secret list`, verify `npm run build` locally works |
| 503 Maintenance page shows | `MAINTENANCE_ENABLED=true` in production | Run `npx wrangler pages secret put MAINTENANCE_ENABLED` with value `false` |
| API returns 500 | Secret missing or D1 connection issue | Verify secrets via `wrangler pages secret list`; check D1 remote via MCP |
| Email alerts not arriving | Resend key invalid or domain not verified | Verify DKIM/SPF in Resend dashboard; test with `curl` to `/api/_perf-log` |
| Hamburger menu broken on mobile | CSS/z-index regression | Inspect viewport width at 375px; check `src/pages/index.js` media queries |
| Cloudflare Access branding looks generic | Access branding is configured only in Zero Trust dashboard | Set logo/colors/text in Cloudflare Zero Trust → Access branding; OTP e-mail itself cannot be themed from the repo |

---

## 📊 Monitoring & Logs

- **Build logs:** Cloudflare Dashboard → Pages → bicom-pisek → Deployments
- **Runtime logs:** Cloudflare Dashboard → Workers → bicom-pisek-* (each worker)
- **Database logs:** `SELECT * FROM audit_log LIMIT 50;` (D1 production)
- **Performance logs:** `SELECT * FROM performance_logs ORDER BY created_at DESC LIMIT 100;` (D1)
- **Monitoring alerts:** Check email inbox (Resend delivery logs)

---

## ⚡ Quick Emergency Procedures

### Enable Maintenance Mode (Immediate)
```bash
npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
# Enter: true
# Confirm: Requires confirmation; Page now shows "Under Maintenance"
```

### Disable Maintenance Mode (Resume Service)
```bash
npx wrangler pages secret put MAINTENANCE_ENABLED --project-name bicom-pisek
# Enter: false
# Page returns to normal
```

### Rollback Deployment
```bash
# Identify last stable deployment in Cloudflare Dashboard
# Click "Rollback" button on that deployment
# (Auto-reverts Pages to that commit)
```

### Manual D1 Backup (Urgent)
```bash
npx wrangler d1 execute bicom-pisek-db --remote --command \
  ".dump" > bicom-pisek-db-backup-$(date +%s).sql
# Exports all tables to file; upload to safe storage
```

---

## 📚 Related Docs
- [INCIDENT_RESPONSE_GUIDE.md](INCIDENT_RESPONSE_GUIDE.md) — How to handle alerts
- [PRODUCTION-SECRETS-CHECKLIST.md](PRODUCTION-SECRETS-CHECKLIST.md) — Secret management details
- [docs/CMS_GUIDE.md](CMS_GUIDE.md) — Content management for operators
- [wrangler.toml](../wrangler.toml) — Full configuration reference

---

## 🎨 Cloudflare Access branding (dashboard-only)

Access OTP e-mail templates are controlled by Cloudflare and cannot be restyled in the repo. The practical middle path is to brand the **Access login page** in the Cloudflare Zero Trust dashboard:

1. Open **Zero Trust → Access → Branding**.
2. Upload the BiCOM Písek logo and set the brand colors.
3. Save the changes and verify the `/admin` login flow.

This keeps the auth flow intact while making the entry experience look like BiCOM Písek instead of a stock Cloudflare screen.
