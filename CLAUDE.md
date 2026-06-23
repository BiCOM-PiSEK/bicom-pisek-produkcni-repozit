# CLAUDE.md — Bicom Písek (vývojový kontext)

## Co to je
Produkční web ordinace biorezonance. Cloudflare-first: Pages (HTML5+Tailwind+Vanilla ES6 SPA), Workers (V8), Workers AI (llama-3-8b), D1 `bicom-pisek-db` (21 tabulek), R2 `bicom-multimedia`, KV, Queues (booking-jobs, social-jobs). Workeři: bicom-booking-consumer, bicom-social-consumer, bicom-cron-worker. Doména kanonická: bicom-pisek.cz (s pomlčkou). Plnohodnotné CMS (texty/SEO/FAQ/NAP/služby/hero/galerie) s workflow koncept→náhled→zveřejnit a pojmenovanými verzemi — viz [docs/CMS_GUIDE.md](docs/CMS_GUIDE.md).

## Zdroj pravdy
db/schema.sql (kanonické schéma) + db/seed/ + db/migrations/NNNN_*.sql (0001–0023). D1 má = repo.
⚠️ Migrace 0016–0020 byly aplikované ručně (MCP/dashboard) → tabulka `d1_migrations` eviduje jen 0001–0015. Před `wrangler d1 migrations apply` nejdřív dorovnat ledger (viz deep-research report níže).

## Aktuální stav (hloubkový audit)
Nejnovější faktický průřez stavem (infrastruktura, vytíženost D1, integrace, nálezy, příležitosti): [docs/DEEP_RESEARCH_2026-06-21.md](docs/DEEP_RESEARCH_2026-06-21.md). Kompas stavu: [docs/ROADMAP.md](docs/ROADMAP.md).

## REŽIM PRÁCE: aktivní vývoj (post-audit)
- Tato pravidla platí pro VŠECHNY kódovací agenty (Claude, Gemini/Antigravity, Copilot, …), ne jen pro Claude.
- Tento soubor je POVINNÉ čtení na začátku každé práce: nový chat, návrat po odmlce, ztráta kontextu, nebo když je potřeba oživit pravidla hry.
- Aktuální stav projektu (co je hotovo / co se dolaďuje / co čeká): viz [docs/ROADMAP.md](docs/ROADMAP.md) — kompas, čti na začátku práce.
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