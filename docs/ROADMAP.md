# 🧭 ROADMAP — Bicom Písek (kompas projektu)

> **Jediný zdroj pravdy o STAVU projektu.** Agreguje a odkazuje — neduplikuje.
> Architektonická rozhodnutí → `docs/adr/`. Chronologie → `docs/agent-tasks/WORK-DIARY.md`.
> Příležitosti → `docs/GAP_ANALYSIS_OPPORTUNITIES.md`. Předání → `docs/HANDOVER.md`.
> Platby → `docs/STRIPE_INTEGRATION.md`.
>
> **Verze aplikace:** v1.0 RC — aktivní finalizace před předáním
> **Dokument vytvořen:** 2026-06-13 · **Poslední aktualizace:** 2026-06-13
> **Aktualizovat:** na konci každého dokončeného bloku/fáze.
>
> ⚠️ **Poznámka o úplnosti:** Tento kompas vznikl agregací stavu z deníku, ADR,
> GAP analýzy a dalších dokumentů k uvedenému datu. Projekt má za sebou desítky
> bloků práce napříč více týdny — je možné, že některé dílčí úkoly nebo poznámky
> nebyly zachyceny nebo nám proklouzly. Pokud něco chybí, doplň to při nejbližší
> aktualizaci. Tento dokument je živý, ne definitivní inventář.

---

## Legenda
- ✅ **HOTOVO** — dokončeno a ověřeno (ideálně na produkci)
- 🟡 **PROBÍHÁ** — rozpracováno, aktivní blok
- 🟢 **ČEKÁ** — naplánováno, zatím nezahájeno
- 🔴 **LAUNCH-BLOCKER** — musí být hotové před ostrým spuštěním
- Priorita: 🔴 kritická · 🟠 důležitá · 🟢 nice-to-have

---

## ✅ HOTOVO

### Základ a infrastruktura
- Cloudflare-first architektura (Pages + Workers + D1 + R2 + KV + Queues + Workers AI) — viz [ADR-001](adr/ADR-001-cloudflare-first.md)
- D1 `bicom-pisek-db` — kanonické schéma, migrace 0001–0012, single source of truth (`db/schema.sql`)
- Git workflow fork↔upstream, auto-deploy z `main` na CF Pages — viz [GIT_WORKFLOW](GIT_WORKFLOW.md)
- Izolace tajemství: žádné secrets v repu, vše v CF Secrets / `.dev.vars`, `backups/` v `.gitignore`
- Bezpečnostní audit S0 + fix 403 zacyklení (Zero Trust dev-fallback)
- Repozitářová hygiena (odstranění mrtvého kódu a testovacích souborů)

### Veřejný web
- Veřejný portál „Quiet Luxury" — SPA router, 9 sekcí, View Transitions, WCAG AA
- Interaktivní průvodce službami (`/api/services`)
- GDPR cookie consent + disclaimery
- SEO/AEO základ: `llms.txt`, `robots.txt` (AI crawlery), generovaná `sitemap.xml`
- Sjednocení NAP (telefon + adresa Vladislavova 201 napříč schématy a landingy)

### Data, GDPR, bezpečnost
- Field-level šifrování citlivých polí (AES-GCM 256, čl. 9 GDPR)
- **GDPR anonymizace** (SEC-6) — oprava constraintů, NULL→'' guard, **živě otestováno na produkci** ⟶ *(dříve GAP A3, vyřešeno)*
- Audit log u citlivých zápisů
- Záloha D1 (export do `backups/`, manuálně i cron) ⟶ *(dříve GAP A2, řešeno)*
- Demo/testovací data odstraněna z produkce ⟶ *(dříve GAP C2, vyřešeno)*

### Rezervační systém (ADR-004)
- Kompletní rezervační tok ověřený naživo: D1 + šifrování + **Google Calendar** + e-mail (Resend) + Telegram + reminder + GEO lead + admin potvrzení
- **Google Calendar přes Domain-Wide Delegation** — impersonace `admin@bicom-pisek.cz`, událost ověřena přímo v kalendáři
- Oprava e-mailu (termín místo „undefined"), Telegramu (datum), potvrzení rezervace (405/ID)
- **F1 — datový základ** na produkci: tabulky `availability_rules`, `availability_exceptions`, `booking_settings` + sloupce `slot_start/end` (migrace 0012) — viz [ADR-004](adr/ADR-004-rezervacni-system.md)
- **F2 — backend `GET /api/availability`** (generátor volných slotů z pravidel — obsazené z `bookings.slot_start` se status filtrem: pending/confirmed/pending_payment) s rigorózní validací, formatem "HH:MM", guard (duration + gap > 0), audit log (PR #47 merged) — hotové/zrušené sloty se automauticky uvolňují
- **F3 — admin UI: otevírací doba + parametry slotů** (7 dní, toggle otevřeno/zavřeno, booking_settings, potvrzení/záloha) s klientskou validací, toast notifikace, demo režim (PR #48 merged)
- **F4 — admin UI: výjimky a svátky** (holiday/vacation/adhoc/extra) s typem, datem, volitelným časem, poznámkou (PR #50 merged)
- **F5 — frontend: výběr konkrétního času** v rezervačním formuláři: načíst `/api/availability`, render chip sloty, validace (F5+F6 pár) (PR #51 merged)

### Admin „Virtual Office"
- Admin SPA (design systém, router, 7 modulů, CF Access JWT auth)
- Admin API (dashboard, bookings, geo, copywriter, invoices, settings)
- Oprava `api.js` wrapperu, Přehledu, health, /admin/me, logout
- Blog management: generovat → upravit → publikovat → plánovat → archivovat (migrace 0011)
- Správa rezervací (ADR-005): Potvrdit/Přesunout/Zrušit/Smazat/Detail/no_show jsou funkční; BUG-001 (`audit_log.action`) opraven v PR #63
- **no_show „klient nedorazil"** — tlačítko/badge/filtr v konzoli, `no_show_flag` (migrace 0015, ADR-005 varianta b)
- **GEO-Marketing modul** — odstraněna demo/mock data i falešná „AI doporučení"; jen reálná data z `geo_leads` + poctivé prázdné stavy + pravidlové postřehy (skutečná AI doporučení → AI Studio ADR-003)

### Platby — Stripe (mechanika hotová) — viz [STRIPE_INTEGRATION](STRIPE_INTEGRATION.md)
- Endpointy `/api/stripe-checkout` (Checkout Session, záloha 500 Kč) + `/api/stripe-webhook` (potvrzení platby, ověření podpisu)
- DB: `stripe_session_id`, `stripe_payment_status`, `paid_amount`, `paid_at`, stav `pending_payment`, tabulka `payment_transactions`
- **Flexibilní toggle `stripe_deposit_required`** v adminu + veřejný `/api/booking-config` — klient směrován buď na Stripe Checkout, nebo na bezplatný `/api/book` (volba majitelek)
- Admin modul „Online Platby (Stripe)" — KPI tržeb + napojení na iDoklad fakturaci
- Podpora Apple Pay / Google Pay přes Stripe Checkout

### Fakturace — iDoklad (mechanika hotová)
- Konektor `idoklad.js` — OAuth2 (client_credentials), token cache v KV, vystavení faktury (vč. IČO klienta), čtení faktur, statistiky
- Admin modul „Fakturace" + endpoint `/admin/invoices` (graceful fallback: bez klíčů prázdno s poznámkou, ne mock)
- Automatický fakturační most: Stripe platba → dešifrování údajů → zálohová faktura v iDokladu

### Komunikační kanály — volba klientem (základ hotový)
- Rezervační formulář: výběr `reminder_channel` (e-mail / SMS / WhatsApp)
- **E-mail upomínky** (Resend) + **SMS upomínky** (GoSMS) — funkční, T-24h cron
- Admin Nastavení: toggly SMS / e-mail upomínek + předstih (hodiny)
- Telegram notifikace majitelkám (nové poptávky, digest, cashflow)

### AI a obsah
- AI Copywriter (hlas→článek, Llama 3, trojitý fallback)
- **Právní guardrail** — preventivní modulární vrstva `rules-health` se 4 úrovněmi přísnosti — viz [ADR-002](adr/ADR-002-guardrail-modularni-vrstva.md)
- Strukturované delší články, oddělovačový formát, bezpečný markdown renderer
- Chatbot „AI Rádce" — výměna deprecated modelu

---

## 🟡 PROBÍHÁ

| Co | Stav | Odkaz |
|---|---|---|
| **Rezervační systém F6–F7** | Kódově dokončeno + hardening; průběšné provozní ověřování | [ADR-004](adr/ADR-004-rezervacni-system.md) |
| Admin konzole — booking akce + handover režim | průběžně | WORK-DIARY |
| Produkční integrace a launch readiness | Stripe/Resend/GoSMS/iDoklad/Turnstile | HANDOVER + launch blokery |
| **🆕 CMS — Editace obsahu bez deploymentu (F11)** | ✅ Hotovo a nasazeno (PR #72, migrace 0016 na produkci) | [CMS_GUIDE.md](CMS_GUIDE.md) · [CMS-FEATURE-SPEC.md](agent-tasks/CMS-FEATURE-SPEC.md) |
| **🆕 CMS rozšíření — draft/publish + náhled (F12)** | F1 (jádro: koncept→publikovat, náhled, homepage texty, footer/NAP) — migrace 0017 na produkci; F2/F3 následují | [CMS_GUIDE.md](CMS_GUIDE.md) |

---

## 🟠 ZNÁMÉ OTEVŘENÉ BODY / BUGY

> BUG-001 (`audit_log.action` pro `cancel` / `reschedule`) byl uzavřen opravou v PR #63.

| ID | Oblast | Stav | Poznámka |
|---|---|---|---|
| **OPS-001** | Handover / identita provozovatele | otevřeno | Dopsat BIO ONE LIFE s.r.o. a přenos vlastnictví účtů/secrets do finální dokumentace. |

---

## 🟢 ČEKÁ (naplánováno)

### ⭐ CMS — Operátoři editují obsah bez vývoje (F11 — HANDOVER BLOCKER) — KÓDOVĚ HOTOVO

**Návod + technická část:** [docs/CMS_GUIDE.md](CMS_GUIDE.md) · spec: [CMS-FEATURE-SPEC.md](agent-tasks/CMS-FEATURE-SPEC.md)

> ⚠️ **Pozn. k realizaci:** Spec/examples v `agent-tasks/` byly psané pro jiný stack
> (Module Workers + Vue + Node). Implementace byla **přizpůsobena skutečné architektuře**:
> Cloudflare Pages Functions (`onRequest*`), vanilla ES6 admin modul, bindingy `DB`/`MEDIA`/`CACHE`,
> migrace **0016** (ne 0013 — kolidovala s booking migracemi). Texty využívají existující
> `content_blocks`, audit existující `audit_log`; nově jen `gallery_items` + `hero_config`.

- ✅ D1 tabulky: `gallery_items`, `hero_config` (migrace 0016) + reuse `content_blocks`/`audit_log`
- ✅ API: admin CRUD (`/admin/content`, `/admin/gallery`, `/admin/hero`) + veřejné cache (`/api/content|gallery|hero`) + servírování médií (`/api/media/*` z R2)
- ✅ Admin UI „Obsah webu“ (vanilla modul, 4 záložky: texty, galerie+upload+reorder, hero, historie)
- ✅ Web dynamicky renderuje obsah z API (progressive enhancement, fallback na hardcoded; napojena homepage galerie)
- ✅ Audit trail — operátorka vidí kdo a kdy co změnil
- 🟢 **Zbývá:** spustit migraci 0016 na produkci + provozní ověření uploadu na produkci
- **Priorita:** 🔴 KRITICKÁ (bez toho nemohou operátoři spravovat web)
- **Závislosti:** JWT (✅), R2 binding `MEDIA` (✅), admin SPA (✅)

### Rezervační systém — zbývající fáze (ADR-004, architektura = Cesta 2: sloty za běhu)

- **F6** — `POST /api/book` v2: kolizní zámek (UNIQUE na `slot_start`), konfigurovatelný tok (potvrzení/závaznost/záloha), přesný čas do kalendáře i e-mailu/SMS
- **F7** — doladění: KV cache slotů, DST/časové pásmo, QA

### GEO / AEO / SEO (z GAP analýzy)
- 🟠 **B1** lokální landing stránky (mapa hotová, největší růst trafiku) — *dávkovat po stránkách*
- 🟠 **B2** FAQ blok + `FAQPage` JSON-LD
- 🟠 **B3** E-E-A-T autor (`Person` JSON-LD, profil terapeuta)
- 🟠 **B4** `Service`/`Offer` JSON-LD z tabulky `services` (pole `jsonld` zatím prázdné)
- 🟠 **B7** recenze / `Review` (právně bezpečně, sběr přes Google Business)
- 🟠 **B8** Seznam.cz / Firmy.cz (CZ trh, NAP)
- 🟢 **B5** obsahový motor (1–2 články/měsíc přes copywriter)
- 🟢 **B6** newsletter welcome sekvence (Resend)
- 🟢 **B9** aktivace Instagram→blog sync (tok C)

### JSON-LD úklid (právní soulad)
- 🟠 Vyhodit typ `MedicalBusiness` (biorezonance NENÍ zdravotní služba)
- 🟠 Doložit/ověřit tvrzení o třídě ZP IIa + ISO 13485 (doklad od distributora Bicom)

### AI Studio (ADR-003)
- 🟢 Sjednocená AI vrstva se skills architekturou (F1–F5)
- 🟢 Generování obrázků/bannerů/IG postů z copywritera
- 🟢 Guardrail Krok 2 — detekční/cenzurní vrstva `detect.js` (vážené „9/1" skórování)
- 🟢 Plné obousměrné napojení Meta Graph (automatická publikace)

### Komunikační kanály — rozšíření
- 🟠 **WhatsApp upomínky** přes Meta Graph (WhatsApp Business API) — v UI zatím „brzy" (disabled). Složitější: Meta App Review, schválené šablony zpráv, admin přepínač kanálu. Navazuje na výběr `reminder_channel`.

### Platby — Stripe dokončení
- 🔴 Produkční Stripe klíč + webhook secret + ostré otestování platby (launch-blocker, viz L8)
- 🟢 Propojení Stripe se zálohou v rezervaci F6 (konfigurovatelné `require_deposit` z booking_settings)

### Web — kosmetika a obsah (parkováno na otestování admin konzole)
- 🟢 Menu/navigace public webu
- 🟢 Velká revize obsahu: kratší články, nesymetrické ikony, výměna fotek (přes admin konzoli jako provozní test)
- 🟢 „Hyper-responzivita" celého webu

### CRM
- 🟢 Rozšíření CRM nástrojů v admin konzoli (správa klientů)

---

## 🔴 LAUNCH-BLOCKERY (před ostrým spuštěním)

| # | Blocker | Pozn. |
|---|---|---|
| L1 | Resend — verifikace produkční domény (SPF/DKIM) | e-maily z `bicom-pisek.cz` |
| L2 | SEC-3 — Turnstile na rezervačním formuláři | anti-spam |
| L3 | SEO-4 — Google Mapy / Business Profile | lokální viditelnost |
| L4 | Meta App Review | publikace na IG/FB |
| L5 | GoSMS — dobití kreditu | SMS upomínky |
| L6 | SEC-7/8 — právní revize advokátem | zdravotní tvrzení, GDPR dokumenty |
| L7 | Rezervační systém F6–F7 dokončen | kódově hotovo; držet průběžné live ověřování po release |
| L8 | Stripe — produkční klíč + webhook secret + test platby | mechanika hotová, chybí ostré klíče |
| L9 | iDoklad — produkční `SECRET_IDOKLAD_CLIENT_ID/SECRET` + test fakturace | mechanika hotová, chybí ostré klíče |

---

## 📦 PŘEDÁNÍ KLIENTKÁM (BIO ONE LIFE s.r.o.)

Detailní checklist → [HANDOVER.md](HANDOVER.md). Klíčové zbývající:
- Předávací dokumentace (PDF) — doplnit zbývající metadata (datum, adresa sídla, Google Workspace, Calendar ID, Service Account, Lighthouse/QA skóre, SLA ceny, kontakty)
- **✅ Identifikace provozovatele sjednocena** — provozovatel ordinace je **BIO ONE LIFE s.r.o., IČO 23950978** (majitelky Jana a Tereza; značka navenek „Bicom Písek"), zapracováno v:
  - patička webu, GDPR/zásady a handover dokumentace
  - JSON-LD `LocalBusiness` (`legalName`, IČO jako `taxID`)
  - fakturační údaje pro iDoklad (vystavovatel = provozovatel)
  - ⚠️ POZOR rozlišit: **WHC s.r.o.** = dodavatel/správce účtů během vývoje; **BIO ONE LIFE s.r.o.** = provozovatel ordinace. Nezaměňovat.
- Zařadit do předávací dokumentace: SEC-6 protokol + skill „pravni-kontroling"
- ✅ **C3** HANDOVER ověřen proti aktuálním secret názvům v kódu (doplněny chybějící položky `SECRET_GOOGLE_CALENDAR_IMPERSONATE`, `SECRET_CALENDAR_WEBHOOK_SECRET`, `SECRET_META_IG_USER_ID`).
- Vyúčtování klientovi (~80 h odhad)

### Aktivní zásahy (2 bloky)
- **Blok A — Zpevnění webu:** rozšířená hyper-responzivita pro malé mobily, tablety, ultrawide monitory, zařízení s nízkou výškou viewportu a coarse-pointer ovládání (lepší čitelnost, tap targety, stabilnější chat/cookie layout).
- **Blok B — Předávací a vývojová dokumentace:** komplet aktualizovaná mapa repozitáře (`REPO_MAPA_ULOZIST.md`) včetně aktuálního stromu složek/souborů a role jednotlivých oblastí.

---

## 🗺️ Mapa rozhodnutí (ADR)
| ADR | Téma | Status |
|---|---|---|
| [ADR-001](adr/ADR-001-cloudflare-first.md) | Cloudflare-first produkční výseč | Přijato |
| [ADR-002](adr/ADR-002-guardrail-modularni-vrstva.md) | Guardrail jako modulární vrstva | Přijato |
| [ADR-003](adr/ADR-003-ai-studio.md) | AI Studio (skills architektura) | Schváleno |
| [ADR-004](adr/ADR-004-rezervacni-system.md) | Rezervační systém s výběrem času | Schváleno (F1-F7 implementováno; běží hardening + provozní validace) |
| [ADR-005](adr/ADR-005-admin-sprava-rezervaci.md) | Admin správa rezervací + sync konzole ↔ Google | Realizováno (G2-G4 + FE-1/FE-2 hotovo; G5 odloženo) |

---

*Tento dokument je kompas. Když nevíš, kde projekt je — začni tady.*
