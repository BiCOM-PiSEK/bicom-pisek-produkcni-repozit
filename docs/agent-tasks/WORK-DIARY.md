# Pracovní deník agentů — Bicom Písek

> Každý agent po dokončení (nebo přerušení) práce zapíše záznam.

---

## 2026-05-26 Fáze A — Jádro a databáze (Sprint A.1–A.3)
**Model:** Antigravity (Claude)
**Branch:** agent/ag-w2-00-repo-init → squash merged to main
**Status:** ✅ Hotovo

### Co bylo implementováno
- Kompletní D1 databázové schéma (13 tabulek) s CHECK constrainty, indexy a FK
- 5 číslovaných migrací (0001–0005)
- Seed data pro 11 reálných služeb Bicom
- Šifrovací vrstva `DataCrypt` (AES-GCM 256-bit, Web Crypto API)
- Databázové helpery (createBooking, confirmBooking, getDecryptedBooking, addGeoLead, subscribeNewsletter)
- Checklist API klíčů (`docs/API_KEYS_CHECKLIST.md`)

---

## 2026-05-26 Fáze B+C — Konektory, API endpointy, Queues, Crony
**Model:** Antigravity (Claude)
**Branch:** agent/ag-w2-01-connectors
**Status:** ✅ Hotovo

### Co bylo implementováno
- **5 konektorů** pro externí služby (+ sdílený fetchWithRetry):
  - `google-calendar.js` — JWT auth, insertEvent, updateEventColor, listEvents
  - `telegram.js` — sendMessage, sendBookingNotification, sendEscalation, sendCashFlowAlert, sendWeeklyDigest
  - `idoklad.js` — OAuth2 Client Credentials, createInvoice, getInvoices, getStats
  - `resend.js` — sendBookingConfirmation, sendBookingReminder
  - `gosms.js` — sendSms, sendBookingReminder
- **6 API endpointů**:
  - `book.js` — POST /api/book (validace, šifrování, queue)
  - `newsletter.js` — POST /api/newsletter (dedup, šifrování)
  - `services.js` — GET /api/services (KV cache, D1 fallback)
  - `chat.js` — POST /api/chat (Workers AI → Groq → Gemini, právní filtr, auto-cenzura)
  - `health.js` — GET /api/health (D1 + KV + secrets check)
  - `calendar-hook.js` — POST /api/calendar-hook (dedup, Resend, reminder)
- **2 Queue consumery**:
  - `_queue-booking.js` — Calendar + email + Telegram + reminders
  - `_queue-social.js` — Social media publikace s UTM
- **7 Cron workerů**:
  - `_cron-reminders.js` — SMS/email upomínky (každou hodinu)
  - `_cron-gdpr.js` — Anonymizace 30+ dní (denně 03:30)
  - `_cron-geo.js` — GEO analytika + doporučení (Po 04:00)
  - `_cron-cashflow.js` — Cash flow monitoring (Po 09:00)
  - `_cron-social.js` — Publikace naplánovaných postů (denně 08:00)
  - `_cron-instagram.js` — IG sync → R2 + blog (denně 03:00)
  - `_cron-backup.js` — D1 backup → R2 (Ne 02:00, retence 8 týdnů)

### Soubory vytvořené
- `functions/lib/connectors/_fetch-retry.js`
- `functions/lib/connectors/google-calendar.js`
- `functions/lib/connectors/telegram.js`
- `functions/lib/connectors/idoklad.js`
- `functions/lib/connectors/resend.js`
- `functions/lib/connectors/gosms.js`
- `functions/api/book.js`
- `functions/api/newsletter.js`
- `functions/api/services.js`
- `functions/api/chat.js`
- `functions/api/health.js`
- `functions/api/calendar-hook.js`
- `functions/api/_queue-booking.js`
- `functions/api/_queue-social.js`
- `functions/api/_cron-reminders.js`
- `functions/api/_cron-gdpr.js`
- `functions/api/_cron-geo.js`
- `functions/api/_cron-cashflow.js`
- `functions/api/_cron-social.js`
- `functions/api/_cron-instagram.js`
- `functions/api/_cron-backup.js`

### Soubory opravené
- `functions/api/book.js` — ALLOWED_SERVICES synchronizovány se skutečným seed katalogem

### Akceptační kritéria — splněno?
- [x] Všech 5 konektorů s graceful fallback a retry logikou
- [x] Všech 6 API endpointů s validací, CORS a error handling
- [x] AI chat s trojitým fallbackem a právním filtrem
- [x] Queue consumery pro async zpracování
- [x] 7 Cron workerů pro automatizaci
- [x] Commitnuté a pushnuté na GitHub

---

## 2026-05-27 Fáze D — Virtual Office Admin SPA (Sprint D.1–D.4)
**Model:** Antigravity (Claude)
**Branch:** agent/ag-w2-02-admin-spa
**Status:** ✅ Hotovo

### Co bylo implementováno
- **Design systém** (`admin.css`, 1400+ řádků):
  - Quiet Luxury paleta (forest, sage, champagne), Cormorant Garamond/Montserrat typografie
  - 24+ sekcí: reset, grid shell, sidebar, topbar, canvas, activity feed, status bar, cards, KPI, tables, forms, toggles, badges, toasts, modals, empty states, skeletons, scrollbar, animations, responsive breakpoints, print, dashboard components
- **SPA kostra** (`index.html`):
  - 3-column CSS Grid (sidebar | topbar+canvas | activity), inline SVG ikony
  - Mobile overlay, hamburger, breadcrumbs, status bar s live metriky
- **Router** (`router.js`):
  - History API, lazy-load ES modulů, fade-in/out přechody, sidebar active state, breadcrumb aktualizace, toast systém
- **API klient** (`api.js`):
  - Fetch wrapper s retry (exponential backoff), timeout (AbortController), CF Access JWT, convenience metody pro všechny endpointy
- **App init** (`app.js`):
  - Sidebar toggle persistence (localStorage), activity feed polling (30s), status bar health check (60s), keyboard shortcuts (⌘B sidebar, Alt+1-7 navigace)
- **7 frontend modulů**:
  - `dashboard.js` — KPI karty s trendy, bookings tabulka, quick actions, GEO bars, system health grid
  - `calendar.js` — tab-filtrovaná tabulka, potvrdit/zrušit booking akce
  - `blog.js` — AI generátor (téma + typ + service kontext), draft seznam
  - `invoices.js` — KPI summary (celkem/uhrazeno/neuhrazeno), tabulka faktur
  - `messages.js` — eskalované dotazy z AI Rádce, Telegram bot stav
  - `geo.js` — bar chart měst, AI doporučení kampaní
  - `settings.js` — toggle switches (SMS, email, Telegram, AI, GDPR), select boxy
- **Admin middleware** (`_middleware.js`):
  - CF Access JWT ověření (iss, aud, exp kontroly), operator lookup v DB, dev mode fallback, CORS, static passthrough
- **7 admin API endpointů**:
  - `dashboard.js` — 8 parallel D1 queries, PII dešifrování, trend kalkulace, system health
  - `bookings.js` — GET s filtrací + PII dešifrováním, PUT s audit logem
  - `copywriter.js` — AI generování (Workers AI → Groq → Gemini), Quiet Luxury system prompt, právní filtr, auto-save draft
  - `invoices.js` — iDoklad v3 proxy (OAuth2), mock fallback
  - `settings.js` — CRUD process_states, whitelist klíčů, role-based access
  - `activity.js` — audit_log → Activity Feed mapování
  - `geo.js` — geo_leads agregace s PSČ-to-město lookup

### Soubory vytvořené
- `public/admin/css/admin.css` — design systém
- `public/admin/index.html` — SPA shell (přepsán)
- `public/admin/js/router.js` — SPA router
- `public/admin/js/api.js` — API klient
- `public/admin/js/app.js` — hlavní inicializace
- `public/admin/js/modules/dashboard.js`
- `public/admin/js/modules/calendar.js`
- `public/admin/js/modules/blog.js`
- `public/admin/js/modules/invoices.js`
- `public/admin/js/modules/messages.js`
- `public/admin/js/modules/geo.js`
- `public/admin/js/modules/settings.js`
- `functions/admin/_middleware.js`
- `functions/admin/dashboard.js`
- `functions/admin/bookings.js`
- `functions/admin/copywriter.js`
- `functions/admin/invoices.js`
- `functions/admin/settings.js`
- `functions/admin/activity.js`
- `functions/admin/geo.js`

### Akceptační kritéria — splněno?
- [x] Design systém Quiet Luxury, light-only
- [x] SPA s vanilla JS routerem a lazy-loaded moduly
- [x] Cloudflare Access JWT autentizace s dev mode
- [x] 7 admin API endpointů s D1, audit logem a PII dešifrováním
- [x] AI Copywriter s právním filtrem a trojitým AI fallbackem
- [x] iDoklad integrace s OAuth2
- [x] Dashboard s KPI, trendy, GEO, system health
- [x] Všech 7 frontend modulů kompletních
- [x] Commitnuté a pushnuté na GitHub (branch: agent/ag-w2-02-admin-spa)

---

## 2026-05-27 Fáze E — Veřejný portál a AI Rádce (Sprint E.1–E.5)
**Model:** Antigravity (Gemini)
**Branch:** agent/ag-w2-03-public-portal
**Status:** ✅ Hotovo

### Co bylo implementováno
- **Veřejný design systém** (`style.css`):
  - Quiet Luxury light-only paleta (alabaster, sage, forest green, champagne gold, charcoal text, mist).
  - Cormorant Garamond (patkové nadpisy pro autoritu) a Montserrat (bezpatkové texty pro čistotu).
  - Responzivní grid layouty, stylování karet služeb, formulářů a inline SVG ikon.
- **SPA rozvržení kostry** (`index.html`):
  - 9 sémantických sekcí (Hero, Průvodce, Jak metoda funguje, Důkaz & bezpečí, Magazín, Rezervační Hub, Kontakt, Patička).
  - Preload Google písem, meta tagy pro SEO/GEO a propojení na lokální NAP data.
- **Klientský SPA Router** (`router.js`):
  - History API + popstate navigace, podpora View Transitions API pro smooth cross-fading.
  - Dynamické načítání a renderování detailů programů (`/sluzby/:slug`), blogových příspěvků (`/magazin/:slug`) a GDPR podmínek (`/gdpr`).
  - Programatické směrování focusu (WCAG AA přístupnost).
  - Cloudflare Pages redirecty (`_redirects`) pro zamezení 404 chyb při obnově stránky.
- **Interaktivní průvodce** (`guide.js`):
  - Spojení se `/api/services` a dynamický detail programů podle výběru symptomu.
  - Odeslání poptávky termínu přes `/api/book` (GDPR šifrování osobních údajů přes DataCrypt, queue).
- **GDPR Cookie Consent** (`consent.js`): Cookie banner s ukládáním do localStorage a správa nastavení.
- **AI Rádce chatbot widget** (`chat-widget.js`): Plovoucí chat s napojením na `/api/chat` (Workers AI, markdown, loading skeletons a session persistence).
- **Veřejný blog API endpoint** (`functions/api/blog.js`): GET `/api/blog` z D1 + KV cache.
- **SEO/AEO optimalizace**:
  - `llms.txt` — strojově čitelný markdown brief pro AI vyhledávače.
  - robots.txt — povoleny AI crawlery (GPTBot, PerplexityBot, atd.).
  - `build-sitemap.js` — sestavení static `sitemap.xml` obsahující všechny hlavní cesty a služby.

### Soubory vytvořené
- `public/assets/css/style.css`
- `public/assets/js/router.js`
- `public/assets/js/guide.js`
- `public/assets/js/consent.js`
- `public/assets/js/chat-widget.js`
- `public/_redirects`
- `public/llms.txt`
- `public/sitemap.xml`
- `scripts/build-sitemap.js`
- `functions/api/blog.js`

### Akceptační kritéria — splněno?
- [x] Design systém Quiet Luxury (light-only, 2 fonty)
- [x] SPA klientský router s View Transitions a focus managementem
- [x] Interaktivní průvodce se `/api/services`
- [x] Objednávkový formulář se šifrováním citlivých údajů
- [x] Chatbot widget spojený s `/api/chat`
- [x] GDPR cookie lišta a disclaimery v patičce
- [x] Veřejné blog API z D1 s KV cache
- [x] llms.txt, robots.txt a generovaná sitemapa
- [x] Commitnuté a sloučené na main

---

## 2026-05-27 Produkční Audit a Opravy Databáze
**Model:** Antigravity (Gemini)
**Branch:** agent/ag-w2-04-schema-fixes -> merged to main
**Status:** ✅ Hotovo

### Co bylo implementováno
- **Produkční Audit a Mapování:** Proveden kompletní audit kódové základny (11 111 řádků kódu), zmapování aktivních a pasivních souborů (viz `production_audit.md`).
- **Nová D1 migrace:** Vytvořen migrační soubor `db/migrations/0006_schema_fixes.sql` pro přidání chybějících sloupců do existujících databází.
  - Přidány sloupce `active` (INTEGER) a `calendar_id` (TEXT) do tabulky `operators`.
  - Přidány sloupce `calendar_event_id` (TEXT), `operator_id` (TEXT) a `updated_at` (TIMESTAMP) do tabulky `bookings` včetně cizího klíče.
- **Aktualizace Master Schématu:** Upraven soubor `db/schema.sql` pro inicializaci čistých databází s kompletní sadou sloupců.
- **Lokální testování:** Ověřena validita schématu `schema.sql` úspěšným provedením inicializace lokální databáze D1.
- **Sloučení:** Vytvořen Pull Request #7, ověřena integrita a squash-sloučeno do větve `main`. Lokální větve a fork `origin` jsou plně aktualizovány.
- **Symlink pro Wrangler:** Vytvořen symbolický odkaz `migrations` -> `db/migrations` v kořeni repozitáře, aby Wrangler mohl automaticky nalézt složku s migracemi při volání `wrangler d1 migrations` bez nutnosti nepovolené úpravy `wrangler.toml`.

### Soubory vytvořené
- `db/migrations/0006_schema_fixes.sql`
- `migrations` (symbolický odkaz na `db/migrations`)

### Soubory opravené
- `db/schema.sql`

### Akceptační kritéria — splněno?
- [x] Pečlivé zmapování všech souborů v kódové základně a sepsání případných issues.
- [x] Vytvoření migračního SQL souboru 0006_schema_fixes.sql.
- [x] Úprava master schématu db/schema.sql.
- [x] Lokální ověření funkčnosti SQL kódu na testovací databázi.
- [x] Vytvoření PR, kontrola a squash merge na main.

---

## 2026-05-27 Produkční Nasazení, Migrace a Konfigurační Opravy
**Model:** Antigravity (Gemini 3.5 Flash)
**Branch:** main
**Status:** ✅ Hotovo

### Co bylo implementováno
- **Konfigurační Integrace:** Nahrazeny placeholder hodnoty `REPLACE_WITH_KV_ID` v konfiguracích `wrangler.toml`, `wrangler.booking-consumer.toml`, `wrangler.social-consumer.toml` a `wrangler.cron-worker.toml` skutečným ID KV namespace `57e7c49eaba94dd4ad9ede723ff69aab`.
- **Opravy Názvu Databáze:** Aktualizována konfigurace v `package.json` tak, aby používala správný název produkční databáze `bicom-pisek-db` namísto neplatného `bicom-db-prod`.
- **Seeding Databáze:** Úspěšně naimportována a otestována seed data z `db/seed/services.sql` do vzdálené Cloudflare D1 databáze `bicom-pisek-db` (všech 11 biorezonančních programů).
- **Zprovoznění R2 Úložiště:** Vytvořen chybějící R2 bucket `bicom-multimedia` na Cloudflare účtu přes Wrangler CLI.
- **Vytvoření Fronty zpráv:** Založeny obě chybějící Cloudflare fronty (Queues) `booking-jobs` a `social-jobs` v prostředí Cloudflare.
- **Nasazení na Cloudflare Pages:** Provedeno kompletní produkční sestavení sitemap a nasazení celé SPA a Pages API Functions na doménu projektu `https://bicom-pisek.pages.dev`.
- **Nasazení Asynchronních Pracovníků:** Nasazeni 3 samostatní asynchronní pracovníci (Workers) pro zpracování front a pravidelných úloh:
  - `bicom-booking-consumer` (Queue consumer pro rezervace a notifikace)
  - `bicom-social-consumer` (Queue consumer pro příspěvky na sociálních sítích)
  - `bicom-cron-worker` (Cron trigger worker pro pravidelné a denní úkoly)
- **Oprava Cron Triggers a Routeru:** Vyřešena chyba syntaxe Cloudflare Workers u nedělních a pondělních úloh úpravou na textové zkratky `SUN` / `MON` v `wrangler.cron-worker.toml` a `functions/api/_cron-worker.js`.
- **Oprava Přesměrování (Redirects):** Upraveny přesměrovací pravidla v `public/_redirects` pro oddělenou podporu SPA routeru na kořeni i v administraci `/admin/*`, čímž se vyřešilo varování o nekonečné smyčce a zajistilo správné načítání obou aplikací po obnovení stránky.
- **Korekce Domény (Kanonický Název):** Změněny všechny odkazy na doménu `bicompisek.cz` (bez pomlčky) na správnou zakoupenou doménu `bicom-pisek.cz` (s pomlčkou) v celém kódu (meta tagy, canonical linky, sitemap generátor, robots.txt, schema JSON-LD, resend mailer, social queue a GDPR šablonu).
- **Stránka Údržby (Maintenance):** Vytvořen kořenový middleware `functions/_middleware.js`, který na hlavní doméně `bicom-pisek.cz` (a `www.bicom-pisek.cz`) zobrazuje prémiovou stránku údržby s PIN kódem (1994) a Cloudflare Turnstile ověřením pro přístup na vývojovou verzi.

### Soubory opravené
- `wrangler.toml` — Konfigurace KV ID
- `wrangler.booking-consumer.toml` — Konfigurace KV ID
- `wrangler.social-consumer.toml` — Konfigurace KV ID
- `wrangler.cron-worker.toml` — Konfigurace KV ID a oprava formátu cron
- `functions/api/_cron-worker.js` — Podpora textových zkratek dní `SUN` / `MON`
- `functions/_middleware.js` — [NOVÝ] Middleware pro technickou údržbu
- `package.json` — Oprava názvů databází v D1 příkazech
- `public/_redirects` — Oprava a optimalizace SPA směrování
- `package-lock.json` — Přidán pro zafixování verzí závislostí
- `scripts/build-sitemap.js` — Kanonická doména `bicom-pisek.cz`
- `public/index.html` — Canonical, OG meta tagy, patička
- `public/robots.txt` — Odkaz na sitemapu
- `public/llms.txt` — Kontaktní údaje a web
- `public/schema/localbusiness.json` — URL a ID strukturovaných dat
- `functions/api/_queue-social.js` — UTM odkazy příspěvků
- `functions/lib/connectors/resend.js` — Doména odesílacího e-mailu
- `public/assets/js/router.js` — GDPR kontaktní e-mail

### Akceptační kritéria — splněno?
- [x] Úspěšný build a kompletní nasazení na Cloudflare Pages
- [x] Všechny chybějící Cloudflare zdroje (R2 bucket, fronty booking-jobs/social-jobs) zřízeny a otestovány
- [x] Databáze D1 migrována a naočkována reálnými daty služeb
- [x] Asynchronní a cron pracovníci úspěšně nasazeni s korektní syntaxí
- [x] SPA přesměrování vyřešeno a otestováno
- [x] Zavedena stránka údržby s PIN (1994) a Turnstile ověřením na hlavní doméně
- [x] Kanonická doména opravena na `bicom-pisek.cz` napříč celým projektem
- [x] Všechny změny čistě commitnuty a pushnuty na GitHub main větev


