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
