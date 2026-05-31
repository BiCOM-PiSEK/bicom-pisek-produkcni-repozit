# 🤖 Lokální Agentní Pravidla (Bicom Písek)

Toto je systémový prompt a bezpečnostní vrstva pro všechny agenty (Claude Code, Gemini, Copilot), kteří vstoupí do tohoto repozitáře.

## 1. Upstream Workflow (Nadřazenost vývojového balíku)
Tento repozitář je aplikační a implementační vrstva. NENÍ to místo pro vymýšlení strategie nebo vizuální DNA. 
*   **Absolutní zdroj pravdy:** Všechny zásadní architektonické, strategické a designové změny musí být napřed provedeny a schváleny v nadřazeném lokálním adresáři `MEVERIK_vyvojovy_balik`.
*   **Read-Only Vize:** Produkční repozitář (zde) pouze přijímá, kóduje a implementuje hotovou vizi. Pokud objevíš logickou díru v zadání, nezalepuj ji vlastním vymyšleným řešením, ale zapiš ji do `agent_journal.md` pro orchestrátora!

## 2. Designový zákoník (Style Brief)
Před úpravou libovolného kaskádového stylu (CSS) nebo Tailwind třídy v `public/` nebo komponentách **MUSÍŠ** nejprve přečíst `docs/STYLE_BRIEF.md`.
*   Dodržuj koncept **Quiet Luxury**. 
*   Třídy musí používat výhradně paletu definovanou v Briefu (šalvějová, smetanová, zlatá, forest green).
*   Žádné tmavé režimy (dark mode), pokud nejsou vysloveně zadány.

## 3. Asset & Imagery Strategy
Před prací s obrázky, logy, ikonami nebo médii **MUSÍŠ** přečíst `docs/ASSET_STRATEGY.md`.
*   **Originály** (plné rozlišení, zdrojové soubory) → `docs/assets/originals/`
*   **Web verze** (optimalizované WebP/AVIF/SVG) → `public/assets/img/`
*   **Dynamická média** (Instagram sync, blog, admin upload) → R2 bucket `bicom-multimedia`
*   **NIKDY** necommituj obrázky větší než 5 MB do Gitu.
*   **NIKDY** nepoužívej obrázky s cizími vodoznaky na produkci.
*   Statické branding vizuály (logo, OG, favicon) VŽDY do `public/`, nikdy do R2.

## 4. Architektura a Bezpečnost
*   **Management Vrstva:** Repozitář obsahuje tajnou management vrstvu (`public/admin/` a příslušné endpointy ve `functions/admin/`). Je striktně chráněna proti neautorizovanému přístupu (Cloudflare Access / JWT).
*   **Zdravotní tvrzení:** Řiď se `docs/GEO_AEO.md`. Nikdy nepiš, že metoda "léčí" – vždy "podporuje", "harmonizuje", atd.

*Zkratka pro agenty: "Přečetl jsem a respektuji AI_AGENT_PROMPT.md"*
