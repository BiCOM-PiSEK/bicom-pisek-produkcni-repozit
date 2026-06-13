# 🌿 Mapa úložišť a složek projektu Bicom Písek

Tento dokument slouží jako přehledný registr a mapa všech úložišť, složek a klíčových souborů v projektu. Standard MEVERIK STUDIO 2026.

---

## 1. Lokální a kódová úložiště (Repozitář & Inbox)

### A. Lokální Inbox (Média & Podklady ke zpracování)
*   **Cesta v lokálu:** `docs/assets/Matěj - dokumenty, soubory a multimédia (ke zpracovani)/`
*   **Typ přístupu:** Soukromé / Lokální (lokální složka orchestrátora)
*   **Obsah:** Zdrojové `.jpeg` obrázky, `.mp4` videa, opravené dokumenty (např. `README_opraveny.md`) a pomocné skripty (např. `APPLY_TO_REPO.sh`, `gen_landing.py`).
*   **Účel:** Slouží jako dočasné vstupní úložiště ("inbox") pro nové podklady, které provozovatel připravil k integraci do kódu, databáze nebo nahrání na Cloudflare R2.

### B. Lokální Archiv (Zpracované soubory)
*   **Cesta v lokálu:** `docs/assets/Matěj - dokumenty, soubory a multimédia (ke zpracovani)/zpracované/`
*   **Typ přístupu:** Soukromé / Lokální (lokální složka orchestrátora)
*   **Obsah:** Zpracované obrázky, videa a dokumenty, které již byly úspěšně zakódovány, nasazeny na web nebo nahrány do R2 bucketu.
*   **Účel:** Slouží jako lokální archiv pro zachování historie a zálohu zpracovaných souborů z inboxu.
*   *Poznámka:* Složka s přesným názvem `archiv` nebo `archive` v kořenovém adresáři ani v `docs/` neexistuje; tuto roli plní právě tento podadresář.

### C. Dokumentační složka `docs/` a podsložky
*   **Cesta v lokálu:** `docs/`
*   **Typ přístupu:** Soukromé (součást repozitáře)
*   **Obsah & podsložky:**
    *   `docs/` — Obsahuje hlavní architektonické, marketingové a metodické dokumenty (`ARCHITEKTURA.md`, `GIT_WORKFLOW.md`, `API_KEYS_CHECKLIST.md`, `STYLE_BRIEF.md`, `HANDOVER.md`, `ROADMAP.md` atd.).
    *   `docs/ROADMAP.md` — Živý kompas stavu projektu (hotovo/dolaďuje se/čeká, launch-blockery, fáze) — **jediný zdroj pravdy o aktuálním stavu**.
    *   `docs/agent-tasks/` — Obsahuje pracovní deník kódovacích AI agentů (`WORK-DIARY.md`).
    *   `docs/assets/` — Grafické a textové podklady (inbox a složka `originals/` s původními grafickými návrhy).
    *   `docs/audit/` — Interní auditní zprávy (architektura, kód, infra, bezpečnost, SEO), které jsou uchovávány mimo produkční repozitář (ignorováno v .gitignore).
*   **Účel:** Centralizované úložiště dokumentace, briefů a auditních zpráv celého ekosystému.

### D. Markdown soubory v rootu repozitáře
*   **Cesta v lokálu:** `/` (kořenový adresář repozitáře)
*   **Typ přístupu:** Soukromé (součást repozitáře)
*   **Soubory:**
    *   `README.md` — Úvodní rozcestník, popis stacku a rychlý start.
    *   `CLAUDE.md` — Vývojový kontext, pravidla hry a chování pro kódovací AI agenty.
    *   `WHITE_PAPER.md` — Master Index vývojového balíku, strategie a onboarding.
    *   `GITHUB_SETUP_AND_PLANNING.md` — Plány a dělba práce pro AI agenty.
    *   `agent_journal.md` — Rychlý deník změn zapisovaný přímo kódovacími agenty.
*   **Účel:** Základní navigace vývojářů a konfigurační soubory pro AI nástroje.

---

## 2. Online repozitáře (GitHub)

### A. Upstream (Hlavní repozitář organizace)
*   **Online URL:** `https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git`
*   **Typ přístupu:** Soukromé (přístup pro organizaci a vývojáře)
*   **Obsah:** Produkční kód (HTML, CSS, Vanilla JS), Pages Functions (`functions/`), migrace a seed data (`db/`), konfigurační `.toml` soubory.
*   **Účel:** Jediný zdroj pravdy (Source of Truth) pro produkční nasazení. Z větve `main` se provádí ostrý deploy na Cloudflare Pages.

### B. Origin (Vývojový fork)
*   **Online URL:** `https://github.com/MEVERIK-SOLUTION/bicom-pisek-produkcni-repozit.git`
*   **Typ přístupu:** Soukromé
*   **Obsah:** Zrcadlená struktura upstreamu s lokálními a testovacími větvemi vývojářů.
*   **Účel:** Izolované vývojové prostředí pro testování a otevírání Pull Requestů (PR) do upstreamu.

---

## 3. Infrastrukturní úložiště (Cloudflare Edge)

### A. Cloudflare D1 (Relační databáze)
*   **Název v kódu/infře:** `bicom-pisek-db` (ID: `c04cb289-2ff4-45d7-9fa0-3243c34c3abe`)
*   **Typ přístupu:** Zabezpečené (přístupné jen přes Cloudflare credentials / secrets)
*   **Obsah:** Relační SQLite databáze (14 aplikačních tabulek jako `bookings`, `blog_posts`, `services`, `operators`, `calendar_slots` atd.).
*   **Účel:** Ukládání a dešifrování (AES-GCM) provozních dat, rezervačních slotů a blogových příspěvků.

### B. Cloudflare R2 (Object Storage)
*   **Název v kódu/infře:** `bicom-multimedia`
*   **Typ přístupu:** Zabezpečené / Částečně veřejné (veřejné pro URL obrázků a médií na webu)
*   **Obsah:** Fotografie z Instagramu, nahrávky pro AI copywritera, certifikáty a zálohy databáze D1.
*   **Účel:** Levné a bezúdržbové ukládání statických souborů bez egress poplatků.

### C. Cloudflare KV (Key-Value Cache)
*   **Název v kódu/infře:** `bicom-pisek-cache`
*   **Typ přístupu:** Zabezpečené
*   **Obsah:** Rate-limit čítače, session tokeny, cache pro JSON-LD schémata, bypass cookies pro maintenance režim.
*   **Účel:** Rychlá mezipaměť s nízkou latencí pro dočasné stavy.
