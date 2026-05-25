# 05 · Předávací dokumentace (Handover na Lenku Limpouchovou)

> Postup bezpečného převodu celého ekosystému na klientku po dokončení a schválení. Standard MEVERIK STUDIO 2026. Princip: produkční výseč se předává, know-how MEVERIK zůstává u tebe.

## 1. Co se předává a co zůstává
| Předává se klientce | Zůstává v MEVERIK |
|---------------------|-------------------|
| Repo `bicom-repozit-produkce` (čistý produkční kód) | Soukromý dev repo, experimenty, univerzální knihovny |
| Cloudflare účet/zóna (Pages, D1, R2, Workers, KV) | Vue/Nuxt varianta, FastAPI enginy, AI orchestrace |
| Doména `bicompisek.cz` + DNS | Architektonické know-how, light BIM&CDE koncepce |
| Google Workspace + Business Profil | |

## 2. Handover checklist
- [ ] **Doména a DNS (Cloudflare):** převod správy `bicompisek.cz` do bezplatného osobního CF účtu klientky (WAF, CDN, SSL přejdou automaticky, bez výpadku). Varianta: Member Access jako admin, nebo přímý domain transfer.
- [ ] **Infrastruktura:** převod práv k Pages, D1, Workers, R2, KV do účtu klientky.
- [ ] **Google Workspace:** plná admin práva (Gmail, Kalendář, Business Profil); propojení Calendar API se Service Accountem zachovat.
- [ ] **GitHub:** přidat účet klientky (nebo jejího IT) jako Owner org `BiCOM-PiSEK` s přístupem k produkčnímu repu (historie, dokumentace).
- [ ] **Secrets:** předat bezpečně (správce hesel), zejména `ENCRYPTION_KEY` — jeho ztráta = nečitelná zašifrovaná data.
- [ ] **Zaučení (Virtual Office):** 1-pager — barevné kódy v Google Kalendáři (žlutá=předběžné, zelená=potvrdit→spustí notifikaci) + jak namluvit poznámku do AI Copywritera.

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
- [ ] **`bicompisek.cz`** — koupit (registrátor: WEDOS / přes NIC.cz). Kanonická doména.
- [ ] **`bicom-pisek.cz`** — již vlastněná (viz PDF v `Doména, DNS a Hosting/`) → 301 redirect na kanonickou.
- [ ] Nastavit nameservery na **Cloudflare**, ověřit zónu.
- [ ] SSL/TLS = Full (strict), HSTS, automatické HTTPS.

## 2. Cloudflare (jádro)
- [ ] Účet Cloudflare (zatím tvůj, později převod na Lenku).
- [ ] **Pages** projekt napojený na produkční repo (auto-deploy z `main`).
- [ ] **D1** databáze `bicom-db-prod` → zkopírovat `database_id` do `wrangler.toml`.
- [ ] **R2** bucket `bicom-multimedia`.
- [ ] **KV** namespace (cache/rate-limit) → `id` do `wrangler.toml`.
- [ ] **Workers AI** povolené (Llama 3).
- [ ] **Queues** `booking-jobs`.
- [ ] WAF: DDoS, rate limiting, bot management.

## 3. Secrets (nastavit přes `wrangler secret put NAZEV`)
| Secret | Kde získat | Pozn. |
|--------|-----------|-------|
| `ENCRYPTION_KEY` | vygenerovat 256bit hex (`openssl rand -hex 32`) | uschovat bezpečně! ztráta = nečitelná data |
| `ADMIN_TOKEN` | vygenerovat dlouhý náhodný řetězec | přístup k admin endpointům |
| `GOOGLE_CALENDAR_CLIENT_EMAIL` | Google Cloud Console → Service Account | + sdílet kalendář Lenky s tímto účtem |
| `GOOGLE_CALENDAR_PRIVATE_KEY` | tamtéž (JSON klíč) | |
| `GOOGLE_CALENDAR_ID` | ID kalendáře Lenky | obvykle její e-mail |
| `RESEND_API_KEY` | resend.com | ověřit doménu pro odesílání (SPF/DKIM) |
| `META_GRAPH_ACCESS_TOKEN` | developers.facebook.com | long-lived token, propojit IG business účet |
| `META_IG_USER_ID` | Graph API | |
| `SMS_GATEWAY_API_KEY` | GoSMS.cz / sms.sluzba.cz | dobít kredit |
| `STRIPE_SECRET_KEY` (volitelné) | stripe.com | jen pokud online platby záloh |

## 4. Google Workspace (doporučeno, volitelné ~8 €/měs)
- [ ] Workspace na `bicompisek.cz` (Business tarif).
- [ ] Schránky `info@bicompisek.cz`, `lenka@bicompisek.cz`.
- [ ] Google Cloud projekt + Service Account pro Calendar API (sdílet kalendář se SA e-mailem).

## 5. Sociální a lokální profily (NAP konzistence — znak po znaku stejné)
- [ ] Google Business Profile „Bicom Písek – Lenka Limpouchová".
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

> Dvě věci v jednom: (A) jednoduchý manuál pro provozovatele (Lenka), (B) „klíčenka" = bezpečná evidence všech účtů, přístupů, API klíčů a vlastnictví. **Klíčenka NEOBSAHUJE samotná hesla/klíče** — jen kde žijí a kdo je vlastní. Skutečné tajné hodnoty patří do správce hesel a Cloudflare Secrets, NIKDY do tohoto souboru ani do repa.

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
| bicompisek.cz | (kanonická) | WEDOS (registrátor) / CZ.NIC | WHC s.r.o. → převést na klienta | doplnit |
| bicom-pisek.cz | 301 → kanonická | WEDOS / CZ.NIC | WHC s.r.o. | doplnit |
| DNS zóna | nameservery CF | Cloudflare | účet CF | — |
| CZ.NIC kontakt ID | C0018624831-CZ (WEDOS-B2M-739975) | CZ.NIC | Matej Kocanda / WHC | — |

### B2 · Cloud a infrastruktura
| Služba | Účel | Účet/owner | Kde žijí klíče |
|--------|------|-----------|----------------|
| Cloudflare (Pages, D1, R2, KV, Workers, Secrets) | jádro provozu | CF účet (→ klient) | CF dashboard / Secrets |
| Google Workspace | e-maily, kalendář, disk | bicompisek.cz | Google admin |
| Google Cloud (Service Account, Cloud Run) | Calendar API, heavy | GCP projekt | GCP / Secrets |
| GitHub Org BiCOM-PiSEK | kód | org owner (→ klient) | GitHub |
| Sentry | error log | projekt | Sentry |

### B3 · API klíče a Secrets (jen evidence umístění!)
| Secret (název v CF) | Účel | Poskytovatel | Kde se mění |
|---------------------|------|--------------|-------------|
| ENCRYPTION_KEY | šifrování dat | vlastní hash | CF Secrets (⚠ ztráta = nečitelná data) |
| ADMIN_TOKEN | admin endpointy | vlastní | CF Secrets |
| GOOGLE_CALENDAR_CLIENT_EMAIL / _PRIVATE_KEY | kalendář | Google Cloud | CF Secrets |
| RESEND_API_KEY | e-maily | Resend | CF Secrets |
| META_GRAPH_ACCESS_TOKEN | Instagram sync | Meta | CF Secrets |
| SMS_GATEWAY_API_KEY | SMS | GoSMS | CF Secrets |
| STRIPE_SECRET_KEY (volit.) | platby | Stripe | CF Secrets |

### B4 · Sociální a lokální profily (NAP)
| Profil | URL/ID | Owner | Pozn. |
|--------|--------|-------|-------|
| Google Business Profile | doplnit | klient | NAP shoda |
| Apple Business Connect | doplnit | klient | iOS/Siri |
| Firmy.cz / Mapy.cz | doplnit | klient | Seznam |
| Instagram / Facebook | doplnit | klient | sync zdroj |

### B5 · Podpora a kontakty
| Role | Jméno | Kontakt | Odpovědnost |
|------|-------|---------|-------------|
| Vlastník/provoz | Lenka Limpouchová | doplnit | obsah, potvrzování |
| Technická podpora | MEVERIK / správce | matejkocanda@icloud.com | infrastruktura, incidenty |
| Marketing | (Mikeš) | doplnit | kampaně, profily |

### B6 · Pravidla klíčenky
- Tento soubor = evidence, **ne trezor**. Hesla/klíče jen ve správci hesel + CF Secrets.
- Při předání klientovi se mění vlastnictví účtů (viz `04` a `05`), klíče se rotují.
- `ENCRYPTION_KEY` se zálohuje offline (ztráta = nevratná ztráta čitelnosti zašifrovaných dat).


# 05 · Předání domény (.cz přes WEDOS / CZ.NIC + DNS na Cloudflare)

> Důležité: `.cz` domény **nelze** vést u Cloudflare Registrar. Doména je registrována u **WEDOS** (registrátor) v registru **CZ.NIC**, zatímco **DNS se deleguje na Cloudflare** (nameservery). Předání má proto dvě roviny: (1) registrátorský účet/držitel domény, (2) správa DNS zóny v Cloudflare.

## 1. Současný stav (z evidence)
- Registrátor: **WEDOS** · CZ.NIC kontakt ID: **C0018624831-CZ** (handle WEDOS-B2M-739975)
- Držitel/kontakt: Matej Kocanda, WHC s.r.o., Harantova, Písek 39701
- E-mail registrátora: kocanda.matej@gmail.com · tel.: +420 725574751
- DNS: delegováno na Cloudflare (nameservery CF) — tam běží A/AAAA/CNAME, WAF, SSL.

## 2. Co se předává
| Rovina | Co | Jak |
|--------|----|----|
| Držitel domény | vlastnictví `bicompisek.cz` (+ `bicom-pisek.cz`) | změna držitele v CZ.NIC přes WEDOS |
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
2. Varianta A — **Move zone**: zónu `bicompisek.cz` převést do účtu klienta (CF „Move to another account") → přejdou A/CNAME/MX/TXT, WAF, SSL, bez výpadku.
   Varianta B — **Member access**: pozvat klienta jako administrátora do stávající zóny (rychlejší, vlastnictví zůstává u tebe).
3. Ověřit po převodu: web odpovídá, SSL aktivní (Full strict), 301 z `bicom-pisek.cz` funguje, MX (Workspace) sedí, žádné chyby v DNS.

## 5. Kontrolní checklist předání domény
- [ ] Držitel `bicompisek.cz` = klient (CZ.NIC), auto-renew zapnuto.
- [ ] Držitel `bicom-pisek.cz` = klient, 301 redirect funguje.
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
