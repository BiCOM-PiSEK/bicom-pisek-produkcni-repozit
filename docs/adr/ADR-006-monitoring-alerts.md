# ADR-006: Production Monitoring & Email Alert Architecture

**Status:** ACCEPTED (Phase 2.5, 2026-06-21)  
**Author:** MEVERIK STUDIO  
**Date:** 2026-06-21  
**Related Issues:** Phase 2.5 monitoring integration, bug detection workflow

---

## 1. Problém

Production web (bicom-pisek.cz) potřeboval **real-time visibility** do:
- Chyb a výjimek v runtime (JavaScript, API, D1, integrace)
- Performance degradace (Web Vitals: LCP, INP, CLS, TTFB)
- Email delivery failures (Resend)
- Zálohy a GDPR automation

Bez tohoto nemohl ops tým (ani server) detekovat problémy dřív, než je klient nahlásí *(example: hamburger menu regression 2026-06-23)*.

---

## 2. Řešení

Implementovali jsme **3-vrstvý monitoring + alert** architektura:

```
┌─────────────────────────────────────────────────────┐
│ 1. SYNTHETIC HEALTH CHECK                           │
│    └─ /api/_monitor-health (every 5 min, 375px)    │
│       └─ Ověří: Core DOM, Form inputs, API uptime  │
│       └─ Data → synthetic_test_results table        │
├─────────────────────────────────────────────────────┤
│ 2. BUG REGISTRY (Runtime & Integration)             │
│    └─ Catch-all: errors v /api/*, /admin/*, D1     │
│    └─ Auto-capture: message, stack, source, context│
│    └─ Data → bug_registry table                     │
├─────────────────────────────────────────────────────┤
│ 3. EMAIL ALERTS (Decision Tree)                     │
│    └─ Synthetic FAIL → Email alert (ops email)     │
│    └─ Bug count > 5 (1h window) → Escalation email  │
│    └─ Email delivery error → Resend webhook check   │
│    └─ Via Resend API (separate RESEND_API_KEY)     │
└─────────────────────────────────────────────────────┘
```

### 2.1 Synthetic Health Check (`/api/_monitor-health`)

**Cíl:** Simulovat uživatelský journey (browser-like), detekovat UI/UX breakdowns

**Implementace:**
```javascript
// Cron: every 5 minutes (via wrangler.toml [triggers.crons])
// Context: 375px mobile viewport + desktop (1024px)
// Ověří:
// - DOM ready + hamburger menu clickable
// - Form inputs accessible
// - API endpoints responsive
// - D1 uptime check
```

**Výstup → `synthetic_test_results` tabulka:**
- `test_id` (UUID)
- `test_date` (CURRENT_TIMESTAMP)
- `test_type` ("dom_ready", "form_input", "api_health", "d1_uptime")
- `success` (0/1)
- `message` (error details if failed)
- `response_time_ms`

**Alert trigger:** Pokud `success=0`, ops email se pošle s alertem

### 2.2 Bug Registry (Auto-Capture)

**Cíl:** Všechny uncaught exceptions v production se zaznamenají (bez personálních dat)

**Implementace:**
- Globální try-catch wrapper v `functions/` middleware
- Middleware chytá:
  - `/api/*` exceptions
  - `/admin/*` authorization failures
  - D1 query timeouts
  - Integration errors (Resend, Google Calendar, GoSMS, Stripe)

**Výstup → `bug_registry` tabulka:**
- `id` (UUID)
- `error_type` ("uncaught", "timeout", "integration", "auth_fail")
- `error_message` (sanitized, bez secrets)
- `error_stack` (first 500 chars)
- `source_function` (e.g., "functions/api/book.js")
- `context_json` (request context, bez auth token)
- `created_at` (CURRENT_TIMESTAMP)

**Alert trigger:** Pokud počet bugů v poslední hodině > 5 → escalation email

### 2.3 Email Alerts (Resend)

**Cíl:** Ops tým (Lenka, MEVERIK) dostane notifikaci o kritických problémech

**Implementace:**

#### Alert 1: Synthetic Test Failure
```
To: ops@bicom-pisek.cz
Subject: 🚨 Synthetic Health Check FAILED
Body: 
  Test Type: {test_type}
  Viewport: {viewport}
  Error: {message}
  Response Time: {response_time_ms}ms
  Check: https://dash.cloudflare.com/…/Pages/bicom-pisek
```

#### Alert 2: Bug Escalation (> 5 bugs/hour)
```
To: ops@bicom-pisek.cz
Subject: ⚠️ Bug Spike Detected (5+ errors in 1h)
Body:
  Recent Errors:
    1. {error_type}: {error_message} @ {source_function}
    2. {error_type}: {error_message} @ {source_function}
    ...
  View: Admin → Exceptions
```

**Resend Configuration:**
- API Key: `RESEND_API_KEY` (monitoring-specific, separate from `SECRET_RESEND_API_KEY`)
- From: `alerts@bicom-pisek.cz` (verified via DKIM/SPF)
- Rate limit: 1 alert per 30 min per alert type (prevent spam)

---

## 3. Alternativy a Výběr

| Alternativa | Pros | Cons | Rozhodnutí |
|---|---|---|---|
| **Datadog/New Relic APM** | Professional, feature-rich | Cost, vendor lock-in, overkill pro MVP | ❌ Reject |
| **Sentry error tracking** | Excellent for JS errors | Cost-prohibitive, + D1/email integration complex | ❌ Reject |
| **DIY database + cron checks** | In-budget, full control, leverages existing D1 | Manual alert logic, bare-bones UX | ✅ **CHOSEN** |
| **Google Sheets + Apps Script** | Simple, visible to Lenka | Slow, not reliable, no API integration | ❌ Reject |

### Proč DIY?
1. **Existující infrastruktura** — Máme D1, Resend, Workers, Queues
2. **Lean operations** — Dva lidé (Lenka, MEVERIK), žádný dedicated ops team
3. **Flexibility** — Pravidla alertů se dají měnit bez vendor lock-in
4. **Cost-effective** — Within Cloudflare Free/Pro tier, Resend pay-per-use

### Následující kroky (Phase 4)
- Přidat aplikační APM (node timing v API endpoints, D1 query perf)
- Integrace s Slack (+ email) pro ops channel
- Dashboard pro bug history a trends

---

## 4. Architektonické Rozhodnutí

### 4.1 Synthetic Tests: Mobilem-first (375px)

**Důvod:** Hamburger menu regression byla detekována až když user zmenšil okno — synthetic test musí simulovat to.

**Implementace:**
- Primary check: 375px (mobile) — detekuje responsive failures
- Secondary: 1024px (tablet) — quick sanity check
- DOM parser: `jsdom` (Cloudflare Workers compatible) vs. real browser (too heavy)

### 4.2 Separate Resend Key (`RESEND_API_KEY`)

**Důvod:** Isolace

- Monitoring má vlastní API key (independent quota, revoke bez dopadu na user notifications)
- `SECRET_RESEND_API_KEY` — user notifications (booking confirmations, newsletters)
- `RESEND_API_KEY` — ops alerts

### 4.3 Email Alerts: Lenka + MEVERIK (ops@bicom-pisek.cz)

**Důvod:** Dual accountability

- Lenka = ordinace (business context)
- MEVERIK = developer (technical context)
- Oba dostávají alert → jeden z nich musí reagovat

### 4.4 No Automatic Remediation (v1)

**Úmysl:** Ops musí **vědět** o problému, ale **řešit ručně**

- Automatický restart by mohly zkrýt root cause
- Phase 4: Přidat semi-automated fixes (e.g., toggle MAINTENANCE_ENABLED, clear KV cache)

---

## 5. Implementace a Bindings

### V `wrangler.toml` (Phase 2.5):
```toml
[env.production]
d1_databases = [{binding = "DB", database_name = "bicom-pisek-db"}]
kv_namespaces = [{binding = "KV_CACHE", id = "..."}]
r2_buckets = [{binding = "MULTIMEDIA_BUCKET", bucket_name = "bicom-multimedia"}]
queues = [{binding = "booking-jobs", name = "booking-jobs"}]
ai = [...]

[[env.production.triggers.crons]]
cron = "*/5 * * * *"  # Every 5 min
```

### V `functions/api/`:
- `_monitor-health.js` — Synthetic test runner
- `_bug-capture.js` — Global error handler (middleware)
- `_alert-dispatcher.js` — Email alert logic (Rate-limited)

### V `functions/admin/`:
- `exceptions.js` — UI view do bug_registry
- `monitoring-dashboard.js` — Synthetic test trends

---

## 6. Metriky a Success Criteria

| Metrika | Target | Aktuální |
|---|---|---|
| Synthetic test response time | < 2s | — |
| Alert latency (bug → email) | < 1 min | — |
| False positive rate | < 5% | — |
| Ops notification read time | < 30 min | — |

---

## 7. Rizika a Mitigation

| Riziko | Impact | Mitigation |
|---|---|---|
| Alert fatigue (too many false positives) | Ops ignores alerts | Tuning thresholds, whitelist known patterns |
| Email throttling (ISP thinks spam) | Alerts don't arrive | Rate limit: 1 per 30 min per type; verify DKIM |
| D1 query timeout in synthetic | False fail | Increase timeout, fallback check (non-critical) |
| Resend API key leaked | Attacker sends emails as alerts@bicom-pisek.cz | Rotate key regularly, audit logs, use IP whitelist |

---

## 8. Evoluce a Next Steps

### Phase 3.0 (Aktuálně — June 2026):
- ✅ Synthetic tests (mobile 375px)
- ✅ Bug registry capture
- ✅ Email alerts (Resend)
- ✅ Wrangler.toml binding complete

### Phase 4 (Plánováno):
- [ ] Slack integration (+ email)
- [ ] APM: API response time tracking
- [ ] Semi-automated remediation (maintenance toggle, cache clear)
- [ ] Dashboard: bug trends, synthetic test history
- [ ] PagerDuty/OnCall integration (on-call rotation)

---

## Přílohy

- [PRODUCTION-DEPLOYMENT-RUNBOOK.md](../PRODUCTION-DEPLOYMENT-RUNBOOK.md) — Deployment guide (includes smoke tests)
- [INCIDENT_RESPONSE_GUIDE.md](../INCIDENT_RESPONSE_GUIDE.md) — Alert handling playbook
- [DATABASE_MANAGEMENT.md § Monitoring Tables](../DATABASE_MANAGEMENT.md) — Schema: synthetic_test_results, bug_registry, email_alerts
