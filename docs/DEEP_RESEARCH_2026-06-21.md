# 🔬 Hloubkový průzkum projektu — Repo + Cloudflare + ostatní

> **Datum:** 2026-06-21 · **Rozsah:** produkční repozitář + živá Cloudflare infrastruktura (D1/KV/R2/Workers/Queues/Cron) + externí integrace
> **Metoda:** statická analýza kódu (3 paralelní průzkumné agenty) + **živé dotazy na produkční D1** a Cloudflare API přes MCP. Postup „zdola nahoru" — od datové vrstvy po špičku ledovce.
> **Stav projektu:** v1.0 RC, aktivní finalizace před předáním klientce (BIO ONE LIFE s.r.o. / Bicom Písek).

---

## 0. Manažerské shrnutí

Projekt je **architektonicky vyzrálý, bezpečně postavený Cloudflare-first systém** s hotovým jádrem (rezervace, šifrování, audit, plně funkční CMS s draft/publish/náhled/verzemi). Datová a logická vrstva je čistá a produkčně nasazená. Hlavní slabiny jsou **provozně-procesní**, ne architektonické:

| Oblast | Hodnocení | Komentář |
|---|---|---|
| Datový model & D1 | 🟢 9/10 | 21 tabulek, čisté schéma, indexy, šifrování citlivých polí |
| Backend API (Pages Functions) | 🟢 9/10 | ~19 veřejných + ~19 admin endpointů, validace, cache, queue |
| Workers / Queues / Cron | 🟢 8/10 | 3 workeři live, 9 cron úloh, async rezervační pipeline |
| Integrace | 🟡 6/10 | Calendar/Resend/GoSMS/Telegram/Stripe live; iDoklad mock, Instagram částečně, WhatsApp/Facebook ne |
| Bezpečnost | 🟢 8/10 | CF Access JWT, AES-GCM, sanitizace, rate-limit; chybí rotace klíče |
| Frontend + Admin SPA | 🟢 8/10 | Web hotový + CMS napojené; 1 mrtvý admin modul, pár placeholderů |
| **Testy & CI** | 🔴 2/10 | **Žádné testy, žádná CI pipeline** — největší dluh |
| Dokumentace | 🟢 8/10 | Obsáhlá a vesměs aktuální; pár zastaralých dokumentů |
| **Provoz migrací** | 🟡 5/10 | **Ledger `d1_migrations` rozjetý s realitou** (viz §2.3) |

**Tři nejdůležitější zjištění:**
1. 🔴 **Nulové testy** přes finančně/GDPR-citlivý systém (Stripe, šifrování, kolize slotů).
2. 🟠 **Migrační ledger `d1_migrations` eviduje jen 0001–0015**; migrace 0016–0020 byly aplikované ručně mimo `wrangler d1 migrations apply` → riziko při příštím `migrations apply`.
3. 🟡 **Hotové funkce běží „naprázdno"**: `hero_config` má 0 řádků (hero CMS dormantní), `marketing_campaigns`/`social_posts`/`calendar_slots` 0 řádků (nevyužité/deprecated).

---

## 1. Vrstva 0 — Cloudflare účet & živá infrastruktura

Ověřeno živě přes Cloudflare API (21. 6. 2026):

### 1.1 Prostředky projektu
| Typ | Název | ID / detail |
|---|---|---|
| D1 databáze | `bicom-pisek-db` | `c04cb289-2ff4-45d7-9fa0-3243c34c3abe`, ~360 KB, vytvořeno 25. 5. 2026 |
| KV namespace | `bicom-pisek-cache` | `57e7c49eaba94dd4ad9ede723ff69aab` (cache, rate-limit) |
| R2 bucket | `bicom-multimedia` | vytvořeno 27. 5. 2026 (galerie, zálohy, IG média) |
| Worker | `bicom-booking-consumer` | naposledy nasazen 14. 6. 2026 |
| Worker | `bicom-social-consumer` | naposledy nasazen 8. 6. 2026 |
| Worker | `bicom-cron-worker` | naposledy nasazen 11. 6. 2026 |
| Pages | `bicom-pisek` | produkce z `main` + branch preview |

### 1.2 Cizí prostředky na stejném účtu (nesouvisí s projektem)
Workeři `cralis-worker`, `iwhc`, `dot-audit-pro`, `whc-ai-asistent`, `vltavinova-oracle`, `visualforge-worker`, `d1-auto-data-nasazovani-github-cloudflare`; D1 `cralis-db`, `Cloudflare-D1-DATABAZE-GitHubREPO`; R2 `cralis-storage`, `planakrabimra`. **Doporučení:** ověřit, že produkční tokeny/oprávnění jsou izolované per-projekt (sdílený účet = větší blast radius při kompromitaci tokenu).

---

## 2. Vrstva 1 — Data (D1)

### 2.1 Tabulky (živě 21) a jejich reálná vytíženost
Dotaz na produkci 21. 6. 2026:

| Tabulka | Řádků | Stav / poznámka |
|---|---:|---|
| `audit_log` | 72 | 🟢 aktivní auditní stopa |
| `content_blocks` | 32 | 🟢 CMS texty + SEO + FAQ + landing + NAP (seed 0017/0019) |
| `process_states` | 20 | 🟢 konfig přepínače (viz §2.4 — bez UI) |
| `bookings` | 11 | 🟢 rezervace (early/test data) |
| `reminders` | 11 | 🟢 upomínky napárované na rezervace |
| `services` | 11 | 🟢 katalog programů (icon_url ze 0018) |
| `blog_posts` | 7 | 🟢 články |
| `operators` | 6 | 🟢 terapeutky (seed 0010) |
| `gallery_items` | 5 | 🟢 foto ordinace (seed 0016) |
| `availability_rules` | 5 | 🟢 Po–Pá otevírací doba |
| `availability_exceptions` | 1 | 🟢 |
| `booking_settings` | 1 | 🟢 slot 60 min, lead 24 h |
| `newsletter_subscribers` | 1 | 🟡 minimální využití |
| `geo_leads` | 1 | 🟡 GEO analytika zatím téměř prázdná |
| `payment_transactions` | **0** | ⚠️ žádná Stripe transakce nezaznamenána (předlaunch, nebo webhook nezapisuje) |
| `hero_config` | **0** | ⚠️ hero CMS hotové, ale **nenaseedované** → homepage hero jede z hardcoded fallbacku |
| `content_drafts` | **0** | 🟢 nová F12-D funkce, zatím nepoužitá (očekávané) |
| `social_posts` | **0** | 🟡 nevyužité (publikace jen Telegram) |
| `marketing_campaigns` | **0** | 🔴 mrtvá tabulka — nikdo nezapisuje, bez UI |
| `calendar_slots` | **0** | 🔴 DEPRECATED (ADR-004 Cesta 1) — sloty se počítají za běhu |
| `d1_migrations` | 15 | ⚠️ viz §2.3 |

### 2.2 Schéma
Kanonické `db/schema.sql` (~668 řádků SQL napříč migracemi). Klíčové: parciální UNIQUE index `idx_bookings_slot_unique` na `slot_start` (atomická ochrana proti dvojí rezervaci), `email_hash` pro dedup newsletteru bez expozice, CHECK constraints na statusy/typy. Schéma odpovídá živé DB (sqlite_master ověřeno).

### 2.3 🟠 NÁLEZ: migrační ledger je rozjetý s realitou
- Soubory migrací: **0001–0020** (`db/migrations/`).
- Produkční tabulka `d1_migrations` ale eviduje **jen id 1–15** (poslední `0015` aplikovaná 17. 6. 2026).
- Migrace **0016–0020** (CMS galerie/hero, draft/publish, služby icon_url, SEO/landing/FAQ, content_drafts) byly aplikované **ručně mimo `wrangler d1 migrations apply`** (přes Cloudflare MCP / dashboard během F11/F12/F12-D). Tabulky i sloupce v DB **existují a fungují** (ověřeno), ale ledger o nich neví.
- **Riziko:** spuštění `npm run db:migrate` (`wrangler d1 migrations apply … --remote`) by se pokusilo přehrát 0016–0020; 0016 a 0018 obsahují neidempotentní `ALTER TABLE … ADD COLUMN` → **selhání / částečná chyba**.
- **Náprava (doporučeno):** dorovnat ledger — vložit záznamy 16–20 do `d1_migrations` (idempotentně, bez re-aplikace SQL), nebo zavést explicitní `schema_version` a do `db:migrate` workflow přidat „mark as applied". Zdokumentovat, že 0016–0020 jsou již na produkci.

### 2.4 Šifrování (`functions/lib/datacrypt.js`)
- AES-GCM 256-bit (Web Crypto API), IV 12 B náhodné, Base64 bez `btoa`, SHA-256 pro `email_hash`.
- Šifrovaná pole: `bookings.{name,email,phone,note}_enc`, `newsletter_subscribers.email_enc`.
- Klíč `SECRET_ENCRYPTION_KEY` jen v CF Secrets.
- ⚠️ **Bez rotace klíče** (kompromitace = čitelná veškerá historie). Doporučeno: sloupec `enc_key_version` + fallback dešifrování.

---

## 3. Vrstva 2 — Workers, Queues, Cron

### 3.1 Asynchronní rezervační pipeline
`POST /api/book` (či Stripe webhook) → enqueue `booking-jobs` → **`bicom-booking-consumer`**: 1) Google Calendar event (žlutý = pending), 2) potvrzovací e-mail (Resend), 3) Telegram notifikace operátorkám, 4) naplánování upomínek (email + SMS). Citlivá pole se šifrují **před** zápisem do D1.

### 3.2 Cron úlohy (`functions/api/_cron-*.js`, dispatcher `_cron-worker.js`)
| Úloha | Frekvence | Co dělá |
|---|---|---|
| `_cron-backup` | Ne 02:00 | Export D1 → R2 JSON (8 týdnů retence) |
| `_cron-blog-publish` | hodinově | `scheduled` → `published` články |
| `_cron-cashflow` | Po 09:00 | Telegram alert (týdenní tržby) |
| `_cron-gdpr` | denně 03:30 | Anonymizace `bookings` po 30 dnech |
| `_cron-geo` | Po 04:00 | Telegram digest (top města z geo_leads) |
| `_cron-instagram` | denně 03:00 | Meta Graph → draft články |
| `_cron-reminders` | hodinově | Odeslání SMS (GoSMS) + e-mail (Resend) upomínek |
| `_cron-social` | denně 08:00 | Enqueue `social_posts` → `social-jobs` |

ℹ️ `_cron-gdpr` (anonymizace, dříve GAP A3) i `_cron-backup` (D1 záloha, dříve GAP A2) jsou dle `ROADMAP.md` **vyřešené a živě ověřené na produkci**. Reziduum: chybí **automatický regresní test** (viz §9), takže budoucí změny mohou tuto logiku tiše rozbít.

### 3.3 `social-jobs` consumer
`bicom-social-consumer` publikuje `social_posts` — reálně jen na **Telegram**; Instagram/Facebook publikace neimplementována. Tabulka má 0 řádků → fakticky nevyužité.

---

## 4. Vrstva 3 — Pages Functions API

### 4.1 Veřejné `/api/*` (bez auth, příp. Turnstile + rate-limit)
`health`, `availability` (KV cache), `blog`, `book` (Turnstile+rate-limit+šifrování+queue), `booking-config`, `calendar-hook`, `chat` (Workers AI + guardrail + Telegram eskalace), `content`, `gallery`, `hero`, `newsletter`, `services`, `stripe-checkout`, `stripe-webhook`, `media/[[path]]` (R2 proxy). Veřejné CMS endpointy vrací **jen živý obsah** (draft nikdy public).

### 4.2 Admin `/admin/*` (za CF Access JWT)
`me`, `dashboard`, `bookings` (PII dešifr.), `booking-detail`, `availability`, `exceptions`, `blog`, `content`, `hero`, `gallery` (R2), `services`, `drafts` (F12-D verze), `copywriter` (AI + guardrail), `activity`, `geo`, `invoices` (⚠️ iDoklad mock), `payments` (Stripe), `settings`, `preview/[[path]]` (CMS náhled).

### 4.3 Sdílené utility (`functions/lib/`)
`cms.js` (json/audit/cache/draft helpery), `sanitize.js` (HTML allowlist), `datacrypt.js`, `rate-limit.js` (KV, fail-open), `d1.js`, `connectors/*` (google-calendar, resend, gosms, telegram, idoklad, _fetch-retry).

---

## 5. Vrstva 4 — Externí integrace (stav)

| Integrace | Stav | Detail |
|---|---|---|
| Google Calendar | 🟢 live | Service Account JWT (RS256), event create, webhook receiver `/api/calendar-hook` |
| Resend (e-mail) | 🟢 live | confirmation, reminders, reschedule, cancel |
| GoSMS (SMS) | 🟢 live | T-24h upomínky |
| Telegram | 🟢 live | notifikace, eskalace AI chatu, cashflow/geo digest |
| Stripe | 🟢 live (kód) | checkout + webhook + `payment_transactions`; ⚠️ 0 transakcí v DB |
| Workers AI (Llama) | 🟢 částečně | `/api/chat` + `/admin/copywriter` s guardraily (zakázané medicínské nároky) |
| iDoklad (faktury) | 🟠 mock | connector hotový, **produkční klíče nenastaveny** → `/admin/invoices` vrací mock |
| Instagram | 🟡 částečně | `_cron-instagram` čte příspěvky → draft články; **publikace na IG neimplementována** |
| Facebook | 🔴 ne | Meta Graph posting nezačat |
| WhatsApp | 🔴 disabled | schéma `reminder_channel` to umí, ale API vrací 400; UI volba „brzy" |

---

## 6. Vrstva 5 — Bezpečnost

- 🟢 **Auth:** `functions/admin/_middleware.js` — plná CF Access JWT validace (JWKS cache, RS256 podpis, iss/aud/exp/nbf), lookup `operators` (`active`), tvrdé 403 v produkci bez `SECRET_CF_ACCESS_TEAM`.
- 🟡 **CORS admin = `*`** — fakticky neškodné (přístup hlídá JWT v `_middleware`), ale doporučeno zúžit na `bicom-pisek.cz`.
- 🟢 **Sanitizace** (`sanitize.js`) — allowlist tagů, URL schémat, odstranění script/style/iframe; vstup zadávají důvěryhodní operátoři za Access.
- 🟡 **Rate-limit** (`rate-limit.js`) — KV counter, **fail-open** (při výpadku KV propustí); pro `/api/book` zvážit fail-closed.
- 🟢 **Secrets** — vše v CF Secrets, `.dev.vars` v `.gitignore`, žádné leaky v repu.
- 🟠 **Bez rotace šifrovacího klíče** (`enc_key_version`). GDPR anonymizace i zálohy jsou dle ROADMAP ověřené, ale **bez automatického testu**.
- 🟡 **Chybí `public/_headers`** — doporučeno přidat `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`.

---

## 7. Vrstva 6 — Veřejný web (`public/`)

- `index.html` — SPA s hero, interaktivním průvodcem („Moje cesta k rovnováze", `guide.js` z `/api/services`), sekcemi, rezervačním formulářem (Stripe záloha / zdarma), kontaktem. Router (`router.js`) řeší `/sluzby/{slug}`, `/magazin/{slug}`, `/gdpr`, potvrzovací stránky.
- `cms-client.js` — progressive enhancement přes `data-cms-*` (section/list/gallery/hero/nap/seo/faq/programs/landing) + náhledový režim (`window.__CMS_PREVIEW__` → `/admin/*?preview=1`). Fallback HTML zůstává.
- 5× `biorezonance-{město}.html` — landing lokalit napojené na CMS (`landing-*`, `seo-*`, sdílené FAQ/programy/NAP).
- ⚠️ **Hardcoded (mimo CMS):** navigace, labely rezervačního formuláře, cookie banner, chat widget texty, weekday názvy. WhatsApp volba `disabled`.
- ⚠️ **Hero homepage** má v DB 0 řádků → vždy fallback (CMS hero se reálně neuplatní, dokud se `hero_config` nenaseeduje).

---

## 8. Vrstva 7 — Admin SPA (`public/admin/`)

Lazy-load moduly (`js/router.js` + `js/api.js`):
| Modul | Stav |
|---|---|
| dashboard, calendar, availability, exceptions, blog, content (CMS), payments, geo, settings | 🟢 hotové |
| invoices | 🟡 mock (iDoklad offline) |
| **messages** (`/zpravy`) | 🔴 **placeholder** „připravujeme" — bez backendu |
| Newsletter akce (dashboard), Search (app.js) | 🟡 klikací, ale `showToast('…brzy')` |

`content.js` je nejbohatší modul: záložky Stránky/Služby/FAQ/Footer/SEO/Landing/Galerie/Hero/Historie, draft→náhled(iframe)→publikovat, **pojmenované verze (F12-D)**.

---

## 9. Testy & CI — 🔴 největší dluh

- **Žádné testy** (`*.test.js`/`*.spec.js` neexistují), `vitest` v devDependencies bez configu, `npm test` → „nikam".
- **Žádná `.github/workflows/`** CI — deploy je ruční `wrangler pages deploy` (Pages auto-deploy z `main` funguje, ale bez bran kvality).
- Nepokryté kritické cesty: DataCrypt roundtrip, JWT middleware, kolize slotů/časová pásma, rate-limit, GDPR anonymizace, integrita migrací.

---

## 10. Nálezy: defekty / nedodělky / mrtvý kód

1. 🔴 Nulové testy + CI (§9).
2. 🟠 Migrační ledger drift (§2.3).
3. 🟠 Bez rotace šifrovacího klíče; GDPR anonymizace/zálohy ověřené (ROADMAP A2/A3), ale bez automatického regresního testu.
4. 🟡 `messages` admin modul = placeholder; Newsletter/Search = „brzy".
5. 🟡 iDoklad mock (klíče chybí); Instagram/Facebook/WhatsApp publikace neúplné/vyp.
6. 🟡 Mrtvé/nevyužité tabulky: `marketing_campaigns`, `calendar_slots` (deprecated), `social_posts` (0).
7. 🟡 `hero_config` 0 řádků → hero CMS dormantní.
8. 🟢 Drobnost: duplicitní ruční sanitizace v `book.js` (regex) místo `lib/sanitize.js`.
9. 🟢 TODO: `dashboard.js` revenue trend čeká na iDoklad; `guardrail/index.js` detekční engine.
10. 🟡 Chybí `public/_headers` (bezpečnostní hlavičky).

---

## 11. Nevyužité / zapomenuté příležitosti

- **`marketing_campaigns`** — schéma hotové; postavit jednoduchý kampaňový modul (newsletter segmenty, plánované akce) → využít prázdné `social_posts`/`newsletter` napojení.
- **`process_states` (20 řádků)** — konfig přepínače (instagram_sync, gdpr_anonymizer, cashflow_alerts, ai_model) **bez admin UI** → přidat „System toggles" do `settings`.
- **`payment_transactions`** — po napojení iDokladu odemkne revenue trend na dashboardu a fakturační most (Stripe → záloha → faktura).
- **Hero CMS** — naseedovat `hero_config` pro homepage (+ landing) → zpřístupnit už hotový editor.
- **Texty rezervačního formuláře / chat widgetu** → přesunout do CMS (`booking-form-labels`, `chat-widget` config bloky) — vrstva už existuje.
- **Chat widget** — napojit na reálné Workers AI / Anthropic API (dnes design + částečný `/api/chat`).
- **SEO/AEO** (GAP B1/B2) — FAQPage + Person/MedicalBusiness JSON-LD, plné lokální landingy → vysoká hodnota pro zdravotnický obsah a AI vyhledávání.
- **Admin fulltext search** — placeholder → reálné hledání napříč rezervacemi/obsahem.
- **Booking filtry** — rozšířit z čistě status na datum/službu/operátora.

---

## 12. Dokumentace — co aktualizovat

Aktuální a dobré: `README`, `ROADMAP`, `CLAUDE`, `HANDOVER`, `CMS_GUIDE`, `API_KEYS_CHECKLIST`, `DATABASE_MANAGEMENT`, `REPO_MAPA_ULOZIST`.

K aktualizaci/archivaci:
- `ROADMAP.md` — doplnit F12-D (pojmenované verze) jako hotové + odkaz na tento report + ledger-drift.
- `ARCHITEKTURA.md` — diagram doplnit o `gallery_items`, `hero_config`, `content_drafts` a draft/publish vrstvu.
- `DATABASE_MANAGEMENT.md` — aktualizovat počty/seedy dle §2.1 + poznámka o ledgeru.
- `agent-tasks/CMS-FEATURE-SPEC.md` — archivovat (psáno pro jiný stack než realita).
- `WORK-DIARY.md` — přidat datovaný zápis o F12-D + tomto auditu.
- `CLAUDE.md` — odkaz na tento report jako vstupní bod stavu.

---

## 13. Doporučení dle priority

**P0 (před ostrým spuštěním):**
1. Dorovnat migrační ledger `d1_migrations` (0016–0020) a zdokumentovat (§2.3).
2. Doplnit regresní test pro GDPR anonymizaci `_cron-gdpr` a zálohy `_cron-backup` (funkčně ověřené, ale bez testu).
3. Minimální test suite: DataCrypt, JWT middleware, rate-limit, kolize slotů.
4. Přidat `public/_headers` (bezpečnostní hlavičky).

**P1 (příští sprint):**
5. CI pipeline (`.github/workflows`): lint + test + kontrola migrací na PR.
6. Rotace šifrovacího klíče (`enc_key_version`).
7. Napojit iDoklad (klíče) → revenue trend + fakturační most.
8. Naseedovat `hero_config`; CORS admin zúžit na doménu.

**P2 (růst):**
9. Dokončit/odebrat `messages`, Newsletter, Search.
10. Instagram/Facebook publikace nebo vědomé odložení; WhatsApp kanál.
11. SEO/AEO JSON-LD; kampaňový modul nad `marketing_campaigns`.

---

## 14. Závěr

Bicom Písek je **provozuschopný, bezpečný a dobře dokumentovaný** systém s vyspělou edge architekturou a kompletním CMS. Před předáním klientce zbývají největší rizika **netechnická**: chybějící testy/CI a procesní detaily (migrační ledger, ověření GDPR cronů). Po jejich uzavření a napojení iDokladu je projekt připraven na ostrý provoz; zbytek (sociální publikace, kampaně, SEO/AEO) jsou růstové příležitosti, ne blokery.

*Report vznikl z živé introspekce produkce + statické analýzy repozitáře. Pro detail viz odkazované soubory.*
