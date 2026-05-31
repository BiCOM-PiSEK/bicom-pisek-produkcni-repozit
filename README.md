# 🌿 Bicom Písek — Produkční Repozitář (`bicom-repozit-produkce`)

Hlavní produkční repozitář organizace **BiCOM-PiSEK**. „Single Source of Truth" pro nasazení na Cloudflare a předání klientce (Lenka Limpouchová). Vyvíjeno dle standardu **MEVERIK STUDIO 2026** — strategie **Edge-First** (nulové fixní náklady, < 200 ms latence, AI na okraji sítě).

## 🏗️ Stack (Cloudflare-only v produkci)
- **Frontend:** HTML5 / Tailwind / Vanilla ES6 → Cloudflare Pages
- **Backend:** Cloudflare Workers (ES modules, bez Node.js)
- **DB:** Cloudflare D1 (SQLite na edge)
- **Storage:** Cloudflare R2 (média, 0 egress)
- **Cache:** Cloudflare KV
- **AI:** Workers AI (`@cf/meta/llama-3-8b-instruct`)
- **Integrace:** Google Calendar/Gmail, Resend, Meta Graph, SMS brána

## 🚀 Start
```bash
git clone https://github.com/BiCOM-PiSEK/bicom-repozit-produkce.git
cd bicom-repozit-produkce
npm install
cp .dev.vars.example .dev.vars   # vyplň lokální klíče (NIKDY necommitovat)
npm run db:init:local
npm run dev
```

## 📖 Dokumentace
| Dokument | Popis |
|----------|-------|
| `docs/STYLE_BRIEF.md` | Vizuální zákoník — Quiet Luxury paleta, typografie |
| `docs/ASSET_STRATEGY.md` | Strategie vizuálních assetů — originály, web verze, R2 |
| `docs/ARCHITEKTURA.md` | Celková technická architektura |
| `docs/API_KEYS_CHECKLIST.md` | Seznam API klíčů a secrets pro produkci |
| `docs/HANDOVER.md` | Postup předání klientovi |
| `docs/GEO_AEO.md` | Geo/AEO a obsahová strategie |

## 🤖 Protokol pro AI agenty
1. **Přečti `.github/AI_AGENT_PROMPT.md`** a plně ho respektuj.
2. Design se řídí PŘÍSNĚ podle `docs/STYLE_BRIEF.md` (Quiet Luxury). Žádné odchylky v barvách či typografii nejsou povoleny.
3. **Vizuální assety** se řídí podle `docs/ASSET_STRATEGY.md` — originály v `docs/assets/originals/`, web verze v `public/assets/img/`.
4. **Žádné** externí knihovny mimo definované ve `wrangler.toml`/`package.json`.
5. Každou změnu zapiš do `agent_journal.md`.
6. Zdravotní tvrzení **vždy** přes právní filtr (`03_GEO_AEO/03`).
7. Žádný Secret do kódu — pouze CF Secrets / `.dev.vars`.

## 📦 Předání
Postup převodu domény, CF účtu, Google Workspace, repozitáře → `docs/HANDOVER.md`.

## 🔄 Upstream Workflow (Nadřazenost vývojového balíku)
Tento repozitář představuje implementační a produkční vrstvu. **Nadřazeným strategickým a designovým zdrojem** je lokální adresář `MEVERIK_vyvojovy_balik`. Jakákoliv strategická či vizuální změna musí být nejprve vytvořena a schválena tam. Sem se pouze promítá (kóduje). Nepřetvářejte strategii přímo v tomto repozitáři.
