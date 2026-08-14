# AGENTS.md — Bicom Písek (vývojový kontext)

## Co to je
Produkční web ordinace biorezonance. Cloudflare-first: Pages (HTML5+Tailwind+Vanilla ES6 SPA), Workers (V8), Workers AI (llama-3-8b), D1 `bicom-pisek-db` (kanonické schéma, migrace 0001–0026), R2 `bicom-multimedia`, KV, Queues (booking-jobs, social-jobs). Workeři: bicom-booking-consumer, bicom-social-consumer, bicom-cron-worker. Doména kanonická: bicom-pisek.cz (s pomlčkou). Plnohodnotné CMS (texty/SEO/FAQ/NAP/služby/hero/galerie) s workflow koncept→náhled→zveřejnit a pojmenovanými verzemi — viz [docs/CMS_GUIDE.md](docs/CMS_GUIDE.md).

## 🌿 Architektonické větve projektu (Branch Isolation Protocol)
V repozitáři existují **dva nezávislé architektonické směry**, které se **NESMÍ slučovat**:
1. **`main` / `upstream` (Cloudflare-First):** Původní edge architektura pro `bicom-pisek.cz` (Cloudflare Pages + Workers + D1 + R2 + KV + Queues).
2. **`produkce/netlify-bicompisek` (Netlify-First + Supabase):** Modernizovaná bezúdržbová architektura pro `bicompisek.cz` (Netlify Functions v2 + Netlify Blobs + Supabase PostgreSQL).
⚠️ **Striktní zákaz mergování:** Jakýkoliv kódovací agent má přísný zákaz slučovat větev `produkce/netlify-bicompisek` zpět do `main` (nebo naopak), aby nedošlo k přepsání či poškození běžící Cloudflare produkce.

## 🧭 Kompas a architektura (GraphiFy)
V tomto repozitáři je nainstalován vizualizační a sémantický nástroj **GraphiFy**. Slouží jako tvůj primární průvodce pro okamžité pochopení struktury repozitáře a vazeb mezi soubory.

- **Kde najdeš graf:** Celý vygenerovaný graf, HTML report a přehled architektury je uložen ve složce [graphify-out/](file:///c:/Users/PC/Documents/GitHub/bicom-pisek-produkcni-repozit/graphify-out).
- **Jak se ptát grafu (CLI):**
  * `graphify query "<tvoje otázka>"` — Rychlé vyhledání sémantických souvislostí.
  * `graphify explain "<koncept>"` — Hloubkové vysvětlení fungování konkrétní komponenty.
  * `graphify path "<A>" "<B>"` — Nalezení nejkratší cesty a provázanosti mezi dvěma soubory.
- **Pravidlo:** Vždy před začátkem práce na komplexnějším úkolu konzultuj `graphify-out/GRAPH_REPORT.md` a po každé modifikaci kódu spusť `graphify update .` pro aktualizaci grafu.

## Zdroj pravdy
db/schema.sql (kanonické schéma) + db/seed/ + db/migrations/NNNN_*.sql (0001–0025). D1 má = repo.
⚠️ Migrace 0016–0020 byly aplikované ručně (MCP/dashboard) → tabulka `d1_migrations` eviduje jen 0001–0015. Migrace 0021–0025 aplikovány v Phase 3.0 (monitoring framework). Před `wrangler d1 migrations apply` nejdřív dorovnat ledger (viz deep-research report níže).

## Aktuální stav (hloubkový audit)
Nejnovější faktický průřez stavem (infrastruktura, vytíženost D1, integrace, nálezy, příležitosti): [docs/DEEP_RESEARCH_2026-06-21.md](docs/DEEP_RESEARCH_2026-06-21.md). Kompas stavu: [docs/ROADMAP.md](docs/ROADMAP.md).

## REŽIM PRÁCE: aktivní vývoj (post-audit)
- Tato pravidla platí pro VŠECHNY kódovací agenty (Claude, Gemini/Antigravity, Copilot, …), ne jen pro Claude.
- Tento soubor je POVINNÉ čtení na začátku každé práce: nový chat, návrat po odmlce, ztráta kontextu, nebo když je potřeba oživit pravidla hry.
- Aktuální stav projektu (co je hotovo / co se dolaďuje / co čeká): viz [docs/ROADMAP.md](docs/ROADMAP.md) — kompas, čti na začátku práce.
- Pokud se lokální fork nebo pracovní kopie rozchází s upstream/main nebo produkcí, ber produkční stav a upstream/main jako zdroj pravdy a nejdřív se s nimi srovnej.
- Agent smí ČÍST kdykoli. MĚNIT kód/konfiguraci/DB smí jen s explicitním povolením v chatu, vždy na vymezený běh; po dokončení se vrací do read-only a o další povolení si musí říct.
- Mazání a destruktivní změny: agent prvoplánově NIC nemaže. Než smaže/přepíše důležitý artefakt (DB schéma, tabulky, vazby, názvy klíčů, pravidla, plány, klíčové dokumenty), ujistí se, že existuje verzovaná kopie, ke které se lze vrátit (git historie, lokální inbox, jiná evidence verzí). Drobné textové úpravy tím nejsou dotčeny.
- Žádné reálné odeslání e-mailů/SMS/zpráv. Žádné sahání na produkční secrets bez pokynu.
- Mapa všech úložišť projektu: viz [docs/REPO_MAPA_ULOZIST.md](docs/REPO_MAPA_ULOZIST.md).

## Úložiště
Projekt využívá následující hlavní úložiště:
- **Lokální inbox:** Adresář pro příchozí podklady a média ke zpracování.
- **Git repozitář:** Osobní fork (vývoj) a hlavní upstream (produkce, zdroj pravdy).
- **Cloudflare Edge:** D1 (databáze), R2 (multimédia) a KV (cache a sessions).
Podrobná struktura a cesty viz [docs/REPO_MAPA_ULOZIST.md](docs/REPO_MAPA_ULOZIST.md).

## Maintenance & Production Safety
- **MAINTENANCE_ENABLED flag** (Phase 2.5): Environment variable (`MAINTENANCE_ENABLED=true|false`) controls whether the homepage is hidden behind "Under Maintenance" screen.
  - **Development/preview:** Can be toggled freely via admin settings or environment
  - **Production:** Managed via `wrangler pages secret put MAINTENANCE_ENABLED` (currently `false` = full public access)
  - Persisted in `_middleware.js` check at routing level; does NOT require app restart
- **Smart degradation:** If backend unavailable, frontend shows maintenance page; if monitoring alerts active, team receives email/notification
- **Incident response:** See [docs/INCIDENT_RESPONSE_GUIDE.md](docs/INCIDENT_RESPONSE_GUIDE.md) for runbook
- **Cloudflare Access branding:** Branding the Access login page is dashboard-only (logo/colors/text in Zero Trust). OTP e-mail appearance itself cannot be customized from the repo; do not chase email-template changes here.

## Agent Rules (Post-Audit)
- **READ ACCESS:** Agents can read repo, DB schema, production logs via MCP at any time (no approval needed)
- **WRITE/DEPLOY ACCESS:** Requires explicit user approval for each bounded task; after completion, revert to read-only
- **Destructive changes:** Agent MUST verify versioned backup exists (git history, external storage) before deleting/overwriting critical artifacts
- **Secrets:** No real email/SMS/message sends without explicit instruction; no production secrets access without user consent