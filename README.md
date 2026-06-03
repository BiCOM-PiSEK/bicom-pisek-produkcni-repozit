# 🌿 Bicom Písek — Produkční repozitář

Hlavní produkční repozitář organizace **BiCOM-PiSEK** (`bicom-pisek-produkcni-repozit`). „Single Source of Truth" pro nasazení na Cloudflare a předání klientce. Vyvíjeno dle standardu **MEVERIK STUDIO 2026** — strategie **Edge-First** (nulové fixní náklady, < 200 ms latence, AI na okraji sítě).

> **Kanonická doména:** `bicom-pisek.cz` (s pomlčkou). Produkční Pages projekt běží i na výchozí doméně `bicom-pisek.pages.dev` — **obě jsou živé a chráněné.**

---

## 🏗️ Stack (Cloudflare-only v produkci)

- **Frontend:** HTML5 / Tailwind / Vanilla ES6 (SPA s kotvami) → Cloudflare Pages
- **Backend:** Cloudflare Pages Functions + 3 Workers (ES modules, bez Node.js)
- **DB:** Cloudflare D1 `bicom-pisek-db` (SQLite na edge, 14 tabulek)
- **Storage:** Cloudflare R2 `bicom-multimedia` (média, 0 egress)
- **Cache:** Cloudflare KV `bicom-pisek-cache`
- **Async:** Cloudflare Queues `booking-jobs`, `social-jobs`
- **AI:** Workers AI (`@cf/meta/llama-3-8b-instruct`) + fallback Groq → Gemini
- **Integrace:** Google Calendar/Gmail, Resend, Meta Graph, SMS brána, Telegram, iDoklad, Stripe

### Workers
| Worker | Účel |
|---|---|
| `bicom-pisek` (Pages) | web + `/api/*` + `/admin/*` |
| `bicom-booking-consumer` | tok A — rezervace → kalendář → e-mail |
| `bicom-social-consumer` | fronta social-jobs |
| `bicom-cron-worker` | 7 cron úloh (zálohy, GDPR, upomínky, IG sync, cashflow…) |

---

## 🚀 Lokální start

```bash
git clone https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git
cd bicom-pisek-produkcni-repozit
npm install
cp .dev.vars.example .dev.vars   # vyplň lokální klíče (NIKDY necommitovat)
npm run db:init:local
npm run dev
```

> Práce s repem (fork ↔ upstream, větvení, nasazení) se řídí **`docs/GIT_WORKFLOW.md`**.

---

## 📖 Dokumentace

| Dokument | Popis |
|---|---|
| `docs/ARCHITEKTURA.md` | Celková technická architektura, datové toky, D1 schéma |
| `docs/GIT_WORKFLOW.md` | Pravidla větvení a synchronizace (Fork ↔ Upstream) |
| `docs/DATABASE_MANAGEMENT.md` | Správa D1, migrace, seed, šifrování |
| `docs/API_KEYS_CHECKLIST.md` | Kanonický registr secrets a API klíčů (kde žijí, stav) |
| `docs/STYLE_BRIEF.md` | Vizuální zákoník — Quiet Luxury paleta, typografie |
| `docs/ASSET_STRATEGY.md` | Strategie vizuálních assetů (originály, web verze, R2) |
| `docs/GEO_AEO.md` + `docs/GEO_AEO_SEO_STRATEGY.md` | Obsahová a lokální SEO/AEO strategie + právní rámec zdravotních tvrzení |
| `docs/STRIPE_INTEGRATION.md` | Platební brána (volitelná funkce) |
| `docs/HANDOVER.md` | Postup předání klientce |
| `docs/GAP_ANALYSIS_OPPORTUNITIES.md` | Technický dluh a příležitosti |
| `docs/audit/` | Generální audit M1–M7 (architektura, kód, infra, integrace, bezpečnost, UX, SEO) |

---

## 🤖 Protokol pro AI agenty

1. **Přečti `.github/AI_AGENT_PROMPT.md`** a `CLAUDE.md` a plně je respektuj.
2. Design se řídí PŘÍSNĚ podle `docs/STYLE_BRIEF.md` (Quiet Luxury). Žádné odchylky v barvách ani typografii.
3. **Vizuální assety** dle `docs/ASSET_STRATEGY.md` — originály v `docs/assets/`, web verze v `public/assets/img/`.
4. **Žádné** externí knihovny mimo definované ve `wrangler.toml` / `package.json`.
5. Každou změnu zapiš do `agent_journal.md` a `docs/agent-tasks/WORK-DIARY.md`.
6. Zdravotní tvrzení **vždy** přes právní filtr — viz `docs/GEO_AEO.md` a nálezy auditu M7 (právní revize tvrzení L1–L6).
7. **Žádný Secret do kódu** — pouze CF Secrets / `.dev.vars` (v `.gitignore`). Názvy a umístění viz `docs/API_KEYS_CHECKLIST.md`.

---

## 🔒 Bezpečnost (stav po Sprintu S0)

- `/admin/*` je chráněn **Cloudflare Access** (Zero Trust, One-Time PIN) na obou doménách — bez přihlášení vrací 403 / login.
- Citlivá zdravotní data šifrována **AES-GCM 256** (field-level, čl. 9 GDPR) před zápisem do D1.
- Secrets výhradně v CF Secrets; v repu nikdy.

---

## 📦 Předání klientce

Postup převodu domény, CF účtu, Google Workspace a repozitáře → **`docs/HANDOVER.md`**.

---

## 🔄 Vztah k vývojovému balíku MEVERIK

Tento repozitář je **produkční (předatelná) výseč**. Nadřazeným strategickým a designovým zdrojem je vývojový balík **MEVERIK STUDIO**; sem se promítá jen produkční kód. Komplexní know-how (Vue/Nuxt varianta, FastAPI enginy, AI orchestrace) zůstává v soukromém MEVERIK repu a do produkce se nekopíruje.
