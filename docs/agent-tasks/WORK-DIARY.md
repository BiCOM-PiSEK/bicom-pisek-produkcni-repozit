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
