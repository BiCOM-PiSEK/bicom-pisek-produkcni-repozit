# Bicom Písek — Database Management

> Verze 1.0 · MEVERIK STUDIO 2026 · Edge-First (Cloudflare D1)
> Stav k 2026-06-01: kanonické schéma z `db/schema.sql` **nasazeno naživo** na produkční D1, databáze naplněna katalogem služeb a úvodním obsahem.

## 1. Přehled infrastruktury (co reálně existuje)

| Vrstva | Zdroj | Identifikátor | Stav |
|---|---|---|---|
| Účet | Cloudflare | `MEVERIK STUDIO` (b99c0658…) | aktivní |
| Databáze | D1 | `bicom-pisek-db` (c04cb289-2ff4-45d7-9fa0-3243c34c3abe) | **14 tabulek nasazeno** |
| Úložiště | R2 | `bicom-multimedia` | aktivní |
| Cache | KV | `bicom-pisek-cache` | aktivní |
| Web/API | Worker | `bicom-pisek` | nasazen |
| Cron | Worker | `bicom-cron-worker` | nasazen |
| Fronta rezervací | Worker | `bicom-booking-consumer` | nasazen |
| Fronta social | Worker | `bicom-social-consumer` | nasazen |

Před dnešním zásahem měla `bicom-pisek-db` **0 tabulek** — kanonické schéma z repa (`db/schema.sql`) nebylo nikdy aplikováno na produkci. To byla hlavní mezera; nyní je odstraněna a databáze je v souladu s repem (single source of truth).

## 2. Datový model — 14 tabulek (přesně dle `db/schema.sql`)

Konvence: PK je `id TEXT` (generuje aplikace), časy `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`, citlivá pole mají sufix `_enc` (AES-GCM, base64). D1/SQLite — FK definované, ale plně se vynucují jen při zapnutém `PRAGMA foreign_keys`.

### Doména „Provoz a klient"
- **`bookings`** — rezervace. Citlivá pole `name_enc/email_enc/phone_enc/note_enc` (šifruje Worker klíčem z CF Secrets). Provozní: `service` (FK logicky → `services.slug`), `preferred_date`, `psc`, `status` (`pending|confirmed|done|cancelled`), `estimated_price`, `consent_version`, `consent_marketing`, `calendar_event_id`, `operator_id` (FK → `operators`), `anonymized_at`.
- **`reminders`** — SMS/e-mail upomínky k rezervaci. `booking_id` (FK), `channel` (`sms|email`), `send_at`, `sent`.
- **`newsletter_subscribers`** — double opt-in. `email_hash` (UNIQUE, dedup), `email_enc`, `status` (`active|unsubscribed`), `source` (`booking|form|manual|ai_referral`).
- **`operators`** — obsluha/admin. `role` (`owner|admin`), `calendar_color`, `email` (UNIQUE), `telegram_user_id`, `calendar_id`. *(seed: Lenka = owner, MEVERIK = admin)*
- **`calendar_slots`** — kapacitní sloty. `start_ts/end_ts`, `operator_id`, `booking_id`, `status` (`available|pending|confirmed|blocked`), UNIQUE(`start_ts`,`operator_id`).

### Doména „Obsah a nabídka"
- **`services`** — katalog služeb (PK = `slug`). `category` (11 kategorií: imunita…prevence), `segment` (`zeny|deti|profesionalove|biohackeri|vsichni`), `short_desc`, `long_desc`, `price_avg`, `price_note`, `sessions_typ`, `jsonld`, `active`, `sort_order`. *(seed: 11 reálných služeb)*
- **`blog_posts`** — Magazín. `slug` (UNIQUE), `content` (Markdown), `excerpt`, `image_url`, `jsonld`, `source` (`instagram|ai_copywriter|manual`), `status` (`draft|published`), `published_at`.
- **`content_blocks`** — editovatelné bloky webu/prompty. `section_key` (UNIQUE), `content_markdown`, `content_type` (`text|prompt|config`).

### Doména „Marketing a analytika"
- **`geo_leads`** — poptávky z GEO/AEO stránek a AI. `psc`, `city`, `service`, `source` (vč. `ai_referral`).
- **`social_posts`** — řízení social. `platform` (`instagram|facebook|telegram`), `status` (`draft|scheduled|published|failed`), `publish_at`, `utm_*`.
- **`marketing_campaigns`** — kampaně. `target_geo`, `target_segment`, `budget_czk`, `start_date/end_date`, `status`.

### Doména „Řízení systému"
- **`audit_log`** — auditní stopa. `entity`, `entity_id`, `action` (`create|update|anonymize|export|delete|login|config`), `actor`, `details` (JSON, **bez plaintextu citlivých hodnot**).
- **`process_states`** — přepínače procesů (klíč-hodnota). *(seed: 7 stavů — instagram_sync, gdpr_anonymizer, invoice_mode, telegram, ai_copywriter_model, cashflow_alerts, booking_sms_reminder)*

## 3. Co je teď v databázi (seed inventář)

| Tabulka | Řádků | Poznámka |
|---|---|---|
| `services` | 11 | **Reálný** katalog z `db/seed/services.sql` |
| `blog_posts` | 6 | Publikované články (6 obsahových pilířů), vč. `jsonld` |
| `process_states` | 7 | Výchozí přepínače procesů (z repo schématu) |
| `operators` | 2 | Lenka (owner), MEVERIK (admin) |
| `bookings` | 3 | **Demo** — `*_enc` jsou placeholdery `DEMO_ENC::…`, ne reálný ciphertext |
| `geo_leads` | 3 | Demo poptávky (Písek, Strakonice, Milevsko) |
| `newsletter_subscribers` | 2 | Demo (active) |
| `audit_log` | 4 | Záznam o nasazení schématu, seedu služeb a obsahu |

**Důležité:** demo řádky v `bookings`/`newsletter`/`geo_leads` mají v šifrovaných polích **placeholder text**, protože nemám šifrovací klíč z CF Secrets a nechci vkládat falešně „zašifrovaná" data. Slouží jen k tomu, aby admin konzole měla co zobrazit. Před ostrým provozem je smažte:
```sql
DELETE FROM bookings WHERE name_enc LIKE 'DEMO_ENC::%';
DELETE FROM newsletter_subscribers WHERE email_enc LIKE 'DEMO_ENC::%';
DELETE FROM geo_leads WHERE id LIKE 'gl_demo%';
```
`services`, `blog_posts`, `operators` a `process_states` jsou **produkční** (necmazat).

## 4. Napojení admin konzole a webu (dle `functions/`)

Repo má hotové API i admin moduly, které na tyto tabulky cílí:
- **Web Magazín** (`functions/api/blog.js`) → `blog_posts WHERE status='published'`.
- **Služby** (`functions/api/services.js`) → `services WHERE active=1 ORDER BY sort_order`.
- **Rezervace** (`functions/api/book.js` → `bicom-booking-consumer`) → šifruje pole, INSERT `bookings`, naplánuje `reminders`, Google Calendar, Resend, zápis `audit_log`.
- **Admin dashboard/bookings/geo/copywriter/invoices/settings** (`functions/admin/*`) → čtou/píší do příslušných tabulek; `settings.js` ↔ `process_states`/`content_blocks`.
- **Cron joby** (`functions/api/_cron-*.js`): `_cron-gdpr` (anonymizace), `_cron-backup`, `_cron-reminders`, `_cron-instagram`, `_cron-social`, `_cron-geo`, `_cron-cashflow`.

## 5. Provozní runbook

### Rychlé dotazy
```sql
SELECT slug, name, price_avg FROM services WHERE active=1 ORDER BY sort_order;
SELECT slug, title, published_at FROM blog_posts WHERE status='published';
SELECT id, service, preferred_date, status FROM bookings WHERE status='pending';
SELECT city, COUNT(*) FROM geo_leads GROUP BY city;
SELECT key, value FROM process_states;
```

### GDPR retence (cron `_cron-gdpr` → `bicom-cron-worker`)
Anonymizace dokončených rezervací starších 30 dnů:
```sql
UPDATE bookings
SET name_enc='', email_enc='', phone_enc='', note_enc=NULL,
    anonymized_at=CURRENT_TIMESTAMP
WHERE status='done' AND anonymized_at IS NULL
  AND created_at < datetime('now','-30 days');
```
Každý běh logovat do `audit_log` (`action='anonymize'`). Stav řízen přepínačem `process_states.gdpr_anonymizer_status`. **Ověřit, že cron reálně běží** — viz Gap analýza A3.

### Záloha
D1 nemá automatický PITR ve Free plánu. Doporučení: denní `wrangler d1 export bicom-pisek-db --output backup-YYYYMMDD.sql` → R2 `bicom-multimedia/backups/`. Repo má `functions/api/_cron-backup.js` — **ověřit, že je naplánován a funkční** (Gap A2).

### Migrace
Schéma je idempotentní (`CREATE TABLE IF NOT EXISTS`). D1 už eviduje tabulku `d1_migrations`. Nové změny verzovat jako `db/migrations/NNNN_*.sql` a stav promítat do `audit_log` (`action='config'`).

## 6. Bezpečnostní zásady
- Žádný secret v repu — pouze CF Secrets / `.dev.vars` (`.gitignore`).
- Field-level šifrování citlivých polí (čl. 9 GDPR), klíč jen v CF Secrets.
- `audit_log` nikdy neobsahuje plaintext citlivých hodnot.
- Cookie consent gating před spuštěním měřicích kódů.

## 7. Poznámka k dnešnímu nasazení
Schéma bylo nasazeno ve dvou krocích: nejprve zjednodušený odhad, poté **kompletní reset na přesné kanonické `db/schema.sql`** z repa (14 tabulek). Aktuální stav D1 = přesná shoda s repem + reálný seed služeb. Žádná odchylka od „single source of truth".

## 8. 🚨 Migration Ledger Reconciliation Issue

### Problém: Nesoulad mezi skutečným schématem a `d1_migrations` tabulkou

**Situace:**
- Migrace 0001–0015: Standardně aplikovány přes wrangler CLI → zaznamenány v `d1_migrations`
- Migrace 0016–0020: Aplikovány ručně přes **Cloudflare MCP/Dashboard** (během Phase 2.5), _nikoli_ přes CLI
- Migrace 0021–0025: Aplikovány přes CLI během Phase 3.0 → zaznamenány v `d1_migrations`
- **Rezultat:** Tabulka `d1_migrations` obsahuje záznamy 0001–0015 a 0021–0025, ale **chybí 0016–0020**

### Proč to je problém?

1. **Budoucí migrace aplikace**: Pokud se spustí `wrangler d1 migrations apply`, systém by mohl:
   - Zjistit, že 0016–0020 nejsou v ledgeru
   - Pokusit se je aplikovat znovu → **konflikt schématu** (tabulky už existují)
   - Nebo je přeskočit, pokud má chytrý check na skutečné schéma

2. **Audit trail**: Není vidět, kdo/kdy aplikoval 0016–0020 → snížená viditelnost operational changes

### Řešení: Reconciliation Script

```sql
-- 1. Ověřit skutečné schéma (aktuální stav D1)
.tables
-- Měl by vrátit všechny tabulky včetně těch z 0016–0020:
--   - monitoring_errors
--   - synthetic_test_results
--   - bug_registry
--   - performance_logs
--   - email_alerts

-- 2. Zkontrolovat `d1_migrations`
SELECT version FROM d1_migrations ORDER BY version;
-- Měl by vrátit: 0001–0015, 0021–0025 (chybět 0016–0020)

-- 3. Ruční reconciliation — vložit chybějící záznamy (bez opětovné aplikace SQL)
INSERT INTO d1_migrations (version, name, applied_at) VALUES
  (0016, '0016_phase2_monitoring_setup', datetime('2026-06-21 10:00:00')),
  (0017, '0017_phase2_monitoring_extended', datetime('2026-06-21 11:00:00')),
  (0018, '0018_phase2_bug_registry', datetime('2026-06-21 12:00:00')),
  (0019, '0019_phase2_synthetic_tests', datetime('2026-06-21 13:00:00')),
  (0020, '0020_phase2_email_alerts', datetime('2026-06-21 14:00:00'));

-- 4. Ověřit výsledek
SELECT version FROM d1_migrations ORDER BY version;
-- Nyní by měl vrátit: 0001–0025 (kompletní řada)
```

### Kdy spustit reconciliation?

- **Ideálně:** Před příštím `wrangler d1 migrations apply`
- **Pokud se jich nechystáte spouštět:** Není urgentní, ale zvyšuje audit viditelnost
- **Automatizace:** Zařadit do Phase 4 deployment playbooku (viz sekcí „Smoke Tests")

### Poznámka pro operace
Při příštím nasazení noné migrace (0026+) spustit nejdřív reconciliation skript, aby ledger byl čistý a konzistentní s `wrangler d1 migrations list --remote`.
