# 05 · Předávací dokumentace (Handover) — v1.0 RC FINÁLNÍ

> Postup bezpečného převodu celého ekosystému na klientku po dokončení a schválení.
> Standard MEVERIK STUDIO 2026. Princip: produkční výseč se předává, know-how MEVERIK zůstává u tebe.
>
> **Status:** 🟡 v1.0 preview live. AI Studio wave 1+2 je nasazené (visual pipeline + Studio UI + jobs/retry); čekají produkční klíče (L1/L5/L8/L9), finální training a publish orchestrace.

## 1. Co se předává a co zůstává

| Předává se klientce (BIO ONE LIFE s.r.o.) | Zůstává v MEVERIK STUDIO |
|---|---|
| ✅ Produkční repo `bicom-pisek-produkcni-repozit` (v1.0 RC, 39/41 features) | Soukromý dev repo, experimenty, univerzální knihovny |
| ✅ Cloudflare účet/zóna (Pages, D1, R2, Workers, KV, Queues, AI) | Vue/Nuxt varianta, FastAPI enginy, orchestrační know-how |
| ✅ Doména `bicom-pisek.cz` + DNS | Architektonické rozhodnutí (ADR), design systém |
| ✅ Google Workspace (`admin@bicom-pisek.cz`) + Domain-Wide Delegation | Vyšší-level AI orchestrace, BIM&CDE koncepce |
| ✅ All dokumentace (README, ROADMAP, CMS_GUIDE, HANDOVER) | IP, licensing, business templates |
| ✅ Databáze D1 `bicom-pisek-db` se všemi 23 tabulami (migrace 0001–0023) | — |

## 2. Finální Handover Checklist (priorita)

### ✅ KÓDOVĚ HOTOVO — Není potřeba další dev práce

- [x] Veřejný web (SPA router, 9 sekcí, WCAG AA, hyperresponsivní)
- [x] Rezervační systém (F1-F7: availability → booking → confirm → calendar sync)
- [x] Admin Virtual Office (7 modulů: booking, blog, GEO, invoices, atd.)
- [x] CMS obsahu bez vývoje (F11-F12D: texty, galerie, hero, draft/publish workflow)
- [x] Platby Stripe (checkout session, webhook, payment tracking)
- [x] Fakturace iDoklad (OAuth2, invoice generation, audit log)
- [x] Email/SMS/Telegram notifikace
- [x] Google Calendar Domain-Wide Delegation (<admin@bicom-pisek.cz>)
- [x] D1 migrace (0001-0020, atomické, idempotentní)
- [x] Guardrail právní ochrana (modulární, 4 úrovně)
- [x] AI Copywriter (Llama 3 + fallback Groq/Gemini)
- [x] Bezpečnost (AES-GCM šifrování, audit log, Zero Trust auth)
- [x] Dokumentace kompletní (README, ROADMAP, HANDOVER, CMS_GUIDE, ADR)

### 🟢 ZBÝVÁ: Produkční klíče + Training (L1/L5/L8/L9)

| # | Blocker | Stav | Akce |
|---|---|---|---|
| **L1** | Resend (`info@bicom-pisek.cz`) | 🟢 Připraveno | Ověřit SPF/DKIM v DNS, zaslat test e-mail |
| **L5** | GoSMS (SMS gateway) | 🟢 Připraveno | Dobít kredit, otestovat reminder SMS |
| **L8** | Stripe live secret + webhook | 🟠 Čeká | Vygenerovat live keys, zaslat webhook secret, live test 500 Kč platby |
| **L9** | iDoklad (OAuth2 credentials) | 🟠 Čeká | Vygenerovat OAuth ID/secret, nastavit vystavvatele, test invoice |

### 🟡 ZBÝVÁ: Bicom Visual Studio (AI Studio) — povinné v1.x dorovnání

- [x] Wave 1 start: sjednocený AI provider chain pro `/api/chat` + `/admin/copywriter` (`functions/lib/ai/providers.js`)
- [x] Wave 1 completion: admin Studio flow bez placeholderů pro minimální robustní provozní využití
- [x] Wave 2 completion: jobs console + retry flow (`ai_jobs`, `/admin/imagine?view=jobs`, retry endpoint)
- [ ] Wave 3: publish orchestrace pro schválené assety (social/web pipeline handoff)

---

## 2.1 Předání — Technické kroky

### 🔑 1. Secrets (nastavit v Cloudflare Secrets)

Všechny níže uvedené musí být nastaveny **PŘED** ostrým spuštěním.

| Secret | Kde získat | Poznámka |
|--------|-----------|---------|
| `SECRET_ENCRYPTION_KEY` | `openssl rand -hex 32` | ✅ Již v systému |
| `SECRET_RESEND_API_KEY` | resend.com | 🟠 Produkční klíč |
| `SECRET_SMS_GATEWAY_CLIENT_ID` | GoSMS.cz | 🟠 Produkční credentials |
| `SECRET_SMS_GATEWAY_CLIENT_SECRET` | GoSMS.cz | 🟠 Produkční credentials |
| `SECRET_STRIPE_SECRET_KEY` | stripe.com (live) | 🟠 Live key — PRODUKCE |
| `SECRET_STRIPE_WEBHOOK_SECRET` | stripe.com | 🟠 Webhook secret — PRODUKCE |
| `SECRET_IDOKLAD_CLIENT_ID` | iDoklad | 🟠 OAuth credentials — PRODUKCE |
| `SECRET_IDOKLAD_CLIENT_SECRET` | iDoklad | 🟠 OAuth credentials — PRODUKCE |
| `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL` | Google Cloud Console | ✅ Již nastaven |
| `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | Google Cloud Console | ✅ Již nastaven |
| `SECRET_GOOGLE_CALENDAR_ID` | Lenka (ID jejího kalendáře) | ✅ Již nastaven |
| `SECRET_GOOGLE_WORKSPACE_ADMIN_EMAIL` | `admin@bicom-pisek.cz` | ✅ Již nastaven |
| `SECRET_GROQ_API_KEY` | groq.com | ✅ Fallback AI, již nastaven |
| `SECRET_GEMINI_API_KEY` | Google AI Studio | ✅ Fallback AI, již nastaven |

### 🗂️ 2. Databáze — Vyčištění demo dat

### 2.1 Launch integrace před ostrým spuštěním (L1/L5/L8/L9)

> Cíl: dokončit produkční napojení e-mail/SMS/platby/fakturace bez improvizace.

| Blocker | Co musí být nastaveno | Jak ověřit (akceptace) |
|---|---|---|
| **L1 — Resend** | `SECRET_RESEND_API_KEY`, ověřená doména odesílatele (`info@bicom-pisek.cz`), SPF/DKIM v DNS | Testovací transakční e-mail z flow rezervace přijde do schránky a není ve spamu; v Resend dashboardu stav doručení = delivered. |
| **L5 — GoSMS** | `SECRET_SMS_GATEWAY_CLIENT_ID`, `SECRET_SMS_GATEWAY_CLIENT_SECRET`, volitelně `SMS_GATEWAY_CHANNEL`, aktivní kredit | Test reminder SMS v kontrolovaném scénáři (bez klientských dat) dorazí do 1 zařízení; v GoSMS dashboardu je vidět úspěšné doručení + odečtený kredit. |
| **L8 — Stripe** | `SECRET_STRIPE_SECRET_KEY` (live), `SECRET_STRIPE_WEBHOOK_SECRET` (live), Stripe webhook na `/api/stripe-webhook` | Live test platby 500 Kč: checkout proběhne, webhook projde verifikací, booking přejde z `pending_payment` na `pending`, transakce je v `payment_transactions`. |
| **L9 — iDoklad** | `SECRET_IDOKLAD_CLIENT_ID`, `SECRET_IDOKLAD_CLIENT_SECRET`, nastavený vystavovatel v iDoklad | Po úspěšné Stripe platbě se vytvoří faktura (nebo jde vytvořit přes admin fakturaci), v audit logu je záznam o vystavení. |

**Technická poznámka:** stav připravenosti L1/L5/L8/L9 je dostupný v admin endpointu `GET /admin/dashboard` (`data.launchBlockers` + `data.launchBlockersSummary`).

### 2.2 Google Workspace + Domain-Wide Delegation (<admin@bicom-pisek.cz>)

> Cíl: zajistit, že kalendářové operace systému běží bezpečně pod správným účtem a jsou předatelné bez ztráty provozu.

**Konfigurační minimum (musí být splněno):**

1. Google Workspace admin účet: `admin@bicom-pisek.cz`
2. Service Account v Google Cloud s povoleným **Domain-Wide Delegation**
3. V Admin Console (Workspace) autorizovaný OAuth scope pro SA:
   - `https://www.googleapis.com/auth/calendar`
4. V Cloudflare secrets:
   - `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL`
   - `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY`
   - `SECRET_GOOGLE_CALENDAR_ID`
   - `SECRET_GOOGLE_WORKSPACE_ADMIN_EMAIL=admin@bicom-pisek.cz`

**Akceptační test po předání:**

- [ ] Vytvoření nové rezervace vytvoří událost v kalendáři `admin@bicom-pisek.cz`.
- [ ] Potvrzení/přesun/zrušení rezervace z admin konzole provede odpovídající změnu v Google Calendar.
- [ ] V audit logu je dohledatelná vazba mezi booking akcí a kalendářovou změnou.
- [ ] Při dočasném výpadku Google API se rezervace neztratí (queue retry + provozní log).

**Evidence do klíčenky (bez tajných hodnot):**

- ID Google Cloud projektu
- e-mail Service Accountu
- datum poslední rotace SA klíče
- kdo je Workspace super-admin owner
- kde je uložen JSON klíč (trezor + odpovědná osoba)

## 3. Provozní „playbook" pro Lenku (bez technické bariéry)

**A. AI Copywriter (hlas → článek):** otevři diktafon → namluv krátkou poznámku (bez jména klienta) → přepis klávesnicí → vlož do administrace → „Generovat" → „Zveřejnit". Hotovo, článek je online v tónu Quiet Luxury.
**B. Rezervace v Kalendáři:** nová poptávka = světle žlutá událost. Změníš barvu na zelenou (potvrzeno) → systém automaticky pošle klientovi potvrzení + naplánuje SMS upomínku 24 h předem.
**C. Blog z Instagramu:** stačí přidat příspěvek na profesní IG/FB — web se sám doplní do 24 h.

## 4. Po předání (provoz)

- Náklady: hosting/DB 0 Kč, doména ~200 Kč/rok, volitelně Workspace ~8 €/měs.
- Monitoring: Cloudflare Analytics + Sentry (přístupy předány).
- Údržba: minimální — „živá DB" se plní a čistí sama (viz `01_ARCHITEKTURA/02`).
- Podpora MEVERIK: dle dohody (SLA / hodinová sazba) — definovat při předání.

## 5. Dokumenty přibalené k předání

- `README.md`, `WHITE_PAPER.md`, `GITHUB_SETUP_AND_PLANNING.md` v repu.
- Tento balík `MEVERIK_vyvojovy_balik/` (nebo jeho produkčně relevantní výseč).
- Vzor souhlasu (po revizi advokátem) + zásady zpracování (`gdpr.html`).

# 05 · Co zajistit — účty, API, klíče, domény (checklist orchestrátora)

> Vše, co je třeba zřídit/mít, než agenti začnou a než web pojede ostře. Klíče se NIKDY nedávají do repa — jen do CF Secrets / `.dev.vars`.

## 1. Domény a DNS

- [ ] **`bicom-pisek.cz`** — již vlastněná (viz PDF v `Doména, DNS a Hosting/`) → kanonická doména.
- [ ] **`bicompisek.cz`** — koupit (registrátor: WEDOS / přes NIC.cz) → 301 redirect na kanonickou.
- [ ] Nastavit nameservery na **Cloudflare**, ověřit zónu.
- [ ] SSL/TLS = Full (strict), HSTS, automatické HTTPS.

## 2. Cloudflare (jádro)

- [ ] Účet Cloudflare (zatím tvůj, později převod na Lenku).
- [ ] **Pages** projekt napojený na produkční repo (auto-deploy z `main`).
- [ ] **D1** databáze `bicom-pisek-db` → zkopírovat `database_id` do `wrangler.toml`.
- [ ] **R2** bucket `bicom-multimedia`.
- [ ] **KV** namespace (cache/rate-limit) → `id` do `wrangler.toml`.
- [ ] **Workers AI** povolené (Llama 3).
- [ ] **Queues** `booking-jobs`.
- [ ] WAF: DDoS, rate limiting, bot management.

## 3. Secrets (nastavit přes `wrangler secret put NAZEV`)

| Secret | Kde získat | Pozn. |
|--------|-----------|-------|
| `SECRET_ENCRYPTION_KEY` | vygenerovat 256bit hex (`openssl rand -hex 32`) | uschovat bezpečně! ztráta = nečitelná data |
| `SECRET_ADMIN_TOKEN` | vygenerovat dlouhý náhodný řetězec | přístup k admin endpointům |
| `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL` | Google Cloud Console → Service Account | + sdílet kalendář Lenky s tímto účtem |
| `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | tamtéž (JSON klíč) | |
| `SECRET_GOOGLE_CALENDAR_ID` | ID kalendáře Lenky | obvykle její e-mail |
| `SECRET_RESEND_API_KEY` | resend.com | ověřit doménu pro odesílání (SPF/DKIM) |
| `SECRET_META_GRAPH_ACCESS_TOKEN` | developers.facebook.com | long-lived token, propojit IG business účet |
| `SECRET_META_IG_USER_ID` | Graph API | |
| `SECRET_SMS_GATEWAY_CLIENT_ID` | GoSMS.cz | OAuth client ID pro SMS bránu |
| `SECRET_SMS_GATEWAY_CLIENT_SECRET` | GoSMS.cz | OAuth client secret pro SMS bránu |
| `SMS_GATEWAY_CHANNEL` (variable) | GoSMS.cz | volitelný channel ID |
| `SECRET_STRIPE_SECRET_KEY` | stripe.com | live secret key pro checkout |
| `SECRET_STRIPE_WEBHOOK_SECRET` | stripe.com | signing secret pro `/api/stripe-webhook` |
| `SECRET_IDOKLAD_CLIENT_ID` | iDoklad | OAuth client ID |
| `SECRET_IDOKLAD_CLIENT_SECRET` | iDoklad | OAuth client secret |
| `SECRET_GROQ_API_KEY` | groq.com | API pro záložní kognitivní Llama model |
| `SECRET_GEMINI_API_KEY` | Google AI Studio | API pro záložní kognitivní Gemini model |

## 4. Google Workspace (doporučeno, volitelné ~8 €/měs)

- [ ] Workspace na `bicom-pisek.cz` (Business tarif).
- [ ] Schránky `info@bicom-pisek.cz`, `admin@bicom-pisek.cz`.
- [ ] Google Cloud projekt + Service Account pro Calendar API (sdílet kalendář se SA e-mailem).

## 5. Sociální a lokální profily (NAP konzistence — znak po znaku stejné)

- [ ] Google Business Profile „Bicom Písek".
- [ ] Apple Business Connect.
- [ ] Firmy.cz / Mapy.cz (Seznam).
- [ ] Bing Places.
- [ ] Instagram + Facebook business (propojené pro Meta Graph sync).

## 6. Analytika a monitoring

- [ ] Google Analytics 4 + Google Tag Manager (spouštět až po cookie souhlasu).
- [ ] Meta Pixel (přes GTM, po souhlasu).
- [ ] Sentry projekt (error log).
- [ ] Cloudflare Web Analytics.

## 7. Vývoj / DevOps

- [ ] GitHub Organizace `BiCOM-PiSEK` + produkční repo + tvůj soukromý dev repo.
- [ ] GitHub → Cloudflare API token (do repo Secrets pro Actions).
- [ ] Antigravity / VS Code s agenty (Gemini, Claude, Copilot) napojené na repo.

## 8. Právní / obsahové podklady (od Lenky)

- [ ] IČO, přesná adresa ordinace, telefon (do NAP, JSON-LD, souhlasu).
- [ ] Certifikáty přístroje Bicom Optima (sken → R2 `certificates/`).
- [ ] Ceník služeb (transparentní) + typický počet sezení.
- [ ] Souhlas se zpracováním zdrav. údajů — **revize advokátem** (viz dok. 03).
- [ ] Foto ordinace + portrét Lenky (nebo zadání pro Nano Banana).

## 9. Odhad nákladů (z iniciační dokumentace)

- Hosting/DB (Cloudflare): **0 Kč** (Edge-First, zero-cost model).
- Doména: ~200 Kč/rok.
- Google Workspace: ~8 €/měs (volitelné).
- SMS brána: dle kreditu.
- Resend: free tier obvykle stačí na začátek.

# 05 · Provozní manuál + „Klíčenka" (evidence přístupů)

> Dvě věci v jednom: (A) jednoduchý manuál pro provozovatele, (B) „klíčenka" = bezpečná evidence všech účtů, přístupů, API klíčů a vlastnictví. **Klíčenka NEOBSAHUJE samotná hesla/klíče** — jen kde žijí a kdo je vlastní. Skutečné tajné hodnoty patří do správce hesel a Cloudflare Secrets, NIKDY do tohoto souboru ani do repa.

---

## ČÁST A — Provozní manuál pro provozovatele (1 strana)

### Co web dělá sám (bez tvého zásahu)

- Přijímá poptávky 24/7 → zapíše je tobě do Google Kalendáře jako **žlutou** (předběžnou) událost.
- Z tvého Instagramu/Facebooku každých 24 h vytvoří článek v sekci Magazín.
- Hlídá databázi a posílá klientům přípravné e-maily a SMS upomínku 24 h předem.

### Co děláš ty (3 jednoduché věci, vše z mobilu)

1. **Potvrdit termín:** v Google Kalendáři změň barvu události na **zelenou** → systém sám pošle klientovi potvrzení + naplánuje SMS.
2. **Napsat článek hlasem:** diktafon → namluv poznámku (bez jména klienta) → přepis klávesnicí → vlož do administrace → „Generovat" → „Zveřejnit".
3. **Přidat fotku:** stačí na tvůj profesní Instagram — web se doplní sám.

### Když něco nefunguje (eskalace)

- Drobnost (text, fotka) → zkus znovu / kontaktuj správce.
- Web nejede / chyba rezervace → kontakt na technickou podporu (MEVERIK / určený správce), viz Klíčenka, řádek „Podpora".

### Barevné kódy v kalendáři

| Barva | Význam | Akce systému |
|-------|--------|--------------|
| Žlutá | předběžná poptávka | čeká na tebe |
| Zelená | potvrzeno | pošle potvrzení + SMS |
| Šedá | dokončeno / zrušeno | žádná |

---

## ČÁST B — Klíčenka (Credentials & Ownership Register) — ŠABLONA

> Vyplňuje orchestrátor. Hesla/klíče = jen v správci hesel (např. 1Password/Bitwarden) a v Cloudflare Secrets. Zde je pouze evidence „co, kde, kdo vlastní, jak se to mění".

### B1 · Domény

| Položka | Hodnota | Registrátor / správa | Vlastník účtu | Expirace |
|---------|---------|----------------------|---------------|----------|
| bicom-pisek.cz | (kanonická) | WEDOS (registrátor) / CZ.NIC | BIO ONE LIFE s.r.o. | při předání potvrdit |
| bicompisek.cz | 301 → kanonická | WEDOS / CZ.NIC | BIO ONE LIFE s.r.o. | při předání potvrdit |
| DNS zóna | nameservery CF | Cloudflare | účet CF | — |
| CZ.NIC kontakt ID | C0018624831-CZ (WEDOS-B2M-739975) | CZ.NIC | Matej Kocanda / WHC | — |

### B2 · Cloud a infrastruktura

| Služba | Účel | Účet/owner | Kde žijí klíče |
|--------|------|-----------|----------------|
| Cloudflare (Pages, D1, R2, KV, Workers, Secrets) | jádro provozu | CF účet (→ klient) | CF dashboard / Secrets |
| Google Workspace | e-maily, kalendář, disk | bicom-pisek.cz | Google admin |
| Google Cloud (Service Account, Cloud Run) | Calendar API, heavy | GCP projekt | GCP / Secrets |
| GitHub Org BiCOM-PiSEK | kód | org owner (→ klient) | GitHub |
| Sentry | error log | projekt | Sentry |

### B3 · API klíče a Secrets (jen evidence umístění!)

| Secret (název v CF) | Účel | Poskytovatel | Kde se mění |
|---------------------|------|--------------|-------------|
| SECRET_ENCRYPTION_KEY | šifrování dat | vlastní hash | CF Secrets (⚠ ztráta = nečitelná data) |
| SECRET_ADMIN_TOKEN | admin endpointy | vlastní | CF Secrets |
| `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL` / `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | kalendář | Google Cloud | CF Secrets |
| `SECRET_GOOGLE_CALENDAR_ID` / `SECRET_GOOGLE_CALENDAR_IMPERSONATE` | kalendář (ID + DWD impersonace) | Google Cloud / Workspace | CF Secrets |
| `SECRET_GOOGLE_WORKSPACE_ADMIN_EMAIL` | admin kontakt Workspace | Google Workspace | CF Secrets |
| `SECRET_RESEND_API_KEY` | e-maily | Resend | CF Secrets |
| `SECRET_META_GRAPH_ACCESS_TOKEN` | Instagram sync | Meta | CF Secrets |
| `SECRET_META_IG_USER_ID` | Instagram účet ID | Meta | CF Secrets |
| `SECRET_SMS_GATEWAY_CLIENT_ID` / `SECRET_SMS_GATEWAY_CLIENT_SECRET` | SMS | GoSMS | CF Secrets |
| `SMS_GATEWAY_CHANNEL` (variable) | SMS channel | GoSMS | CF Variables |
| `SECRET_STRIPE_SECRET_KEY` / `SECRET_STRIPE_WEBHOOK_SECRET` | platby | Stripe | CF Secrets |
| `SECRET_IDOKLAD_CLIENT_ID` / `SECRET_IDOKLAD_CLIENT_SECRET` | fakturace | iDoklad | CF Secrets |
| `SECRET_CALENDAR_WEBHOOK_SECRET` | validace calendar webhooku | vlastní | CF Secrets |
| SECRET_GROQ_API_KEY | záložní LLM | Groq | CF Secrets |
| SECRET_GEMINI_API_KEY | záložní LLM | Google AI | CF Secrets |

### B4 · Sociální a lokální profily (NAP)

| Profil | URL/ID | Owner | Pozn. |
|--------|--------|-------|-------|
| Google Business Profile | vyplnit při předání | klient | NAP shoda |
| Apple Business Connect | vyplnit při předání | klient | iOS/Siri |
| Firmy.cz / Mapy.cz | vyplnit při předání | klient | Seznam |
| Instagram / Facebook | vyplnit při předání | klient | sync zdroj |

### B5 · Podpora a kontakty

| Role | Jméno | Kontakt | Odpovědnost |
|------|-------|---------|-------------|
| Vlastník/provoz | BIO ONE LIFE s.r.o. | <admin@bicom-pisek.cz> | obsah, potvrzování |
| Technická podpora | MEVERIK / správce | <matejkocanda@icloud.com> | infrastruktura, incidenty |
| Marketing | interní/externí marketing dle dohody | určit při předání | kampaně, profily |

### B6 · Pravidla klíčenky

- Tento soubor = evidence, **ne trezor**. Hesla/klíče jen ve správci hesel + CF Secrets.
- Při předání klientovi se mění vlastnictví účtů (viz `04` a `05`), klíče se rotují.
- `ENCRYPTION_KEY` se zálohuje offline (ztráta = nevratná ztráta čitelnosti zašifrovaných dat).

# 05 · Předání domény (.cz přes WEDOS / CZ.NIC + DNS na Cloudflare)

> Důležité: `.cz` domény **nelze** vést u Cloudflare Registrar. Doména je registrována u **WEDOS** (registrátor) v registru **CZ.NIC**, zatímco **DNS se deleguje na Cloudflare** (nameservery). Předání má proto dvě roviny: (1) registrátorský účet/držitel domény, (2) správa DNS zóny v Cloudflare.

## 1. Současný stav (z evidence)

- Registrátor: **WEDOS** · CZ.NIC kontakt ID: **C0018624831-CZ** (handle WEDOS-B2M-739975)
- Držitel/kontakt: Matej Kocanda, WHC s.r.o., Harantova, Písek 39701
- E-mail registrátora: <kocanda.matej@gmail.com> · tel.: +420 725574751
- DNS: delegováno na Cloudflare (nameservery CF) — tam běží A/AAAA/CNAME, WAF, SSL.

## 2. Co se předává

| Rovina | Co | Jak |
|--------|----|----|
| Držitel domény | vlastnictví `bicom-pisek.cz` (+ `bicompisek.cz`) | změna držitele v CZ.NIC přes WEDOS |
| DNS zóna | A/CNAME/MX/TXT, WAF, SSL | převod CF zóny do účtu klienta |
| E-maily | MX + Google Workspace | předání Workspace adminu |

## 3. Postup — doména (WEDOS / CZ.NIC)

1. Klient si zřídí (nebo má) **účet u WEDOS** a vlastní **CZ.NIC kontakt (handle)**.
2. V administraci WEDOS provést **změnu držitele** domény na klienta (nebo na WHC, pokud zůstává správcem dle dohody) — CZ.NIC vyžaduje souhlas obou kontaktů.
3. Ověřit e-mail a fakturační údaje; nastavit **auto-prodloužení**, aby doména nevypršela.
4. Předat přístup k WEDOS účtu nebo provést transfer domény pod účet klienta (autorizační kód, pokud se mění registrátor).
5. Zkontrolovat, že **nameservery zůstávají na Cloudflare** (jinak by se rozbil web/DNS).

## 4. Postup — DNS zóna (Cloudflare)

1. Klient si zřídí **bezplatný Cloudflare účet**.
2. Varianta A — **Move zone**: zónu `bicom-pisek.cz` (a případně `bicompisek.cz`) převést do účtu klienta (CF „Move to another account") → přejdou A/CNAME/MX/TXT, WAF, SSL, bez výpadku.
   Varianta B — **Member access**: pozvat klienta jako administrátora do stávající zóny (rychlejší, vlastnictví zůstává u tebe).
3. Ověřit po převodu: web odpovídá, SSL aktivní (Full strict), 301 z `bicom-pisek.cz` funguje, MX (Workspace) sedí, žádné chyby v DNS.

## 5. Kontrolní checklist předání domény

- [ ] Držitel `bicom-pisek.cz` = klient (CZ.NIC), auto-renew zapnuto.
- [ ] Držitel `bicompisek.cz` = klient, 301 redirect funguje.
- [ ] Nameservery na Cloudflare, zóna v účtu klienta (nebo member access).
- [ ] SSL/TLS Full (strict), HSTS, automatické HTTPS.
- [ ] MX/SPF/DKIM/DMARC pro Workspace ověřeny (e-maily chodí).
- [ ] Přístupové údaje WEDOS i CF v klíčence + správci hesel klienta.
- [ ] Stará správa (WHC) odebrána po ověření, pokud se předává úplně.

## 6. Rizika a pozor

- **Nevypnout nameservery CF** během převodu držitele — jinak výpadek webu.
- CZ.NIC změna držitele vyžaduje **souhlas obou stran** (e-mail potvrzení) — počítat s 1–5 dny.
- Nepřevádět doménu na Cloudflare Registrar (nepodporuje `.cz`).

# 05 · Předání GitHub repozitáře a organizace

> Princip: produkční repo se předává, soukromé know-how MEVERIK zůstává. Organizace `BiCOM-PiSEK` slouží jako čistý produkční prostor; tvůj soukromý dev repo zůstává mimo.

## 1. Struktura (připomenutí)

```
GitHub Org: BiCOM-PiSEK
├── bicom-repozit-produkce   → předatelný klientovi (čistý produkční kód + docs)
│        └── napojen na Cloudflare Pages (auto-deploy z main)
└── (mimo org) meverik-bicom-dev  → SOUKROMÝ (tvé know-how, experimenty)
```

## 2. Co se předává

- Repozitář `bicom-repozit-produkce`: kód, historie, větve, dokumentace (`docs/`), `agent_journal.md`.
- Vlastnictví organizace `BiCOM-PiSEK` (nebo přenos repa pod účet klienta).
- Napojení na Cloudflare Pages (build/deploy).

## 3. Postup předání

1. Klient (nebo jeho IT) si zřídí **GitHub účet**.
2. **Varianta A — Org owner:** pozvat účet klienta do `BiCOM-PiSEK` s rolí **Owner**.
   **Varianta B — Transfer repa:** přenést `bicom-repozit-produkce` pod účet/organizaci klienta (Settings → Transfer ownership).
3. Přenést **GitHub Actions Secrets** (Cloudflare API token apod.) do nového vlastnictví — nebo je nechat klienta vygenerovat znovu (bezpečnější = rotace).
4. Ověřit, že **CI/CD deploy** stále funguje (push do `main` → Cloudflare Pages deploy).
5. Předat přístup, projít s klientem/IT branch protection a workflow.

## 4. Nastavení před předáním (hygiena repa)

- [ ] V repu **žádné Secrets** (projít historii; pokud unikly, rotovat klíče).
- [ ] `.gitignore` obsahuje `.dev.vars`, `node_modules`, `.wrangler`.
- [ ] `main` chráněná větev (PR + review), zelené QA (lint, test, Lighthouse).
- [ ] `README.md`, `WHITE_PAPER.md`, `GITHUB_SETUP_AND_PLANNING.md`, `docs/` aktuální.
- [ ] `agent_journal.md` kompletní (historie změn agentů).
- [ ] Tagy verzí (v1.0 …) a changelog.

## 5. Checklist předání GitHubu

- [ ] Klient = Owner org / repa.
- [ ] CI/CD deploy ověřen po převodu.
- [ ] Actions Secrets přeneseny nebo rotovány.
- [ ] Soukromý dev repo zůstává u MEVERIK (oddělen).
- [ ] Přístupy v klíčence (`05_HANDOVER/03`).

## 6. Po předání

- Dle dohody: MEVERIK ponechán jako collaborator pro podporu (SLA), nebo plně odpojen.
- Doporučení: ponechat read přístup pro případnou údržbu, definovat v servisní smlouvě.

---

## 7. Release / Deploy / Rollback strategie (provozní minimum)

### Release gate (co musí být green před merge do `main`)

- [ ] Cloudflare Pages build = pass
- [ ] CodeRabbit/Copilot review = bez otevřeného blockeru
- [ ] Kritické endpointy nehlásí regresi (`/api/book`, `/api/stripe-checkout`, `/api/stripe-webhook`, `/admin/dashboard`)
- [ ] Handover-impact změny jsou zapsané v `WORK-DIARY.md` + relevantních docs

### Deploy postup (standard)

1. PR squash merge do `main`
2. Vyčkat na Pages deploy success
3. Ověřit branch preview/prod smoke-check:
   - booking create (free flow)
   - booking create (stripe flow, pokud aktivní)
   - admin login + dashboard load
4. Zapsat release poznámku (co se měnilo / kdo schválil)

### Rollback postup (když release selže)

1. Vytvořit revert PR na poslední problémový commit (nepřepisovat historii `main`)
2. Prioritně obnovit kritické toky:
   - rezervace API
   - admin přístup
   - webhook processing
3. Po revert deployi znovu provést smoke-check kritických toků
4. Incident poznamenat do deníku (root cause + preventivní opatření)
