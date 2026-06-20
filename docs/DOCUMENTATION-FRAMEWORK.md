# 📐 DOCUMENTATION FRAMEWORK — Jak jsou organizované všechny milníky a vývoj

> **Status:** 🟢 PROPOSAL  
> **Čtení:** PRE-IMPLEMENTACE  
> **Účel:** Architektura dokumentace pro vývoj, aby bylo vše jasné, kontextové a technicky podrobné

---

## 🗺️ AKTUÁLNÍ STAV (`docs/` v `main`)

```
docs/
├── 📄 ARCHITEKTURA.md               ← Vysokoúrovňový přehled
├── 📄 ROADMAP.md                    ← Stav: ✅/🟡/🟢 + launch blockery
├── 📄 MASTER-GOALS-BACKLOG.md       ← Všechny milníky + 3 cesty forward
├── 📄 GAP_ANALYSIS_OPPORTUNITIES.md ← Co chybí + doporučení
├── 📄 HANDOVER.md                   ← Předání klientovi
├── 📄 GIT_WORKFLOW.md               ← Jak pracovat s gitem
├── 📄 REPO_MAPA_ULOZIST.md          ← Kde co v repozitáři je
│
├── 📂 adr/                          ← Architektonická rozhodnutí (ADR)
│   ├── ADR-001-cloudflare-first.md
│   ├── ADR-002-guardrail-modularni-vrstva.md
│   ├── ADR-003-ai-studio.md
│   ├── ADR-004-rezervacni-system.md
│   └── ADR-005-admin-sprava-rezervaci.md
│
├── 📂 agent-tasks/                  ← Specifikace pro autonomní agenty
│   ├── CMS-FEATURE-SPEC.md
│   ├── CMS-IMPLEMENTATION-EXAMPLES.md
│   ├── CMS-TASK-CHECKLIST.md
│   └── README.md
│
├── 📂 assets/                       ← Diagramy, obrázky
│   └── (zatím prázdné)
│
└── 📂 strategy/                     ← ???
    └── (různé strategie)
```

---

## 🎯 PROBLÉM AKTUÁLNÍ STRUKTURY

1. **Bez jasné organizace milníků** — MASTER-GOALS-BACKLOG je seznam, ale kde se popisuje konkrétní implementace?
2. **Bez "feature documentation"** — Jak se popisují jednotlivé features (AI Studio, Chatbot, SEO)?
3. **Bez kontextového mapování** — Který dokument řeší co? Kde se hledá info o X?
4. **Bez praktických průvodců** — "Jak se implementuje chatbot?" neni nikde jasně napsáno
5. **Agent tasks jsou izolované** — Skvělé, ale jak se propojují s ostatní dokumentací?

---

## 💡 NAVRHOVANÁ STRUKTURA

### **VRSTVA 1: STRATEGICKÁ ROZHODNUTÍ (Architecture Decision Records)**

```
docs/adr/
├── ADR-001-cloudflare-first.md      ← Infrastruktura
├── ADR-002-guardrail-modularni-vrstva.md  ← Bezpečnost AI
├── ADR-003-ai-studio.md             ← Generování obsahu
├── ADR-004-rezervacni-system.md     ← Booking logika
├── ADR-005-admin-sprava-rezervaci.md ← Admin funkce
└── ADR-006-documentation-framework.md ← TOT NOVÝ: Jak se dokumentuje vývoj
```

---

### **VRSTVA 2: FEATURE DOCUMENTACE (Co se vyvíjí)**

Nová struktura: **`docs/features/`** — Každý feature má svoje podpracovny:

```
docs/features/
│
├── 📂 CMS/                          ← Obsah editace bez deploymentu (F11)
│   ├── FEATURE-SPEC.md              ← Co, proč, cíle
│   ├── ARCHITECTURE.md              ← Datový model, API, UI
│   ├── IMPLEMENTATION-GUIDE.md       ← Step-by-step jak to udělat
│   ├── API-REFERENCE.md             ← Všechny endpointy
│   ├── TESTING-STRATEGY.md          ← Jak se testuje
│   ├── DEPLOYMENT-RUNBOOK.md        ← Jak se nasazuje
│   └── OPERATOR-GUIDE.md            ← Pro uživatele (operátora)
│
├── 📂 AI-STUDIO/                    ← Generování obsahu (ADR-003, F1–F5)
│   ├── FEATURE-SPEC.md
│   ├── SKILLS-ARCHITECTURE.md       ← Vysvětlení skilů
│   ├── PROVIDERS-CHAIN.md           ← Model fallback logika
│   ├── VISUAL-GENERATION.md         ← Obrázky, Lucid Origin, Flux
│   ├── WIZARD-UI.md                 ← Admin interface design
│   ├── IMPLEMENTATION-GUIDE.md
│   ├── API-REFERENCE.md
│   └── TESTING-STRATEGY.md
│
├── 📂 CHATBOT/                      ← AI poradce na webu
│   ├── FEATURE-SPEC.md
│   ├── CONVERSATION-DESIGN.md       ← Jak se mluví s uživatelem
│   ├── CONTEXT-AWARENESS.md         ← Jak chatbot zná kontakt
│   ├── GUARDRAIL-INTEGRATION.md     ← Bezpečnost tvrzení
│   ├── IMPLEMENTATION-GUIDE.md
│   ├── API-REFERENCE.md
│   └── DEPLOYMENT-RUNBOOK.md
│
├── 📂 SOCIAL-AUTOMATION/            ← IG/FB publikace
│   ├── FEATURE-SPEC.md
│   ├── META-GRAPH-INTEGRATION.md    ← Jak se napojit na IG/FB API
│   ├── SCHEDULING-ENGINE.md         ← Plánování publikací
│   ├── CONTENT-PIPELINE.md          ← Text + obrázek → publikace
│   ├── IMPLEMENTATION-GUIDE.md
│   └── API-REFERENCE.md
│
├── 📂 SEO-GEO/                      ← Lokální landing stránky + SEO
│   ├── FEATURE-SPEC.md
│   ├── LANDING-PAGE-TEMPLATE.md     ← Design + struktura
│   ├── KEYWORD-STRATEGY.md          ← Česká města, keywords
│   ├── JSON-LD-GENERATION.md        ← Strukturované data
│   ├── LOCALIZATION-STRATEGY.md     ← Jak se lokalizují stránky
│   ├── IMPLEMENTATION-GUIDE.md
│   └── SEO-CHECKLIST.md
│
├── 📂 NEWSLETTER/                   ← Email sekvence (Resend)
│   ├── FEATURE-SPEC.md
│   ├── SEQUENCE-DESIGN.md           ← Welcome + nurture flow
│   ├── SEGMENTATION-RULES.md        ← Jak se segmentují subscribers
│   ├── IMPLEMENTATION-GUIDE.md
│   └── TEMPLATE-EXAMPLES.md
│
└── 📂 MONITORING-OPS/               ← Backups, monitoring, SLA
    ├── FEATURE-SPEC.md
    ├── BACKUP-STRATEGY.md           ← D1 export + R2
    ├── ALERTING-RULES.md            ← Co by mělo triggerovat alert
    ├── IMPLEMENTATION-GUIDE.md
    └── RUN-BOOK.md
```

---

### **VRSTVA 3: STRATEGICKÉ PLÁNY (Jak se to vyvíjí)**

```
docs/strategy/
│
├── 📄 DEVELOPMENT-PHASES.md         ← Fáze vývoje (Cesta A/B/C)
├── 📄 SPRINT-PLANNING.md            ← Jak se plánují sprinty
├── 📄 DELIVERY-TIMELINE.md          ← Kdy co vychází
├── 📄 TESTING-STRATEGY.md           ← Jak se testuje globálně
├── 📄 PERFORMANCE-TARGETS.md        ← SLA, latency, uptime
├── 📄 SECURITY-CHECKLIST.md         ← Co se musí auditovat
├── 📄 SCALING-STRATEGY.md           ← Jak se škáluje (MEVERIK template)
└── 📄 HANDOVER-RUNBOOK.md           ← Předání klientovi (detailní)
```

---

### **VRSTVA 4: REFERENCE & UTILITIES**

```
docs/reference/
│
├── 📄 DATABASE-SCHEMA.md            ← Odkaz na db/schema.sql + vysvětlení
├── 📄 API-CONVENTIONS.md            ← Jak se píšou endpointy
├── 📄 COMPONENT-PATTERNS.md         ← Vue komponenty, patterns
├── 📄 CODING-STANDARDS.md           ← Code style, linting
├── 📄 TESTING-PATTERNS.md           ← Unit, integration, E2E
├── 📄 DEPLOYMENT-CHECKLIST.md       ← Kontrola před pushem
├── 📄 TROUBLESHOOTING.md            ← Co když se něco pokazí
└── 📄 GLOSSARY.md                   ← Termíny (booking, slot, guardrail, atd.)
```

---

## 🔗 MASTER INDEX (Navigace)

Nový soubor: `docs/INDEX.md` — **Centrální mapa všeho**

```markdown
# 📚 Dokumentace — Kompletní index

## Chci vědět...

### "Jaký je celkový plán projektu?"
→ [MASTER-GOALS-BACKLOG.md](MASTER-GOALS-BACKLOG.md) (všechny milníky)
→ [ROADMAP.md](ROADMAP.md) (stav: ✅/🟡/🟢)

### "Jak se implementuje FEATURE XYZ?"
→ `docs/features/{FEATURE}/IMPLEMENTATION-GUIDE.md`
→ `docs/features/{FEATURE}/API-REFERENCE.md`

### "Jaké architektonické rozhodnutí stojí za XYZ?"
→ `docs/adr/ADR-*.md` (5 ADRů)

### "Jak se testuje?"
→ `docs/strategy/TESTING-STRATEGY.md` (globální)
→ `docs/features/{FEATURE}/TESTING-STRATEGY.md` (feature-specific)

### "Jak se nasazuje?"
→ `docs/features/{FEATURE}/DEPLOYMENT-RUNBOOK.md` (feature)
→ `docs/strategy/DEPLOYMENT-CHECKLIST.md` (globální)

### "Kde je to v kódu?"
→ [REPO_MAPA_ULOZIST.md](REPO_MAPA_ULOZIST.md)

### "Jak si vezmu úkol a implementuji ho?"
→ `docs/agent-tasks/README.md` (návod pro agenty)
→ `docs/agent-tasks/{FEATURE}-SPEC.md` (konkrétní task)

### "Jak se synchronizuji s ostatními?"
→ [GIT_WORKFLOW.md](GIT_WORKFLOW.md)

### "Jak se předává klientovi?"
→ [HANDOVER.md](HANDOVER.md)

### "Co se v budoucnu dělá?"
→ `docs/strategy/DEVELOPMENT-PHASES.md`
→ `docs/strategy/DELIVERY-TIMELINE.md`

### "Kolik to bude stát / trvat?"
→ [MASTER-GOALS-BACKLOG.md](MASTER-GOALS-BACKLOG.md) (velikost bloku)
→ `docs/strategy/DEVELOPMENT-PHASES.md` (timeline)

### "Co se nesmí dělat?"
→ `docs/adr/ADR-002-guardrail-modularni-vrstva.md` (bezpečnost)
→ `docs/strategy/SECURITY-CHECKLIST.md`

### "Jak se škáluje na dalšího klienta?"
→ `docs/strategy/SCALING-STRATEGY.md`
→ `docs/MASTER-GOALS-BACKLOG.md` (Blok 9: MEVERIK template)

---

## 📂 Struktura adresářů

| Cesta | Účel |
|-------|------|
| `docs/adr/` | Architektonická rozhodnutí |
| `docs/features/` | Dokumentace jednotlivých features |
| `docs/strategy/` | Globální plány a strategie |
| `docs/reference/` | Reference, patterns, konvence |
| `docs/agent-tasks/` | Specifikace pro autonomní agenty |
| `docs/assets/` | Diagramy, obrázky |

## ⚡ Cheat sheet: Která dokumentace kde je?

- **Nová feature:** Stvořit v `docs/features/{NAME}/`
- **Architektonické rozhodnutí:** Sepsat jako `docs/adr/ADR-NNN-*.md`
- **Jak se něco implementuje:** `docs/features/{NAME}/IMPLEMENTATION-GUIDE.md`
- **Jak se testuje:** `docs/features/{NAME}/TESTING-STRATEGY.md`
- **Jak se nasazuje:** `docs/features/{NAME}/DEPLOYMENT-RUNBOOK.md`
- **Globální plán:** `docs/strategy/`
- **Reference na kód:** `docs/REPO_MAPA_ULOZIST.md`
- **Agentský task:** `docs/agent-tasks/{FEATURE}-SPEC.md`
```

---

## 📋 SZABLON: Jak se píše FEATURE dokumentace

```markdown
# FEATURE: {Název funkce}

## 1. FEATURE-SPEC.md
- Co se dělá (cíle)
- Proč (obchodní důvod)
- Pro koho (user persona)
- Priorita 🔴/🟠/🟢

## 2. ARCHITECTURE.md
- Datový model (tabulky, pole)
- API endpointy (HTTP verbum, path, body, response)
- Frontend komponenty (Vue, struktura)
- Integrace s ostatními systémy (Cloudflare, R2, D1, KV)
- Diagramy (ASCII, Mermaid)

## 3. IMPLEMENTATION-GUIDE.md
- Krok za krokem jak to udělat
- Kde se co píše (soubory)
- Praktické příklady kódu (SQL, JavaScript, Vue)
- Potíže, které mohou nastat (a jejich řešení)

## 4. API-REFERENCE.md
- Všechny endpointy s příklady
- Request/response s příklady
- Error codes a chyby
- Rate limiting, auth

## 5. TESTING-STRATEGY.md
- Unit testy (co se testuje, jak)
- Integration testy (end-to-end flow)
- Manuální QA checklist
- Performance testy (latency, cache)

## 6. DEPLOYMENT-RUNBOOK.md
- Jak se nasazuje (kroky)
- Jak se rollbackuje
- Jak se monitoruje po nasazení
- Co se měří (metrics)

## 7. OPERATOR-GUIDE.md (pokud je pro uživatele)
- Jak se používá (screenshots, video)
- FAQ
- Troubleshooting
```

---

## 🚀 IMPLEMENTACE STRUKTURY

### Fáze 1: Vytvoření Directory Structure
```bash
mkdir -p docs/features/{CMS,AI-STUDIO,CHATBOT,SOCIAL-AUTOMATION,SEO-GEO,NEWSLETTER,MONITORING-OPS}
mkdir -p docs/strategy
mkdir -p docs/reference
```

### Fáze 2: Migrace Existujících Dokumentů
- `CMS-FEATURE-SPEC.md` → `docs/features/CMS/FEATURE-SPEC.md`
- `CMS-IMPLEMENTATION-EXAMPLES.md` → `docs/features/CMS/IMPLEMENTATION-GUIDE.md` (upravit)
- `CMS-TASK-CHECKLIST.md` → `docs/agent-tasks/CMS-TASK-CHECKLIST.md` (zůstane)

### Fáze 3: Vyplnění Chybějících Dokumentů
- AI-STUDIO, CHATBOT, SOCIAL-AUTOMATION, SEO-GEO, NEWSLETTER — každý dostane svůj folder

### Fáze 4: Vytvoření Master INDEX
- `docs/INDEX.md` — centrální mapa

---

## 🎯 VÝHODY STRUKTURY

| Aspekt | Problém | Řešení |
|--------|---------|--------|
| **Orientace** | "Kde najdu info o X?" | INDEX.md + logická struktura |
| **Onboarding** | Nový dev si neví rady | FEATURE/{NAME}/IMPLEMENTATION-GUIDE.md |
| **Agentti** | Agent neví kde začít | FEATURE/{NAME} má všechno seřazené |
| **Maintance** | "Kde je to napsáno?" | Logická lokace + INDEX.md |
| **Eskalace** | "Co když se to pokazí?" | DEPLOYMENT-RUNBOOK.md + TROUBLESHOOTING.md |
| **Scaling** | MEVERIK template pro ostatní | docs/strategy/SCALING-STRATEGY.md + templates |

---

## 📐 PŘÍKLAD: Jak by vypadala AI-STUDIO dokumentace

```
docs/features/AI-STUDIO/
├── FEATURE-SPEC.md                  ← Základní info
├── SKILLS-ARCHITECTURE.md           ← Jak fungují skills
├── PROVIDERS-CHAIN.md               ← Model fallback: CF → Groq → Gemini
├── VISUAL-GENERATION.md             ← Lucid Origin, Flux, prompt engineering
├── COMPOSER.md                      ← SVG + text layer
├── WIZARD-UI.md                     ← Admin interface design (mockupy)
├── IMPLEMENTATION-GUIDE.md          ← Step-by-step implementace (F1–F5)
├── API-REFERENCE.md                 ← /admin/imagine, /gallery/*, atd.
├── TESTING-STRATEGY.md              ← Unit + E2E testy
├── DEPLOYMENT-RUNBOOK.md            ← Jak se nasazuje, co se měří
└── OPERATOR-GUIDE.md                ← Jak operátor používá Studio
```

**Když developer chce vědět "Jak se implementuje AI-STUDIO?":**
1. Přečte si `FEATURE-SPEC.md` (co, proč)
2. Přečte si `ARCHITECTURE.md` (jak technicky)
3. Pustí se do `IMPLEMENTATION-GUIDE.md` (step-by-step)
4. Když má otázku na API → `API-REFERENCE.md`
5. Než nasazuje → `DEPLOYMENT-RUNBOOK.md`
6. Když je hotovo → `TESTING-STRATEGY.md`

---

## ✅ CHECKLIST: Co udělat

- [ ] Vytvořit `docs/features/` directory
- [ ] Vytvořit subdirectories (CMS, AI-STUDIO, CHATBOT, atd.)
- [ ] Vytvořit `docs/strategy/` directory
- [ ] Vytvořit `docs/reference/` directory
- [ ] Migrovat existující dokumenty (CMS)
- [ ] Vytvořit šablonu pro nové dokumenty
- [ ] Vytvořit master `docs/INDEX.md`
- [ ] Updatovat `docs/ROADMAP.md` s linky na feature docs
- [ ] Updatovat `docs/README.md` (nebo vytvořit hlavní README)

---

## 🔗 CROSS-REFERENCES (Jak se to napojuje)

**MASTER-GOALS-BACKLOG.md** (seznam všeho)
  ↓
**ROADMAP.md** (stav: ✅/🟡/🟢)
  ↓
**docs/features/{NAME}/FEATURE-SPEC.md** (co se dělá)
  ↓
**docs/features/{NAME}/IMPLEMENTATION-GUIDE.md** (jak se to dělá)
  ↓
**docs/agent-tasks/{NAME}-SPEC.md** (specifikace pro agenty)
  ↓
**Agent si vezme task a implementuje**

**docs/adr/ADR-*.md** (proč se to tak dělá)
  ↓ Odkazuje z
**docs/features/{NAME}/ARCHITECTURE.md** (architektura featurú)

---

## 📞 KONTEXT PRO UŽIVATELE

Při příštího ptaní:
- **"Co se dělá teď?"** → ROADMAP.md
- **"Jak se implementuje X?"** → docs/features/X/IMPLEMENTATION-GUIDE.md
- **"Proč se to tak dělá?"** → docs/adr/ADR-*.md nebo ARCHITECTURE.md
- **"Kde je to v kódu?"** → REPO_MAPA_ULOZIST.md
- **"Jak se testuje?"** → docs/features/X/TESTING-STRATEGY.md
- **"Jak se nasazuje?"** → docs/features/X/DEPLOYMENT-RUNBOOK.md

---

*Toto je návrh na STRUKTURU. Implementace následuje.*
