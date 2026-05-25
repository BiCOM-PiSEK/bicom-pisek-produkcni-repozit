# 🌿 BICOM PÍSEK — MASTER INDEX vývojového balíku

> **Single Source of Truth pro agentický vývoj.** Tento balík obsahuje vše, co potřebuje lidský vývojář i AI agent (Claude Code, Gemini/Antigravity, Nano Banana) k postavení celého ekosystému Bicom Písek pod dohledem orchestrátora (Matěj Kocanda, MEVERIK STUDIO).
>
> **Verze:** 1.0 (Master Release) · **Standard:** MEVERIK STUDIO 2026 · **Datum:** 2026-05-25
> **Klient / provozovatel:** Lenka Limpouchová (biorezonance Bicom Optima, Písek)
> **Doména:** `bicompisek.cz` (primární) + 301 redirect z `bicom-pisek.cz`

---

## 1. Jak tento balík používat (3 role)

| Role | Co dělá | Kde začít |
|------|---------|-----------|
| **Ty (Matěj / orchestrátor)** | Rozdáváš zadání agentům, schvaluješ PR, držíš vizi | Tento index → `04_AGENTI/Orchestrace_a_poradi.md` |
| **AI agent (kódovací)** | Staví kód podle briefů a Definition of Done | `04_AGENTI/System_prompt_GLOBAL.md` + svůj brief |
| **AI agent (obrazový, Nano Banana)** | Generuje/retušuje vizuály dle stylu | `04_AGENTI/Agent_NanoBanana_brief.md` |

> ⚠️ **Pravidlo č. 1:** Žádný agent nezačne kódovat, dokud nepřečte `System_prompt_GLOBAL.md` a svůj konkrétní brief. Každý agent zapisuje, co udělal, do `agent_journal.md` v repozitáři.

---

## 2. Mapa balíku (co je kde)

```
MEVERIK_vyvojovy_balik/
├── 00_MASTER/
│   └── 00_START_ZDE_MASTER_INDEX.md      ← jsi tady
├── 01_ARCHITEKTURA/
│   ├── 01_Architektura_ekosystemu.md     ← end-to-end, MEVERIK + Cloudflare, datové toky
│   ├── 02_Databaze_D1_logika_a_zivost.md ← schéma, šifrování, jak DB „žije"
│   ├── 03_Workers_automatizace_mapy.md   ← Workers, Cron, Queues, mapy/NAP, integrace
│   └── 04_UX_metadata_styl_textu.md      ← UX prostředí, vizuální styl, metadata, tone of voice
├── 02_REPOZITAR/
│   ├── 01_Strom_repozitare.md            ← kompletní strom + vysvětlení
│   └── scaffold/                          ← reálné startovací soubory (zkopíruj do repa)
├── 03_GEO_AEO/
│   ├── 01_GEO_AEO_strategie.md           ← jak nás AI/vyhledávače doporučí (lokálně)
│   ├── 02_JSON-LD_sablony.md             ← hotová strukturovaná data
│   └── 03_Pravni_ramec_zdravotni_tvrzeni.md ← právně čisté formulace (DŮLEŽITÉ)
├── 04_AGENTI/
│   ├── System_prompt_GLOBAL.md           ← společný kontext pro VŠECHNY agenty
│   ├── Agent_ClaudeCode_brief.md
│   ├── Agent_Gemini_Antigravity_brief.md
│   ├── Agent_NanoBanana_brief.md
│   └── Orchestrace_a_poradi.md           ← pořadí prací, závislosti, milníky
├── 05_HANDOVER/
│   ├── 01_Predavaci_dokumentace.md
│   └── 02_Co_zajistit_API_ucty_klice.md  ← checklist účtů, API, klíčů
└── 06_PREZENTACE/
    └── bicom_pisek_prezentace.html        ← interaktivní živá prezentace řešení
```

---

## 3. Co projekt je (rychlý onboarding)

Bicom Písek je **hybridní serverless ekosystém** = prémiový prezentační web („Quiet Luxury") + plně automatizovaná **virtuální kancelář**. Běží na **Cloudflare Edge Grid** (Pages, Workers, D1, R2, KV, Workers AI) s nulovými fixními náklady na hosting. Cíl není „jen web", ale **lokální sémantická dominance**: aby vyhledávače i AI asistenti (ChatGPT, Gemini, Perplexity, Apple/Siri) ve spádové oblasti Písek + 25 km (~100–120 tis. obyvatel) doporučovali Bicom Písek jako první volbu pro potíže, na které metoda cílí — při **striktním dodržení pravidel pro zdravotní tvrzení** (viz `03_GEO_AEO/03`).

---

## 4. Tři pilíře strategie

1. **Estetika „Quiet Luxury"** — prémiový, uklidňující design (šalvějová, smetanová, champagne gold; Cormorant Garamond + Montserrat). Odklon od ezoteriky i klinického chladu.
2. **Technologická dominance „Edge-First"** — vše na Cloudflare, latence < 200 ms, field-level šifrování zdravotních dat (AES-GCM, čl. 9 GDPR).
3. **Data-driven GEO/AEO** — obsah cílený na reálné lokální problémy jazykem cílové skupiny.

---

## 5. Cílové segmenty (z demografických rešerší)

| Segment | Podíl | Hlavní potřeby |
|---------|-------|----------------|
| Ženy 35–55 let | 60 % | Stres, vyhoření, nespavost, hormonální rovnováha |
| Matky s dětmi | 20 % | Alergie, ekzémy, šetrné neinvazivní testování |
| IT / manažeři / dělníci v průmyslu | 15 % | Odvykání kouření, únava, bolesti zad, mentální detox |
| Biohackeři | 5 % | Detoxikace, prevence, výkon |

---

## 6. Stav a fázování (co se v této session dodává)

- ✅ **Tento balík (blueprint + prezentace)** — architektura, repo, agentní prompty, GEO, handover, interaktivní prezentace.
- ⏭️ **Samostatný běh:** retuš 18 obrázků (odstranění loga „NotebookLM" a cizích log) — GPU/compute náročné, řešíme zvlášť.
- ⏭️ **Vývojová fáze:** agenti staví kód podle `04_AGENTI/` pod tvým dohledem.

---

## 7. Klíčová rozhodnutí (zamčená — neměnit bez souhlasu orchestrátora)

- Doména: `bicompisek.cz` (bez pomlčky) jako kanonická; `bicom-pisek.cz` → 301 redirect.
- Stack: **Cloudflare-first** uvnitř širší MEVERIK STUDIO architektury (zálohy: Next.js, Neon.tech, GCP AI Garden, NVIDIA NIM).
- Frontend produkce (předání klientce): čistý HTML5 + Tailwind + Vanilla JS na CF Pages. Komplexní Vue/Nuxt verze zůstává v MEVERIK vývojovém repu.
- Dva repozitáře: produkční (předatelný klientce) + soukromý (know-how MEVERIK).
- Zdravotní tvrzení: **vždy** přes právní filtr z `03_GEO_AEO/03_Pravni_ramec_zdravotni_tvrzeni.md`.

---

*Vytvořil: Matěj Kocanda, MBA, DBA — MEVERIK STUDIO™ (powered by WHC s.r.o.) · Official developer: Apple, Google & Bricsys*

---

## 8. Doplněk v1.1 — design DNA, toolset, rozšířené předání

Přidáno na základě design promptu, vytažených vizuálů a MEVERIK stack manuálu:

```
07_DESIGN_DNA/
├── 01_Vizualni_DNA_a_design_system.md   ← „genom" projektu: emoce, podpis značky, tokeny
└── 02_Design_handoff_komponenty.md      ← komponenty, stavy, responsivita, motion, a11y
08_TECH_TOOLSET/
├── 01_Jazyky_a_toolset.md               ← z jakých jazyků je kód + kompletní toolset
└── 02_Technicka_dokumentace_zaklad.md   ← základ tech. dokumentace + Mermaid diagram
05_HANDOVER/ (rozšířeno)
├── 03_Manual_a_klicenka.md              ← manuál pro provozovatele + evidence přístupů
├── 04_Predani_domeny_WEDOS_CZNIC.md     ← .cz doména (WEDOS/CZ.NIC) + DNS na Cloudflare
└── 05_Predani_GitHub_repa.md            ← převod organizace/repa na zákazníka
```

> ⏭️ **Samostatný běh (dle dohody):** prezentace přepracovaná **pro budoucího provozovatele** (ne pro orchestrátora) + retuš 18 obrázků (odstranění loga „NotebookLM").

*Aktualizováno 2026-05-25 · v1.1*

---

## 9. Doplněk v1.2 — vytěžená data, infrastruktura, revize

```
00_MASTER/01_Revize_pripravenosti.md        ← go/no-go readiness review
08_TECH_TOOLSET/
├── 03_Datova_baze_vytezeno.md              ← vytěžená data (geo, segmenty, ceny, konkurence, KPI)
└── 04_Infrastruktura_D1_R2_Workers_AI.md   ← konkrétní formy D1/R2/Workers/AI Workers/KV/Queues
07_DESIGN_DNA/03_POZNAMKA_obrazky_a_loga.md ← TODO: cizí loga (NotebookLM) před produkcí
02_REPOZITAR/scaffold/db/seed/services.sql  ← reálný ceník/služby (seed)
02_REPOZITAR/scaffold/public/data/bicom_data.json ← data pro dashboard/prezentaci
06_PREZENTACE/bicom_pisek_prezentace_provozovatel.html ← prezentace pro provozovatele (+2 reálné vizuály)
```

> **Stav:** 🟢 GO — připraveno k předání do realizace (viz `00_MASTER/01_Revize_pripravenosti.md`). Reálný kód staví agenti dle `04_AGENTI/`.

*Aktualizováno 2026-05-25 · v1.2*


# 01 · Architektura ekosystému (end-to-end)

> Tento dokument popisuje, jak spolu jednotlivé vrstvy fungují — od zařízení klienta až po databázi a integrace. Je nadřazený souborům 02 (DB), 03 (Workers/mapy) a 04 (UX/metadata).

## 1. Filozofie: „Cloudflare-first" uvnitř MEVERIK STUDIO

Produkční web Bicom Písek je **úzká, levná, předatelná** výseč širší distribuované architektury MEVERIK STUDIO. Pravidlo: v produkci klientky běží jen to, co je zdarma/levné a snadno předatelné; veškeré komplexní know-how (Vue/Nuxt verze, FastAPI enginy, AI orchestrace) zůstává ve vývojovém repu MEVERIK.

```
                         MEVERIK STUDIO — distribuovaná architektura
   ┌──────────────────────────────────────────────────────────────────────┐
   │  PRIMÁRNÍ STACK              ZÁLOŽNÍ / ROZŠÍŘENÍ                        │
   │  Frontend:  Vue.js+Nuxt+TS    →  Next.js+TS+Tailwind                    │
   │  Mobil:     Flutter / Swift                                            │
   │  Compute:   CF Workers        →  FastAPI / Cloud Run                    │
   │  Async:     CF Queues                                                  │
   │  AI:        CF Workers AI     →  GCP AI Garden / NVIDIA NIM (Llama 3)   │
   │  DB:        CF D1             →  Neon.tech (Postgres)                   │
   │  Storage:   CF R2             →  (3Q2026+ vlastní úložiště)             │
   │  Cache:     CF KV             →  Upstash (Redis)                        │
   │  Platby:    Apple/Google Pay  →  Stripe ·  Účto: Fakturoid/iDoklad API  │
   │  Auth:      Firebase Auth (Apple/Google)                              │
   │  DevOps:    ANTIGRAVITY (Gemini Flash · Claude Opus/Sonnet · Copilot)  │
   │  CI/CD:     GitHub Pro/Actions ·  QA: Sentry · k6/Locust               │
   └──────────────────────────────────────────────────────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │   PRODUKČNÍ VÝSEČ — BICOM PÍSEK    │
                  │  (Edge-First, Zero-Cost, předatelná)│
                  └───────────────────────────────────┘
```

## 2. Vrstvy produkčního webu (Cloudflare Edge Grid)

| # | Vrstva | Technologie | Funkce | Cíl výkonu |
|---|--------|-------------|--------|-----------|
| 0 | Hrana sítě | Cloudflare DNS + WAF | DDoS štít, rate limiting (100 req/min/IP), bot management | TLS 1.3 |
| 1 | Frontend | CF Pages — HTML5 + Tailwind + Vanilla ES6 (SPA router) | Prémiový portál „Quiet Luxury", fluidní bez přeblikávání | TTFB < 50 ms, LCP < 500 ms |
| 2 | Logika | CF Workers (V8 isolates, ES modules) | API `/api/book`, `/api/newsletter`, `/api/chat`, `/api/admin/copywriter` | bez Node.js závislostí |
| 3 | AI | CF Workers AI (`@cf/meta/llama-3-8b-instruct`) | Chatbot „AI Rádce" + admin copywriter (audio→blog) | edge inference |
| 4 | Data | CF D1 (distribuovaná SQLite) | `bookings`, `newsletter_subscribers`, `blog_posts`, `geo_leads`, `audit_log` | field-level AES-GCM |
| 5 | Storage | CF R2 (S3-kompatibilní) | videa, fotogalerie, certifikáty — bez egress poplatků | — |
| 6 | Cache/Stav | CF KV | session tokeny, rate-limit čítače, cache JSON-LD | — |
| 7 | Integrace | Google Calendar/Gmail, Resend, Meta Graph, SMS brána | viz `03_Workers_automatizace_mapy.md` | OAuth2 / Service Account |

## 3. Hlavní datové toky (sekvence)

### Tok A — Rezervace (klient → ordinace)
```
Klient (formulář)
  → POST /api/book (Worker)
     → validace + sanitizace (XSS, SQLi)
     → DataCrypt.encrypt(citlivé pole)        [AES-GCM, klíč z CF Secrets]
     → INSERT do D1 (bookings, status=pending)
     → Google Calendar API: vlož „předběžnou" událost (žlutá) do kalendáře Lenky
     → Resend API: transakční e-mail s instrukcemi (24h nepít kávu, pít vodu)
     → zapsat do audit_log
  → klientovi: stránka poděkování
```

### Tok B — Potvrzení termínu (Lenka → klient)
```
Lenka v Google Kalendáři změní barvu události na zelenou (potvrzeno)
  → Google Calendar webhook → Worker /api/calendar-hook
     → UPDATE D1 bookings.status = 'confirmed'
     → Resend: potvrzovací e-mail
     → naplánovat SMS upomínku (zápis do KV/queue, T-24h)
```

### Tok C — Bezúdržbový blog (Instagram → web)
```
Cron (každých 24 h) → Worker sync-instagram
  → Meta Graph API: zjisti nové příspěvky
  → stáhni obrázek → R2 (gallery/)
  → text → D1 blog_posts (source='instagram')
  → web v sekci Magazín se sám aktualizuje
```

### Tok D — AI copywriter (hlas → článek)
```
Lenka namluví poznámku → přepis (klávesnice iPhone) → vloží do admin
  → POST /api/admin/copywriter (Worker, ověřený admin token)
     → Workers AI (Llama 3): surový text → „Quiet Luxury" článek + titulek + meta + JSON-LD
     → návrh ke schválení → na klik publikuj do D1 blog_posts
```

## 4. Bezpečnostní principy (shrnutí, detail v 02 a 05)

- **Field-level encryption** citlivých zdravotních polí (čl. 9 GDPR) — AES-GCM 256, Web Crypto API, klíč jen v CF Secrets.
- **Žádný tajný klíč v repu** — vše v CF Secrets, lokálně v `.dev.vars` (v `.gitignore`).
- **Data minimization** — osobní + zdravotní data se po 30 dnech od návštěvy anonymizují (Cron).
- **Cookie consent gating** — měřicí kódy (GA4/Meta Pixel přes GTM) se spustí až po souhlasu.
- **Audit log** — každý zápis citlivých dat se loguje (kdo/kdy/co, bez plaintextu hodnot).

## 5. Prostředí a deploy

| Prostředí | Hosting | DB | Účel |
|-----------|---------|----|------|
| `local` | `wrangler pages dev` | D1 `--local` | vývoj |
| `preview` | CF Pages preview (per PR) | D1 dev | review PR |
| `production` | CF Pages (`bicompisek.cz`) | D1 `bicom-db-prod` | ostrý provoz |

Deploy: GitHub Actions → `wrangler pages deploy` (Continuous Deployment z větve `main` produkčního repa).

## 6. Co je „nadřazené" a co „předatelné"

- **Předatelné klientce:** repo `bicom-repozit-produkce` (čistý produkční kód), CF účet, D1, R2, Workers, Google Workspace, doména. Popsáno v `05_HANDOVER`.
- **Zůstává v MEVERIK:** soukromý repo s experimentálními funkcemi, univerzální knihovny, komplexní AI orchestrace, Vue/Nuxt varianta, FastAPI enginy.
