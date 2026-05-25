# 🤖 Agent Journal — deník změn AI agentů

> POVINNÉ: každý AI agent po dokončení úkolu připíše záznam NAHORU (nejnovější první).
> Formát: datum · agent · co · proč · dotčené soubory · stav QA.

## [ŠABLONA — zkopíruj a vyplň]
- **Datum:** RRRR-MM-DD HH:MM
- **Agent:** (Claude Code | Gemini/Antigravity | Copilot | Nano Banana)
- **Úkol:** stručně
- **Změny:** seznam souborů + co se stalo
- **Rozhodnutí/odchylky:** (pokud ses odchýlil od briefu, vysvětli proč)
- **QA:** lint ✅/❌ · testy ✅/❌ · Lighthouse skóre
- **Pro orchestrátora:** co potřebuje schválit / na co dát pozor

---

## Záznam o přípravě repozitáře
- **Datum:** 2026-05-25 20:22
- **Agent:** Gemini/Antigravity
- **Úkol:** Příprava repozitáře, naklonování scaffold struktury, přesun a konsolidace dokumentace z vývojového balíku
- **Změny:** 
  - Vytvořena složka `docs/` s `ARCHITEKTURA.md`, `GEO_AEO.md`, `HANDOVER.md`
  - Vytvořen `WHITE_PAPER.md` a `GITHUB_SETUP_AND_PLANNING.md` v rootu
  - Odstraněny zastaralé `.md` soubory
  - Zkopírována struktura `scaffold/` včetně konfiguračních souborů a hrubé složkové struktury (`public/`, `functions/`, atd.)
- **Rozhodnutí/odchylky:** Použita větev `agent/ag-w2-00-repo-init` vzešlá z `main` (protože `wave/2-craftio-mvp` v novém repozitáři ještě neexistovala). Zastaralé dokumenty v rootu nahrazeny novými konsolidovanými z vývojového balíku za účelem Single Source of Truth.
- **QA:** lint N/A · testy N/A · Lighthouse skóre N/A (pouze dokumentační a strukturální práce)
- **Pro orchestrátora:** Chtěl bych požádat o schválení této init struktury a její sloučení do `main` případně revizi větve, aby mohli v práci pokračovat další agenti (viz `GITHUB_SETUP_AND_PLANNING.md`).
