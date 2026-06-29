# Mapa úložišť a struktury repozitáře (aktuální stav)

Aktualizováno podle aktuálního obsahu repozitáře. Dokument slouží jako jednotná orientační mapa pro vývoj, handover a audit.

## 1) Úložiště projektu

| Úložiště | Kde | Co obsahuje | Účel |
|---|---|---|---|
| Git repozitář | `BiCOM-PiSEK/bicom-pisek-produkcni-repozit` | celý kód, docs, migrace, statika | source of truth |
| Cloudflare D1 | `bicom-pisek-db` | relační data (bookings, blog, audit, config) | provozní databáze |
| Cloudflare R2 | `bicom-multimedia` | média (fotky/video exporty) | objektové úložiště |
| Cloudflare KV | `bicom-pisek-cache` | cache, rate-limit, pomocné runtime stavy | rychlá edge cache |
| Cloudflare Queues | `booking-jobs`, `social-jobs` | asynchronní joby | odlehčení API |
| Lokální session/inbox artefakty | `~/.copilot/session-state/...` | dočasné pracovní artefakty | mimo repo, necommitovat |

## 2) Kompletní mapa repozitáře (tracked struktura)

```text
.
├── .github/
│   └── AI_AGENT_PROMPT.md
├── .vscode/
│   └── mcp.json
├── db/
│   ├── schema.sql
│   ├── migrations/
│   │   ├── 0001_core_tables.sql
│   │   ├── 0002_geo_reminders.sql
│   │   ├── 0003_audit_operators.sql
│   │   ├── 0004_calendar_social.sql
│   │   ├── 0005_content_management.sql
│   │   ├── 0006_schema_fixes.sql
│   │   ├── 0007_stripe_integration.sql
│   │   ├── 0008_expand_content_type_check.sql
│   │   ├── 0009_add_reminder_channel.sql
│   │   ├── 0010_seed_operators.sql
│   │   ├── 0011_blog_status_expand.sql
│   │   ├── 0012_booking_system.sql
│   │   ├── 0013_booking_slot_unique.sql
│   │   ├── 0014_booking_admin_fields.sql
│   │   └── 0015_booking_no_show.sql
│   └── seed/
│       └── services.sql
├── docs/
│   ├── API_KEYS_CHECKLIST.md
│   ├── ARCHITEKTURA.md
│   ├── ASSET_STRATEGY.md
│   ├── DATABASE_MANAGEMENT.md
│   ├── EDGE_OPS_LOG.md
│   ├── GAP_ANALYSIS_OPPORTUNITIES.md
│   ├── GEO_AEO_SEO_STRATEGY.md
│   ├── GIT_WORKFLOW.md
│   ├── HANDOVER.md
│   ├── REPO_MAPA_ULOZIST.md
│   ├── ROADMAP.md
│   ├── STRIPE_INTEGRATION.md
│   ├── STYLE_BRIEF.md
│   ├── adr/
│   │   ├── ADR-001-cloudflare-first.md
│   │   ├── ADR-002-guardrail-modularni-vrstva.md
│   │   ├── ADR-003-ai-studio.md
│   │   ├── ADR-004-rezervacni-system.md
│   │   └── ADR-005-admin-sprava-rezervaci.md
│   ├── agent-tasks/
│   │   └── WORK-DIARY.md
│   └── assets/
│       └── originals/
│           ├── README.md
│           ├── certificates/.gitkeep
│           ├── gallery/
│           │   ├── .gitkeep
│           │   ├── ordinace-01.png
│           │   ├── ordinace-02.png
│           │   ├── ordinace-03.png
│           │   ├── ordinace-04.png
│           │   └── ordinace-05.png
│           ├── hero/
│           │   ├── .gitkeep
│           │   ├── hero-device-bicom-optima.png
│           │   └── hero-lifestyle-main.png
│           ├── icons/
│           │   ├── .gitkeep
│           │   ├── apple-touch-icon-source.png
│           │   ├── favicon-source.png
│           │   ├── icon-bolest-a-pohybovy-aparat-trans.png
│           │   ├── icon-bolest-a-pohybovy-aparat.png
│           │   ├── icon-energie-a-vitalita-trans.png
│           │   ├── icon-energie-a-vitalita.png
│           │   ├── icon-extra-wellness-trans.png
│           │   ├── icon-extra-wellness.png
│           │   ├── icon-hormonalni-system-trans.png
│           │   ├── icon-hormonalni-system.png
│           │   ├── icon-imunita-a-obranyschopnost-trans.png
│           │   ├── icon-imunita-a-obranyschopnost.png
│           │   ├── icon-metabolismus-trans.png
│           │   ├── icon-metabolismus.png
│           │   ├── icon-organy-a-detoxikace-trans.png
│           │   ├── icon-organy-a-detoxikace.png
│           │   ├── icon-patogeny-trans.png
│           │   ├── icon-patogeny.png
│           │   ├── icon-podpora-pri-onkologii-trans.png
│           │   ├── icon-podpora-pri-onkologii.png
│           │   ├── icon-prevence-a-rekonvalescence-trans.png
│           │   ├── icon-prevence-a-rekonvalescence.png
│           │   ├── icon-prostredi-a-zateze-trans.png
│           │   ├── icon-prostredi-a-zateze.png
│           │   ├── icon-psychika-a-emocni-rovnovaha-trans.png
│           │   └── icon-psychika-a-emocni-rovnovaha.png
│           ├── logo/.gitkeep
│           ├── og/
│           │   ├── .gitkeep
│           │   └── og-card-source.png
│           └── video/
│               └── hero-ambient-original.mp4
├── functions/
│   ├── _middleware.js
│   ├── admin/
│   │   ├── _middleware.js
│   │   ├── activity.js
│   │   ├── availability.js
│   │   ├── blog.js
│   │   ├── booking-detail.js
│   │   ├── bookings.js
│   │   ├── copywriter.js
│   │   ├── dashboard.js
│   │   ├── exceptions.js
│   │   ├── geo.js
│   │   ├── invoices.js
│   │   ├── me.js
│   │   ├── payments.js
│   │   └── settings.js
│   ├── api/
│   │   ├── _cron-backup.js
│   │   ├── _cron-blog-publish.js
│   │   ├── _cron-cashflow.js
│   │   ├── _cron-gdpr.js
│   │   ├── _cron-geo.js
│   │   ├── _cron-instagram.js
│   │   ├── _cron-reminders.js
│   │   ├── _cron-social.js
│   │   ├── _cron-worker.js
│   │   ├── _queue-booking.js
│   │   ├── _queue-social.js
│   │   ├── availability.js
│   │   ├── blog.js
│   │   ├── book.js
│   │   ├── booking-config.js
│   │   ├── calendar-hook.js
│   │   ├── chat.js
│   │   ├── health.js
│   │   ├── newsletter.js
│   │   ├── services.js
│   │   ├── stripe-checkout.js
│   │   └── stripe-webhook.js
│   └── lib/
│       ├── datacrypt.js
│       ├── db.js
│       ├── rate-limit.js
│       ├── turnstile.js
│       ├── connectors/
│       │   ├── _fetch-retry.js
│       │   ├── google-calendar.js
│       │   ├── gosms.js
│       │   ├── idoklad.js
│       │   ├── resend.js
│       │   └── telegram.js
│       └── guardrail/
│           ├── index.js
│           └── rules-health.js
├── graphify-out/
│   ├── GRAPH_REPORT.md
│   ├── graph.html
│   ├── graph.json
│   └── manifest.json
├── public/
│   ├── _redirects
│   ├── admin/
│   │   ├── index.html
│   │   ├── css/admin.css
│   │   └── js/
│   │       ├── api.js
│   │       ├── app.js
│   │       ├── router.js
│   │       └── modules/
│   │           ├── availability.js
│   │           ├── blog.js
│   │           ├── calendar.js
│   │           ├── dashboard.js
│   │           ├── exceptions.js
│   │           ├── geo.js
│   │           ├── invoices.js
│   │           ├── messages.js
│   │           ├── payments.js
│   │           └── settings.js
│   ├── apple-touch-icon.png
│   ├── assets/
│   │   ├── css/style.css
│   │   ├── img/
│   │   │   ├── certificates/.gitkeep
│   │   │   ├── gallery/
│   │   │   │   ├── .gitkeep
│   │   │   │   ├── ordinace-01.webp
│   │   │   │   ├── ordinace-02.webp
│   │   │   │   ├── ordinace-03.webp
│   │   │   │   ├── ordinace-04.webp
│   │   │   │   └── ordinace-05.webp
│   │   │   ├── hero/.gitkeep
│   │   │   ├── icons/
│   │   │   │   ├── icon-bolest-a-pohybovy-aparat-trans.webp
│   │   │   │   ├── icon-bolest-a-pohybovy-aparat.webp
│   │   │   │   ├── icon-energie-a-vitalita-trans.webp
│   │   │   │   ├── icon-energie-a-vitalita.webp
│   │   │   │   ├── icon-extra-wellness-trans.webp
│   │   │   │   ├── icon-extra-wellness.webp
│   │   │   │   ├── icon-hormonalni-system-trans.webp
│   │   │   │   ├── icon-hormonalni-system.webp
│   │   │   │   ├── icon-imunita-a-obranyschopnost-trans.webp
│   │   │   │   ├── icon-imunita-a-obranyschopnost.webp
│   │   │   │   ├── icon-metabolismus-trans.webp
│   │   │   │   ├── icon-metabolismus.webp
│   │   │   │   ├── icon-organy-a-detoxikace-trans.webp
│   │   │   │   ├── icon-organy-a-detoxikace.webp
│   │   │   │   ├── icon-patogeny-trans.webp
│   │   │   │   ├── icon-patogeny.webp
│   │   │   │   ├── icon-podpora-pri-onkologii-trans.webp
│   │   │   │   ├── icon-podpora-pri-onkologii.webp
│   │   │   │   ├── icon-prevence-a-rekonvalescence-trans.webp
│   │   │   │   ├── icon-prevence-a-rekonvalescence.webp
│   │   │   │   ├── icon-prostredi-a-zateze-trans.webp
│   │   │   │   ├── icon-prostredi-a-zateze.webp
│   │   │   │   ├── icon-psychika-a-emocni-rovnovaha-trans.webp
│   │   │   │   └── icon-psychika-a-emocni-rovnovaha.webp
│   │   │   ├── logo/.gitkeep
│   │   │   ├── hero-device.webp
│   │   │   ├── hero-lifestyle.webp
│   │   │   └── og.jpg
│   │   ├── js/
│   │   │   ├── chat-widget.js
│   │   │   ├── consent.js
│   │   │   ├── guide.js
│   │   │   ├── markdown.js
│   │   │   └── router.js
│   │   └── video/
│   │       ├── hero-ambient.mp4
│   │       └── hero-ambient.webm
│   ├── biorezonance-milevsko.html
│   ├── biorezonance-pisek.html
│   ├── biorezonance-protivin.html
│   ├── biorezonance-strakonice.html
│   ├── biorezonance-vodnany.html
│   ├── data/bicom_data.json
│   ├── favicon.ico
│   ├── icon.svg
│   ├── index.html
│   ├── llms.txt
│   ├── robots.txt
│   ├── schema/
│   │   ├── localbusiness.json
│   │   └── person.json
│   └── sitemap.xml
├── scripts/
│   ├── build-sitemap.js
│   ├── db-diagnostics.js
│   └── generate-service-jsonld.js
├── tests/
│   ├── auth.test.js
│   ├── availability.test.js
│   ├── datacrypt.test.js
│   ├── gdpr.test.js
│   ├── menu.test.js
│   ├── queue.test.js
│   └── monitoring/
│       └── monitoring.test.js
├── .dev.vars.example
├── .gitignore
├── agent_journal.md
├── AGENTS.md
├── GITHUB_SETUP_AND_PLANNING.md
├── migrations  (soubor ukazující na `db/migrations`)
├── package-lock.json
├── package.json
├── README.md
├── WHITE_PAPER.md
├── wrangler.booking-consumer.toml
├── wrangler.cron-worker.toml
├── wrangler.social-consumer.toml
└── wrangler.toml
```

## 3) Co je kde (rychlá orientace)

| Oblast | Primární cesta | Poznámka |
|---|---|---|
| Public web | `public/` + `public/assets/` | landing pages, hlavní SPA, SEO soubory |
| Admin konzole (Virtual Office) | `public/admin/` | UI modulárně v `js/modules/*` |
| API + backend logika | `functions/api/`, `functions/admin/`, `functions/lib/` | Cloudflare Pages Functions |
| DB source of truth | `db/schema.sql`, `db/migrations/`, `db/seed/` | D1 má odpovídat repu |
| Provozní/handover docs | `docs/HANDOVER.md`, `docs/ROADMAP.md`, `docs/API_KEYS_CHECKLIST.md` | předání + launch stav |
| Architektura / Kompas | `graphify-out/` | Sémantický graf závislostí a architektury (GraphiFy) |
| Architektura/rozhodnutí | `docs/ARCHITEKTURA.md`, `docs/adr/*` | technická rozhodnutí |
| Automatické testy | `tests/` | Unit, integrační a monitorovací testy (Vitest) |
| Asset zdroje | `docs/assets/originals/` | originály pro export do `public/assets/` |

## 4) Cloudflare Resources Status — Produkční Binding

| Resource | Type | ID / Binding | Stav | Účel | Poznámka |
|---|---|---|---|---|---|
| `bicom-pisek-db` | D1 Database | `c04cb289-2ff4-45d7-9fa0-3243c34c3abe` | ✅ LIVE | Relační data (bookings, blog, audit, schema) | Migrace 0001–0025 aplikovány; 14 tabulek |
| `bicom-multimedia` | R2 Bucket | — | ✅ LIVE | Objektové úložiště (media, exports, backups) | Bound: `env.MULTIMEDIA_BUCKET` |
| `bicom-pisek-cache` | KV Namespace | — | ✅ LIVE | Edge cache, rate-limit, sessions, runtime state | Bound: `env.KV_CACHE` |
| `booking-jobs` | Queue | — | ✅ LIVE | Asynchronní zpracování booking workflow | Consumer: `bicom-booking-consumer` Worker |
| `social-jobs` | Queue | — | ✅ LIVE | Asynchronní social media scheduling | Consumer: `bicom-social-consumer` Worker |
| `@cf/meta/llama-3-8b` | AI Model (Workers AI) | — | ✅ LIVE | LLM pro copywriting, chat, geo leads analysis | Bound: `env.AI` |
| Production Secrets | Pages Secrets | (private) | ✅ CONFIGURED | RESEND_API_KEY, INTERNAL_API_SECRET, MAINTENANCE_ENABLED, atd. | Viz PRODUCTION-SECRETS-CHECKLIST.md |

### D1 Migrace Status

- **Ledger:** `d1_migrations` table
- **Tracking:** Migrace 0001–0015 (CLI) + 0016–0020 (manual MCP) + 0021–0025 (CLI Phase 3.0)
- **Poznámka:** 0016–0020 nejsou v `d1_migrations` ledgeru (ruční aplikace); viz DATABASE_MANAGEMENT.md § 8 pro reconciliation script
- **Ověření:** `wrangler d1 execute bicom-pisek-db --remote "SELECT version FROM d1_migrations ORDER BY version;"`

## 5) Pravidla údržby mapy

1. Při přidání nové top-level složky nebo nového runtime modulu (`functions/*`, `public/admin/js/modules/*`) mapu aktualizovat ve stejném PR.
2. Pokud se mění zdroj pravdy pro data nebo secrets, aktualizovat zároveň `HANDOVER.md` a `API_KEYS_CHECKLIST.md`.
3. Soubor `migrations` v rootu je alias/odkazový artefakt na `db/migrations`; kanonická migrace je vždy v `db/migrations`.
