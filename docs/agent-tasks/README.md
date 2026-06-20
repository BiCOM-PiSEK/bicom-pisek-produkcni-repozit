# 📂 Agent Tasks — Dokumentace pro autonomní zpracování

Tento adresář obsahuje **kompletní specifikace úkolů**, které mohou zpracovávat autonomní agenti bez interakce s uživatelem.

Každý úkol je rozdělen do 3 částí:

1. **FEATURE-SPEC.md** — Kontext, cíle, architektura, fáze, checklist
2. **IMPLEMENTATION-EXAMPLES.md** — Konkrétní kód, SQL, Vue komponenty
3. **TASK-CHECKLIST.md** — Orchestrace pro agenta, předpoklady, DoD

---

## 📋 Aktuální úkoly

### 🆕 CMS — Editace obsahu bez deploymentu (F11)

**Soubory:**
- [CMS-FEATURE-SPEC.md](CMS-FEATURE-SPEC.md) — Komplexní specifikace (16KB)
- [CMS-IMPLEMENTATION-EXAMPLES.md](CMS-IMPLEMENTATION-EXAMPLES.md) — Kód & SQL (26KB)
- [CMS-TASK-CHECKLIST.md](CMS-TASK-CHECKLIST.md) — Orchestrace (12KB)

**Stav:** 🟢 Připraveno k zpracování agenty  
**Priorita:** 🔴 KRITICKÁ (handover blocker)  
**Odhad:** 12 hodin  
**Agent:** Libovolný (preferováno: `general-purpose` nebo `task`)

**Návod:**
1. Agent si přečte **CMS-FEATURE-SPEC.md** (10 minut — povinně!)
2. Agent si přečte **CMS-IMPLEMENTATION-EXAMPLES.md** (15 minut — vzorky kódu)
3. Agent následuje kroky v **CMS-TASK-CHECKLIST.md** (Fáze 1–7)
4. Agent commituje changes s `[CMS-F11]` v message
5. Agent vytvoří PR, popíše co dodělal
6. Human review + merge

---

## 🚀 Jak zpracovat agentský task?

### Pro **uživatele** (přiřazujícího agenta):

```bash
# Zpracuj CMS úkol s obecným agentem
# Agent dostane tři soubory najednou
npx copilot task --agent general-purpose \
  --name "CMS Feature Implementation" \
  --prompt "
  Implementuj CMS feature dle specifikace v docs/agent-tasks/.
  
  Postupuj takto:
  1. Přečti CMS-FEATURE-SPEC.md (kontext, cíle)
  2. Přečti CMS-IMPLEMENTATION-EXAMPLES.md (kód, SQL)
  3. Sleduj CMS-TASK-CHECKLIST.md (7 fází)
  
  Commituj s prefixem [CMS-F11] v message.
  Vytvoř PR na main.
  "
```

### Pro **agenta** (zpracovávajícího task):

1. **Inicializace** (5 minut)
   - Přečti si `docs/agent-tasks/CMS-FEATURE-SPEC.md` — cíl, architektura, 5 fází
   - Přečti si `docs/agent-tasks/CMS-IMPLEMENTATION-EXAMPLES.md` — vzorky kódu
   - Orientuj se v repo: `db/migrations/`, `functions/api/`, `public/assets/`

2. **Implementace** (10 hodin)
   - Fáze 1: Database (migrace, schema.sql) — 1.5h
   - Fáze 2: API (admin CRUD + public cache) — 3.5h
   - Fáze 3: Admin UI (Vue komponenty) — 3h
   - Fáze 4: Web Integration (dynamic render) — 2h
   - Fáze 5–7: Security, testing, docs — 2h

3. **Testing** (1 hodina)
   - Unit testy API
   - E2E test: operátor → upload → web
   - Performance check: latence, cache
   - Cross-browser na Chrome, Firefox, Safari

4. **Commit & PR** (30 minut)
   - `git commit -m "CMS Feature (F11): page_sections, gallery, hero — [CMS-F11]"`
   - `git push`
   - GitHub CLI: `gh pr create --title "CMS Feature F11" --body "Implementuje obsah bez deploymentu..."`
   - Popis PR = copy z CMS-FEATURE-SPEC.md GoalSection

---

## 📐 Struktura specifikačního dokumentu

Každý task-spec se skládá z:

```
# 📋 {FEATURE} — {Stručný popis}

## 🎯 Cíl
- Co má být uděláno?
- Proč?
- Pro koho?

## 🏗️ Architektura
- Datový model (tabulky)
- API endpointy
- Frontend komponenty
- Integrace

## 📋 Implementační plán (detailní kroky)
- Fáze 1, 2, 3...
- Každá fáze: co, jak, kde, testy

## 🗄️ Soubory k vytvoření / úpravě
- Nové soubory: seznam
- Úpravy existujících: seznam

## 🔐 Bezpečnost & Validace
- Input validation
- Autentizace
- Rate limiting
- CORS

## ⚡ Performance
- Cache strategie
- Database indexy
- Fallback scénáře

## 📚 Dokumentace
- Handover guide
- User guide
- Developer guide

## ✅ Kritéria přijetí (DoD)
- Co znamená "hotovo"?
- Testy, linting, performance, docs

## 📊 Časový odhad
- Tabulka: fáze → času

## 🚀 Příští kroky
- Co dělat po tomto tasku?

## 📎 Závislosti & Bloky
- Co musí existovat?
- Co by mohlo zablokovat?
```

---

## 🛠️ Utilities pro agenty

### Týmto umožňuje rychlejší orientaci:

- `docs/REPO_MAPA_ULOZIST.md` — Mapa repozitáře (kde co je)
- `docs/GIT_WORKFLOW.md` — Git workflow (branches, PRs)
- `docs/HANDOVER.md` — Infrastruktura, secrets, deployment
- `docs/adr/` — Architektonická rozhodnutí (ADR-001 až ADR-005)
- `db/schema.sql` — Kanonické DB schéma
- `wrangler.toml` — Cloudflare konfigurace

Když si agent není jistý, **grep/view** tyto soubory.

---

## 📝 Příklady z praxe

### CMS Feature (aktuální)

```
docs/agent-tasks/
├─ CMS-FEATURE-SPEC.md          ← Spec: 16KB, 5 fází, 7 sekcí
├─ CMS-IMPLEMENTATION-EXAMPLES.md  ← Kód: 26KB, SQL + 6 JS souborů
├─ CMS-TASK-CHECKLIST.md        ← Orchestrace: 12KB, 8 checklistů
└─ README.md                    ← Tohle
```

### Budoucí tasks (šablona)

```
docs/agent-tasks/
├─ {FEATURE}-SPEC.md
├─ {FEATURE}-EXAMPLES.md
├─ {FEATURE}-CHECKLIST.md
└─ {FEATURE}-DEPENDENCIES.md      ← (optional, pokud existují závislosti)
```

---

## 🔄 Workflow — Příklad

### Uživatel:
```
"Implementuj CMS, dle plány v agent-tasks/CMS-*"
```

### Agent:
1. Přečte si CMS-FEATURE-SPEC.md
2. Přečte si CMS-IMPLEMENTATION-EXAMPLES.md  
3. Vytvoří: `db/migrations/0013_...`, `functions/api/admin/page-sections.js`, ...
4. Testuje: `npm run dev`, `wrangler d1 execute ...`
5. Commituje: `git commit -m "CMS (F11): [CMS-F11]"`
6. Pushuje: `git push origin meverik-solution-...`
7. Vytvoří PR: GitHub Copilot CLI nebo `gh pr create`

### Výsledek:
- ✅ 8 nových souborů
- ✅ 5 updated souborů
- ✅ 0 console errors
- ✅ Performance < 500ms
- ✅ Dokumentace updatovaná
- ✅ PR ready to merge

---

## 🆘 Pokud agent selže

### Typické problémy:

1. **"Neví, kde je admin Vue app"**
   - → `grep -r "admin" public/` (hledej `*.vue` soubory)

2. **"Neví, jak ověřit JWT"**
   - → `grep -r "verifyJWT\|verify\|token" functions/api/` (najdi pattern)

3. **"R2 binding nefunguje"**
   - → `view wrangler.toml` (ověř `[[r2_buckets]]`)

4. **"Database migrace selhala"**
   - → `wrangler d1 execute bicom-pisek-db --local --file=...` (lokální test)
   - → `sqlite3` — interaktivní debug

### Řešení:
- Agent si **vždycky samo najde odpověď** (grep, view, test)
- Pokud je to architektonické rozhodnutí, agent se zeptá

---

## 📞 Kontakt & Eskalace

Pokud agent:
- Najde **bug v kódu** — commitnout fix s `[BUG-FIX]`
- Najde **nekonzistenci v spec** — updatovat specifikaci (aby to byl zdroj pravdy)
- Je **zablokován externe** (např. chybí R2 binding) — vyjádřit to jasně v PR commentary

Human se pak rozhodne: fixnout, nebo posunout deadline.

---

## ✅ Checklist pro přidání nového task-specu

Když chceš přidat nový task:

- [ ] Vytvoř `{FEATURE}-SPEC.md` (16–20KB, všechny sekce)
- [ ] Vytvoř `{FEATURE}-IMPLEMENTATION-EXAMPLES.md` (20–30KB, kód + SQL)
- [ ] Vytvoř `{FEATURE}-TASK-CHECKLIST.md` (10–15KB, orchestrace)
- [ ] Updatuj `docs/ROADMAP.md` (odkaz na spec + stav)
- [ ] Přidej odkaz do tohoto `README.md`

Pak agent dostane jasný, **soběstačný** task.

---

*Poslední aktualizace: 2026-06-20 · Verze: 1.0*
