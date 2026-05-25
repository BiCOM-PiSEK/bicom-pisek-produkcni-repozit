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

## 🤖 Protokol pro AI agenty
1. Přečti `MEVERIK_vyvojovy_balik/04_AGENTI/System_prompt_GLOBAL.md` + svůj brief.
2. Drž design „Quiet Luxury" (Cormorant Garamond + Montserrat; šalvějová/smetanová/champagne).
3. **Žádné** externí knihovny mimo definované ve `wrangler.toml`/`package.json`.
4. Každou změnu zapiš do `agent_journal.md`.
5. Zdravotní tvrzení **vždy** přes právní filtr (`03_GEO_AEO/03`).
6. Žádný Secret do kódu — pouze CF Secrets / `.dev.vars`.

## 📦 Předání
Postup převodu domény, CF účtu, Google Workspace, repozitáře → `MEVERIK_vyvojovy_balik/05_HANDOVER/`.
