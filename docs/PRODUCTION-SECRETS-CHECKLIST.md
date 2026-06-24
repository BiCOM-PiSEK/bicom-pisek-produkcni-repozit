# 🔐 Production Secrets Checklist — v1.0 RC

> Kompletní seznam všech tajných klíčů, kterých je potřeba pro produkční deployment.
> **Status:** v1.0 RC Ready  
> **Responsibility:** DevOps (MEVERIK) + Klient (BIO ONE LIFE s.r.o.)

---

## 📋 Secrets Status — v1.0 RC

| Rank | Secret | Status | Source | Test | Naset | Owner |
|---|---|---|---|---|---|---|
| **🔴 CRÍTICA** | `SECRET_ENCRYPTION_KEY` | ✅ V prod | `openssl rand -hex 32` | — | ✅ | DevOps |
| **🔴 CRÍTICA** | `SECRET_ADMIN_TOKEN` | ✅ V prod | Generated | — | ✅ | DevOps |
| **🟠 IMPORTANT** | `RESEND_API_KEY` (Pages) / `SECRET_RESEND_API_KEY` (compat) | 🟢 Ready | resend.com | [L1 guide](LAUNCH-TESTING-GUIDE.md#-l1--resend-email-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_SMS_GATEWAY_CLIENT_ID` | 🟢 Ready | GoSMS.cz | [L5 guide](LAUNCH-TESTING-GUIDE.md#-l5--gosms-sms-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_SMS_GATEWAY_CLIENT_SECRET` | 🟢 Ready | GoSMS.cz | [L5 guide](LAUNCH-TESTING-GUIDE.md#-l5--gosms-sms-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_STRIPE_SECRET_KEY` | 🟠 Čeká | stripe.com (live) | [L8 guide](LAUNCH-TESTING-GUIDE.md#-l8--stripe-live-payment-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_STRIPE_WEBHOOK_SECRET` | 🟠 Čeká | stripe.com | [L8 guide](LAUNCH-TESTING-GUIDE.md#-l8--stripe-live-payment-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_IDOKLAD_CLIENT_ID` | 🟠 Čeká | iDoklad.cz | [L9 guide](LAUNCH-TESTING-GUIDE.md#-l9--idoklad-invoice-verification) | 🔲 | DevOps |
| **🟠 IMPORTANT** | `SECRET_IDOKLAD_CLIENT_SECRET` | 🟠 Čeká | iDoklad.cz | [L9 guide](LAUNCH-TESTING-GUIDE.md#-l9--idoklad-invoice-verification) | 🔲 | DevOps |
| **🟢 OPTIONAL** | `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL` | ✅ V prod | Google Cloud Console | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | ✅ V prod | Google Cloud Console | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_GOOGLE_CALENDAR_ID` | ✅ V prod | Lenka (admin@bicom-pisek.cz) | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_GOOGLE_WORKSPACE_ADMIN_EMAIL` | ✅ V prod | Known value | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_GROQ_API_KEY` | ✅ V prod | groq.com | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_GEMINI_API_KEY` | ✅ V prod | Google AI Studio | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_META_GRAPH_ACCESS_TOKEN` | ✅ V prod | developers.facebook.com | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_META_IG_USER_ID` | ✅ V prod | Meta Business Suite | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `SECRET_CALENDAR_WEBHOOK_SECRET` | ✅ V prod | Generated | — | ✅ | DevOps |
| **🟢 OPTIONAL** | `TURNSTILE_SITEKEY` | 🟢 Ready | Cloudflare | — | 🔲 | DevOps |
| **🟢 OPTIONAL** | `TURNSTILE_SECRET_KEY` | 🟢 Ready | Cloudflare | — | 🔲 | DevOps |

---

## 🚀 Deployment Procedure — Jak nastavit Secrets

### Prereq: Přístup k Cloudflare CLI

```bash
# 1. Nainstalovat Wrangler (pokud není)
npm install -g @cloudflare/wrangler

# 2. Authentizovat
wrangler login
# → Otevře browser, přihlásit se do Cloudflare

# 3. Ověřit config
wrangler whoami
cat wrangler.toml | grep name
# → měl by vrátit "bicom-pisek-produkcni-repozit" nebo podobně
```

### Step 1️⃣ — Kritické Secrets (JIŽ V PRODUKCI)

```bash
# Tyto klíče jsou už nastavené v produkční D1
# Jen ověřit že fungují:

# 1. Encryption Key
wrangler secret get SECRET_ENCRYPTION_KEY
# → musí vrátit 64-char hex string

# 2. Admin Token
wrangler secret get SECRET_ADMIN_TOKEN
# → musí vrátit nějaký řetězec (long random)

# Pokud se vrátí prázdno: CHYBA! Zkontrolovat console.cloudflare.com
```

### Step 2️⃣ — Email (L1 — Resend)

```bash
# 1. Vytvořit API klíč v Resend
#    https://resend.com → Settings → API Keys → Create API Key

# 2. Nastavit Secret v Cloudflare Pages projektu
wrangler pages secret put RESEND_API_KEY --project-name bicom-pisek
# → Vložit API key a Enter

# 3. Ověřit DNS (viz LAUNCH-TESTING-GUIDE.md § L1)
#    Cloudflare DNS → SPF/DKIM/DMARC records
```

### Step 3️⃣ — SMS (L5 — GoSMS)

```bash
# 1. Vytvořit OAuth2 aplikaci v GoSMS
#    https://gosms.cz → Integrace → OAuth2 Setup

# 2. Nastavit Secret
wrangler secret put SECRET_SMS_GATEWAY_CLIENT_ID
# → Vložit Client ID a Enter

wrangler secret put SECRET_SMS_GATEWAY_CLIENT_SECRET
# → Vložit Client Secret a Enter

# 3. Dobít SMS kredit
#    https://gosms.cz → Příspěvek → Koupit balíček
#    (alespoň 100 SMS kreditu na produkční testy)

# 4. Ověřit v admin nastavení
#    Admin Console → Nastavení → SMS (toggle ON)
```

### Step 4️⃣ — Platby (L8 — Stripe)

```bash
# 1. Vytvořit live API klíče ve Stripe
#    https://dashboard.stripe.com → Settings → API Keys (Live mode)
#    Zkopírovat "Secret key"

# 2. Vytvořit webhook endpoint secret
#    https://dashboard.stripe.com → Webhooks → Add endpoint
#    - URL: https://bicom-pisek.cz/api/stripe-webhook
#    - Events: charge.succeeded, payment_intent.succeeded
#    - Zkopírovat "Signing secret"

# 3. Nastavit Secrets
wrangler secret put SECRET_STRIPE_SECRET_KEY
# → Vložit Secret key a Enter

wrangler secret put SECRET_STRIPE_WEBHOOK_SECRET
# → Vložit Webhook signing secret a Enter

# 4. Ověřit v admin dashboardu
#    Admin Console → Dashboard → Launch Blockers
#    L8 by měl být označen jako ✅ CONFIGURED
```

### Step 5️⃣ — Faktury (L9 — iDoklad)

```bash
# 1. Vytvořit OAuth2 aplikaci v iDoklad
#    https://www.idoklad.cz → Integrace → Nová aplikace
#    - Redirect URI: https://bicom-pisek.cz/api/idoklad-callback
#    - Zkopírovat "Client ID" a "Client Secret"

# 2. Nastavit vystavovatel v iDoklad
#    https://www.idoklad.cz → Nastavení → Vydávající osoba
#    - BIO ONE LIFE s.r.o.
#    - IČO: 23950978
#    - Adresa ordinace
#    - Bankovní účet

# 3. Nastavit Secrets
wrangler secret put SECRET_IDOKLAD_CLIENT_ID
# → Vložit Client ID a Enter

wrangler secret put SECRET_IDOKLAD_CLIENT_SECRET
# → Vložit Client Secret a Enter

# 4. Test (viz LAUNCH-TESTING-GUIDE.md § L9)
```

### Step 6️⃣ — Anti-Spam (L2 — Turnstile)

```bash
# 1. Vytvořit Turnstile site ve Cloudflare
#    https://dash.cloudflare.com → Turnstile → Create site
#    - Domain: bicom-pisek.cz
#    - Mode: Managed
#    - Zkopírovat "Site Key" a "Secret Key"

# 2. Nastavit Secrets
wrangler secret put TURNSTILE_SITEKEY
# → Vložit Site Key a Enter

wrangler secret put TURNSTILE_SECRET_KEY
# → Vložit Secret Key a Enter

# 3. Ověřit na webu
#    https://bicom-pisek.cz → Rezervovat
#    → měl by se zobrazit "I'm not a robot" widget
```

### Step 7️⃣ — Ověřit všechny Secrets

```bash
# Vypsat všechny nastavené secrets
wrangler secret list

# Měl by vrátit něco jako:
# NAME                              TYPE
# SECRET_ENCRYPTION_KEY             text
# SECRET_ADMIN_TOKEN                text
# SECRET_RESEND_API_KEY             text
# SECRET_SMS_GATEWAY_CLIENT_ID      text
# SECRET_SMS_GATEWAY_CLIENT_SECRET  text
# SECRET_STRIPE_SECRET_KEY          text
# SECRET_STRIPE_WEBHOOK_SECRET      text
# SECRET_IDOKLAD_CLIENT_ID          text
# SECRET_IDOKLAD_CLIENT_SECRET      text
# TURNSTILE_SITEKEY                 text
# TURNSTILE_SECRET_KEY              text
# ... (ostatní)
```

### Step 8️⃣ — Deploy & Test

```bash
# 1. Deploy (z main branch)
wrangler deploy
# → GitHub Actions automaticky spustí

# 2. Spustit LAUNCH-TESTING-GUIDE workflow
#    https://docs/LAUNCH-TESTING-GUIDE.md

# 3. Signoff
#    Přidat checkpoint v checkpoints/
#    → "Production Secrets Configured & Tested — READY FOR LAUNCH"
```

---

## 🔄 Secret Rotation (Každoročně)

### Renewal Schedule
| Secret | Frequency | Deadline |
|---|---|---|
| `SECRET_STRIPE_SECRET_KEY` | 12 měsíců | Stripe nová klíčová sada |
| `SECRET_IDOKLAD_CLIENT_SECRET` | 12 měsíců | iDoklad OAuth refresh |
| `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | 24 měsíců | Google Cloud SA key rotation |
| `SECRET_GROQ_API_KEY` | Podle Groq policy | — |
| `SECRET_GEMINI_API_KEY` | Podle Google policy | — |

### How to Rotate (Example: Stripe)
```bash
# 1. V Stripe → vytvořit nový secret key (don't delete old yet)
# 2. Nastavit nový v Cloudflare
wrangler secret put SECRET_STRIPE_SECRET_KEY
# 3. Deploy & test
wrangler deploy
# 4. Po úspěšném testu → v Stripe deaktivovat starý klíč
```

---

## 🚨 Incident Response — Co dělat pokud klíč uniká

### Procedure

1. **Okamžitě** (< 5 minut):
   ```bash
   # Zrušit starý klíč v externím systému (Stripe, iDoklad, atd.)
   # Např. Stripe → Settings → API Keys → Revoke
   ```

2. **Během 15 minut:**
   ```bash
   # Vytvořit nový klíč
   # Nastavit v Cloudflare
   wrangler secret put SECRET_STRIPE_SECRET_KEY
   
   # Deploy
   wrangler deploy
   ```

3. **Dokumentace:**
   ```
   Audit log → zaznamenant incident
   - Co se stalo
   - Kdy
   - Jaký klíč
   - Co se podniklo
   - Kdo byl notifikován
   ```

4. **Komunikace:**
   - Notify: DevOps Lead, Project Manager, Klient (BIO ONE LIFE)
   - Post-mortem: Co vedlo k úniku? Jak se tomu vyhnout?

---

## 📋 Finální Checklist Před Launchem

### Pre-Launch (Den -1)

- [ ] Všechny secrets v `wrangler secret list` (žádné chybí)
- [ ] Resend: SPF/DKIM ověřeny ✅
- [ ] GoSMS: Kredit > 0 ✅
- [ ] Stripe: Webhook ✅
- [ ] iDoklad: Vystavovatel konfigurován ✅
- [ ] Turnstile: Site vytvořena ✅
- [ ] Google Calendar: Service Account testován ✅

### Launch Day (Den 0)

- [ ] Spustit E2E test: [LAUNCH-TESTING-GUIDE.md § End-to-End Test](LAUNCH-TESTING-GUIDE.md#-end-to-end-test--celý-booking-flow)
- [ ] Všechny testy PASS ✅
- [ ] Admin notifikován: LIVE ✅
- [ ] Klient notifikován: LIVE ✅
- [ ] Monitoring aktivní (Sentry, Cloudflare Analytics) ✅

### Post-Launch (Den +1)

- [ ] 24h runtime bez chyb ✅
- [ ] 10+ test bookings zpracováno úspěšně ✅
- [ ] E-maily dochází do inboxu ✅
- [ ] SMS dochází do mobilu ✅
- [ ] Faktury se vytvářejí správně ✅
- [ ] Admin konzole je responsive ✅

---

## 📞 Support Contacts

| Role | Name | Email | Phone |
|---|---|---|---|
| Project Manager | [Klient] | — | — |
| DevOps (MEVERIK) | [Kontakt] | — | +420 123 456 789 |
| Resend Support | — | support@resend.com | — |
| GoSMS Support | — | support@gosms.cz | — |
| Stripe Support | — | support@stripe.com | — |
| iDoklad Support | — | support@idoklad.cz | — |

---

*Dokument: PRODUCTION-SECRETS-CHECKLIST.md*  
*Verze: 1.0*  
*Vytěž: 2026-06-22*  
*Poslední update: 2026-06-22*
