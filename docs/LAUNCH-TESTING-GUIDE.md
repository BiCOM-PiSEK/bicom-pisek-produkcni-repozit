# 🚀 Launch Testing Guide — L1/L5/L8/L9 Verification (v1.0 RC)

> Production verification checklist pro launch integrace. **Tento dokument** slouží jako návod pro klienta či QA při finalizaci systému před ostrým spuštěním.
>
> **Status:** v1.0 RC Ready  
> **Date:** 2026-06-22  
> **Responsibility:** QA Team (klient) + DevOps (MEVERIK)

---

## 📋 Launch Blockers — Zbývající Testy

| ID | Integrace | Status | Test | Owner | ETA |
|---|---|---|---|---|---|
| **L1** | Resend (E-mail) | 🟢 Připraveno | SPF/DKIM + test e-mail | QA | Hned |
| **L2** | Turnstile (Anti-spam) | ✅ **Hotovo** | Deploy + test CAPTCHA | DevOps | Done |
| **L5** | GoSMS (SMS) | 🟢 Připraveno | Kredit + test SMS | QA | Hned |
| **L8** | Stripe (Platby) | 🟠 Čeká klíče | Live test 500 Kč | QA | Po klíčích |
| **L9** | iDoklad (Faktury) | 🟠 Čeká klíče | Test invoice po platbě | QA | Po klíčích |

---

## ✅ L2 — Turnstile Anti-Spam (HOTOVO)

### Implementace
- ✅ `functions/lib/turnstile.js` — verifikační logika
- ✅ `functions/api/booking-config.js` — exponuje `turnstile_sitekey`
- ✅ Frontend — React form renderuje Turnstile widget (pokud `turnstile_sitekey` ≠ null)
- ✅ `POST /api/book` — verifikuje token před zpracováním

### Jak to funguje
1. Frontend renderuje Cloudflare Turnstile widget
2. Uživatel projde CAPTCHA
3. Frontend dostane `token` od Turnstile
4. Frontend odešle token v `POST /api/book { turnstile_token }`
5. Backend volá `verifyTurnstile()` → Cloudflare ověří token
6. Pokud OK → booking pokračuje; Pokud FAIL → 400 Bad Request

### Test
```bash
# 1. Ověřit že booking-config vrací turnstile_sitekey
curl https://bicom-pisek.cz/api/booking-config | jq .turnstile_sitekey
# → musí vrátit nějaký string (ne null)

# 2. Na webu otestovat rezervaci
# - Přejít na https://bicom-pisek.cz
# - Kliknout na "Rezervovat"
# - Zkontrolovat že se zobrazí "I'm not a robot" CAPTCHA widget
# - Projít CAPTCHA
# - Vyplnit rezervaci
# - Odeslat

# 3. V admin konzoli zkontrolovat audit log
# GET /admin/dashboard → viz booking data
```

### Produkční Setup (DevOps)
```bash
# Nastavit v Cloudflare Secrets:
wrangler secret put TURNSTILE_SITEKEY    # Z Cloudflare dashboard
wrangler secret put TURNSTILE_SECRET_KEY # Z Cloudflare dashboard
```

---

## 🟢 L1 — Resend Email Verification

### Implementace
- ✅ `functions/lib/resend.js` — klient pro odesílání e-mailů
- ✅ `functions/api/book` — odesílá potvrzení po rezervaci
- ✅ Booking Consumer — odesílá reminder SMS 24h před
- ✅ Template: `Welcome & Confirmation` (Resend template ID)

### Jak to funguje
1. Uživatel vytvoří rezervaci: `POST /api/book`
2. Backend odesílá e-mail: **„Vaše rezervace byla přijata"**
3. Template: `{name}, potvrzujeme Vaši rezervaci na {datetime} v ordinaci Bicom Písek`
4. Frontend ze získá odkaz na e-mail: `info@bicom-pisek.cz`

### Test — SPF/DKIM Verifikace (QA + Domain Owner)

**Prerequisity:**
- Vlastnit doménu `bicom-pisek.cz` v Cloudflare
- Přístup do Resend dashboardu
- Přístup do DNS nastavení

**Kroky:**

1. **V Resend dashboardu:**
   ```
   Resend.com → Domains → bicom-pisek.cz → Verify
   ```
   - Kopírovat DNS records (SPF, DKIM, DMARC)

2. **V Cloudflare DNS:**
   ```
   Cloudflare → Zones → bicom-pisek.cz → DNS Records
   ```
   - Přidat TXT record pro SPF: `v=spf1 include:resend.dev ~all`
   - Přidat CNAME pro DKIM: `default._domainkey.bicom-pisek.cz CNAME default._domainkey.resend.dev`
   - Přidat DMARC: `_dmarc.bicom-pisek.cz TXT "v=DMARC1; p=quarantine"`

3. **Ověřit v Resend:**
   ```
   Resend dashboard → Verify Domain → (počkat 5-10 minut)
   → Status by měl být ✅ VERIFIED
   ```

4. **Live Email Test:**
   ```bash
   # Test 1: Deploy test-mail endpoint
   curl -X POST https://bicom-pisek.cz/api/test-mail \
     -H "Content-Type: application/json" \
     -d '{ "to": "testuser@example.com", "subject": "Test email" }'
   
   # Test 2: V produkci vytvořit testovací rezervaci
   # - Zadat název, e-mail
   # - Zkontrolovat že e-mail dorazí do inboxu (ne spam!)
   # - Ověřit že odkaz „Potvrdit rezervaci" funguje
   
   # Test 3: V Resend dashboardu ověřit doručení
   # Resend → Analytics → Emails
   # Status by měl být "Delivered" (ne "Bounced" nebo "Failed")
   ```

### Produkční Setup (DevOps)
```bash
# 1. Vytvořit Resend API klíč
#    Resend.com → Settings → API Keys → Create API Key

# 2. Nastavit v Cloudflare Pages Secrets
wrangler pages secret put RESEND_API_KEY --project-name bicom-pisek

# 3. Ověřit DNS records jsou aktivní
#    Resend dashboard → Domain Status = ✅ Verified
```

### Fallback (Pokud Resend selže)
```javascript
// V kódu je fallback na Groq API pro plain text notification
// Pokud Resend API vrátí chybu:
// 1. Notification se loguje do `audit_log`
// 2. Admin dostane notifikaci na Telegram
// 3. Klient nedostane e-mail (musí se klienta kontaktovat ručně)
```

---

## 🟢 L5 — GoSMS SMS Verification

### Implementace
- ✅ `functions/lib/gosms.js` — OAuth2 klient pro SMS brána
- ✅ `functions/api/book` — odesílá SMS potvrzení (pokud `reminder_channel = sms`)
- ✅ Booking Consumer — odesílá SMS reminder 24h před (T-24h cron)
- ✅ Format: `Bicom Písek: Potvrzujeme Vaši rezervaci na {time} dne {date}. Prosím, dorazte včas. Tel: +420 123 456 789`

### Jak to funguje
1. Uživatel vybere `reminder_channel = SMS` v rezervačním formuláři
2. Po rezervaci dostane SMS potvrzení
3. 24h před rezervací dostane SMS upomínku

### Test — SMS Verification (QA)

**Prerequisity:**
- Mít přístup k GoSMS.cz účtu
- Mít aktivní kredit na SMS brání
- Mít testovací telefonní číslo

**Kroky:**

1. **Zkontrolovat kredit:**
   ```
   GoSMS.cz → Dashboard → Kredit
   Měl by být > 0 (alespoň 50 SMS kreditu pro testy)
   ```

2. **Nastavit OAuth2 v kódu:**
   ```bash
   # V Cloudflare Secrets
   wrangler secret put SECRET_SMS_GATEWAY_CLIENT_ID
   wrangler secret put SECRET_SMS_GATEWAY_CLIENT_SECRET
   wrangler secret put SMS_GATEWAY_CHANNEL  # Volitelně
   ```

3. **Live SMS Test — Metoda 1 (přes rezervaci):**
   ```
   # Na webu
   1. Přejít https://bicom-pisek.cz
   2. Vyplnit rezervaci:
      - Jméno: "Test Name"
      - E-mail: testuser@example.com
      - Telefon: +420 XXXXXXXXX (Vaše číslo)
      - Reminder: SMS
   3. Odeslat
   4. Zkontrolovat že SMS přijdete do 10 sekund
   ```

4. **Live SMS Test — Metoda 2 (přes admin):**
   ```bash
   # Volat endpoint přímo (pokud existuje)
   curl -X POST https://bicom-pisek.cz/api/test-sms \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "phone": "+420 123 456 789", "message": "Test SMS" }'
   ```

5. **Ověřit v GoSMS dashboardu:**
   ```
   GoSMS.cz → Odeslané SMS → Hledat Váš test SMS
   Status by měl být "Delivered" (zelená fajfka)
   ```

### Produkční Setup (DevOps)
```bash
# 1. Vytvořit GoSMS OAuth2 credentials
#    GoSMS.cz → API → OAuth2 Setup

# 2. Dobít SMS kredit
#    GoSMS.cz → Příspěvek → Zvolit balíček

# 3. Nastavit v Cloudflare Secrets
wrangler secret put SECRET_SMS_GATEWAY_CLIENT_ID
wrangler secret put SECRET_SMS_GATEWAY_CLIENT_SECRET

# 4. Ověřit v admin nastavení
#    Admin Console → Nastavení → SMS Reminders (switch = ON)
```

---

## 🟠 L8 — Stripe Live Payment Verification

### Implementace
- ✅ `functions/api/stripe-checkout` — vytvoří Stripe Checkout Session
- ✅ `functions/api/stripe-webhook` — zpracuje webhook po platbě
- ✅ D1 — tabulka `payment_transactions` + `stripe_session_id` v `bookings`
- ✅ Audit log — zaznamenává cada payment event

### Jak to funguje
1. Uživatel vytvoří rezervaci: `POST /api/book { amount: 500 }`
2. Backend volá `POST /api/stripe-checkout` → Stripe vrátí session ID
3. Frontend redirectuje uživatele na Stripe Checkout (`checkout.stripe.com/pay/...`)
4. Uživatel zaplatí kartou
5. Stripe volá webhook: `POST /api/stripe-webhook`
6. Backend ověří podpis, updatuje booking na `pending` (ne `pending_payment`)
7. Admin dostane notifikaci: `"Nová platba 500 Kč potvrzena"`

### Prerequisites — Stripe Setup (DevOps)

**Krok 1: Vytvořit Stripe účet**
```
1. Zaregistrovat se na https://stripe.com (CZ)
2. Projít KYC verifikace (firmu BIO ONE LIFE s.r.o.)
3. Aktivovat live mode
```

**Krok 2: Vytvořit live API klíče**
```
Stripe Dashboard → Settings → API Keys
- Publishable key (veřejný, frontend)
- Secret key (tajný, backend) ← TURNSTILE_SECRET_KEY
```

**Krok 3: Vytvořit Webhook endpoint**
```
Stripe Dashboard → Webhooks → Add endpoint
- URL: https://bicom-pisek.cz/api/stripe-webhook
- Events: charge.succeeded, payment_intent.succeeded
- Generate signing secret ← SECRET_STRIPE_WEBHOOK_SECRET
```

### Test — Live Payment Verification (QA)

**Prerequisity:**
- Stripe live klíče nastaveny v CF Secrets
- Webhook endpoint ověřen v Stripe
- Testovací kreditní karta (Stripe test karty fungují i v live mode pro testing)

**Test Karty:**
```
Visa:       4242 4242 4242 4242
MasterCard: 5555 5555 5555 4444
Exp:        12/25 (libovolný budoucí měsíc)
CVC:        123
```

**Kroky Testu:**

1. **V Stripe dashboardu aktivovat test mode:**
   ```
   Dashboard → Test Mode (toggle ON)
   ```

2. **Na webu vytvořit rezervaci se Stripe:**
   ```
   1. Přejít https://bicom-pisek.cz
   2. Vyplnit rezervaci (s telefonem)
   3. V formuláři vybrat zálohu: „Zaplatit 500 Kč kartu"
   4. Kliknout "Pokračovat k platbě"
   5. Redirect na Stripe Checkout
   6. Vyplnit test kartu (4242 4242 4242 4242)
   7. Potvrdit platbu
   ```

3. **Ověřit v Stripe dashboardu:**
   ```
   Stripe Dashboard → Payments
   - Nová platba by měla být vidět
   - Status: Succeeded (zelená)
   - Amount: 500 CZK
   ```

4. **Ověřit v admin konzoli:**
   ```
   Admin Console → Rezervace
   - Booking by měl mít status "pending" (byl `pending_payment`)
   - V audit logu: "stripe_payment_confirmed", amount, timestamp
   ```

5. **Ověřit webhook:**
   ```
   Stripe Dashboard → Webhooks → Events
   - charge.succeeded by měl být vidět
   - Timestamp odpovídá našemu testu
   Status: Delivered (zelená)
   ```

### Produkční Setup (DevOps)

```bash
# 1. Vygenerovat live API klíče (viz Prerequisites výše)

# 2. Nastavit v Cloudflare Secrets
wrangler secret put SECRET_STRIPE_SECRET_KEY
wrangler secret put SECRET_STRIPE_WEBHOOK_SECRET

# 3. Ověřit webhook v Stripe
#    Stripe Dashboard → Webhooks → Status = ✅ Active

# 4. Spustit live test
#    (viz Test Kroky výše)
```

---

## 🟠 L9 — iDoklad Invoice Verification

### Implementace
- ✅ `functions/lib/idoklad.js` — OAuth2 klient pro iDoklad API
- ✅ `functions/api/stripe-webhook` — po úspěšné platbě vytvoří fakturu
- ✅ Audit log — zaznamenává invoice creation
- ✅ Admin modul — možnost vytvořit fakturu ručně

### Jak to funguje
1. Uživatel zaplatí přes Stripe: `charge.succeeded`
2. Backend volá `POST /idoklad/issues` → vytvoří fakturu
3. Faktura má: klientova jméno, e-mail, částku, DPH (20% CZ)
4. iDoklad vrátí invoice ID + PDF URL
5. Audit log: `{ action: 'invoice_issued', idoklad_id, amount, pdf_url }`

### Prerequisites — iDoklad Setup (DevOps)

**Krok 1: Vytvořit iDoklad účet**
```
1. Zaregistrovat se na https://www.idoklad.cz (CZ)
2. Nastavit firmu: BIO ONE LIFE s.r.o., IČO 23950978
3. Nastavit adresu, DIČ, bankový účet
```

**Krok 2: Vytvořit OAuth2 aplikaci**
```
iDoklad.cz → Integrace → Nová aplikace
- Název: "Bicom Písek Booking System"
- Redirect URI: https://bicom-pisek.cz/api/idoklad-callback
- Scopes: issues.create, issues.read, contacts.read
- Dostat: Client ID + Client Secret
```

**Krok 3: Nastavit vystavovatel faktury**
```
iDoklad.cz → Nastavení → Vydávajicí osoba
- Jméno: BIO ONE LIFE s.r.o.
- IČO: 23950978
- Adresa: [ordinace adresa]
- Bankovní účet: [vložit]
```

### Test — Invoice Verification (QA)

**Prerequisity:**
- iDoklad OAuth2 klíče nastaveny v CF Secrets
- Vystavovatel konfigurován v iDoklad

**Kroky Testu:**

1. **Spustit plnou Stripe test: L8 (viz výše)**
   - Cíl: fakturu vytvoří webhook automaticky

2. **V iDoklad dashboardu ověřit fakturu:**
   ```
   iDoklad.cz → Faktury → Všechny faktury
   - Nová faktura by měla být vidět
   - Status: Vytvoření
   - Částka: 500 CZK + 20% DPH
   - Klient: test e-mail z rezervace
   ```

3. **Ověřit v admin konzoli:**
   ```
   Admin Console → Fakturace
   - Nová faktura by měla být vidět
   - iDoklad ID: [nějaké číslo]
   - PDF odkaz: clickable
   ```

4. **Ověřit audit log:**
   ```
   Admin Console → Audit Log
   - action: "invoice_issued"
   - idoklad_id: [ID z iDokladu]
   - amount: 600 (500 + DPH)
   - timestamp: čas testu
   ```

### Fallback (Pokud iDoklad API selže)
```javascript
// Pokud iDoklad vrátí chybu:
// 1. Booking se nezastaví (platba je již potvrzena)
// 2. Audit log: "invoice_creation_failed", reason, error_code
// 3. Admin dostane Telegram notification: "Chyba při vytváření faktury"
// 4. Admin ji může vytvořit ručně v iDoklad dashboardu
```

### Produkční Setup (DevOps)

```bash
# 1. Vygenerovat OAuth2 klíče (viz Prerequisites výše)

# 2. Nastavit v Cloudflare Secrets
wrangler secret put SECRET_IDOKLAD_CLIENT_ID
wrangler secret put SECRET_IDOKLAD_CLIENT_SECRET

# 3. Spustit test (viz Test Kroky výše)
```

---

## 🧪 End-to-End Test — Celý Booking Flow

### Scénář: Kompletní rezervace s platbou a fakturou

**Doba:** ~15 minut  
**Typ:** Happy path (vše funguje optimálně)

**Kroky:**

```
1. FRONTEND — Rezervační formulář
   [ ] Přejít https://bicom-pisek.cz
   [ ] Kliknout "Rezervovat"
   [ ] Vyplnit formulář:
       - Jméno: "Test User"
       - E-mail: test@example.com
       - Telefon: +420 123 456 789
       - Datum: Zítřejší pracovní den
       - Čas: Vybrat z dostupných
       - Poznámka: "Testovací rezervace"
       - Reminder: SMS
   [ ] Zkontrolovat Turnstile CAPTCHA se zobrazí
   [ ] Projít CAPTCHA
   [ ] Kliknout "Zaplatit 500 Kč"

2. PAYMENT — Stripe Checkout
   [ ] Redirect na Stripe
   [ ] Vyplnit test kartu: 4242 4242 4242 4242
   [ ] Vyplnit exp: 12/25, CVC: 123
   [ ] Potvrdit platbu
   [ ] Redirect zpět na bicom-pisek.cz (success page)

3. VERIFICATION — Ověření v systémech
   [ ] Zkontrolovat booking v admin konzoli
       - Status: "pending" (bez pending_payment)
       - Stripe payment: "paid"
       - Amount: 500 CZK
   [ ] Zkontrolovat e-mail
       - Měl být doručen do inbox (ne spam)
       - Odkaz "Potvrdit" funguje
   [ ] Zkontrolovat SMS
       - Měl dorazit do 10 sekund
       - Obsahuje čas a den rezervace
   [ ] Zkontrolovat fakturu
       - V admin konzoli: "Fakturace" → viz nová faktura
       - V iDoklad: Faktury → viz nová 600 CZK (s DPH)
   [ ] Zkontrolovat Google Calendar
       - Event vidět v admin@bicom-pisek.cz kalendáři
       - Barva: žlutá (pending)
   [ ] Zkontrolovat Telegram
       - Admin dostane notifikaci (pokud nakonfigurován)
   [ ] Zkontrolovat Stripe
       - Payment vidět v dashboardu
       - Status: Succeeded
       - Webhook: Delivered
   [ ] Zkontrolovat audit log
       - action: "book"
       - action: "stripe_payment_confirmed"
       - action: "invoice_issued"
       - Všechny s timestampem
```

**Success Criteria:**
- ✅ Booking vytvořen
- ✅ Platba zpracována
- ✅ Faktura vytvořena
- ✅ E-mail doručen
- ✅ SMS doručena
- ✅ Google Calendar updatován
- ✅ Audit log úplný
- ✅ Admin dostal notifikaci

---

## 🔍 Debugging & Rollback

### Pokud test selže

| Symptom | Příčina | Řešení |
|---|---|---|
| Turnstile se nezobrazuje | TURNSTILE_SITEKEY nenastavený | `wrangler secret put TURNSTILE_SITEKEY` |
| E-mail nedorazí | Resend klíč neplatný nebo SPF/DKIM | Ověřit v Resend; nastavit DNS records |
| SMS nedorazí | GoSMS kredit 0 nebo OAuth chyba | Dobít kredit; ověřit credentials |
| Stripe redirect selže | SECRET_STRIPE_SECRET_KEY neplatný | Ověřit v Stripe live mode |
| Faktura se nevytvoří | iDoklad OAuth chyba | Ověřit credentials; webhook ověřit |
| Webhook se nespustí | Endpoint URL nesprávný | Ověřit v Stripe: `https://bicom-pisek.cz/api/stripe-webhook` |

### Rollback příkaz
```bash
# Pokud vše selže, vrátit na stabilní commit
git revert 40038ac  # Current HEAD
git push origin main
# GitHub Actions automaticky redeploy
```

---

## ✅ Launch Checklist — Podpis

Po úspěšném absolvování všech testů:

```markdown
### Checklist Certifikace

- [ ] L1 — Resend: SPF/DKIM ✅, Test e-mail doručen ✅
- [ ] L2 — Turnstile: CAPTCHA funguje ✅
- [ ] L5 — GoSMS: Test SMS doručena ✅
- [ ] L8 — Stripe: Test platba zpracována ✅, Webhook delivered ✅
- [ ] L9 — iDoklad: Test faktura vytvořena ✅

**Signed:** ___________________________ (Date: __/___/___)  
**Name:** ____________________________  
**Role:** QA Team Lead / Project Manager  

**Approval:** ___________________________ (Date: __/___/___)  
**Name:** MEVERIK DevOps  
**Status:** ✅ READY FOR PRODUCTION
```

---

*Dokument: LAUNCH-TESTING-GUIDE.md*  
*Verze: 1.0*  
*Poslední update: 2026-06-22*
