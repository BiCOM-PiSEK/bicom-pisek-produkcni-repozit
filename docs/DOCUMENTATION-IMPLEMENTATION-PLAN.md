# 🛠️ DOKUMENTAČNÍ IMPLEMENTAČNÍ PLÁN — Jak vytvoříme strukturu

> **Stav:** 🟢 READY TO EXECUTE  
> **Verze:** 1.0 · 2026-06-20  
> **Účel:** Konkrétní plán na vytvoření a naplnění dokumentační struktury

---

## 📋 SEZNAM DOKUMENTŮ K VYTVOŘENÍ

### **KROK 1: Vytvořit directory strukturu**

```bash
mkdir -p docs/features/CMS/
mkdir -p docs/features/AI-STUDIO/
mkdir -p docs/features/CHATBOT/
mkdir -p docs/features/SOCIAL-AUTOMATION/
mkdir -p docs/features/SEO-GEO/
mkdir -p docs/features/NEWSLETTER/
mkdir -p docs/features/MONITORING-OPS/
mkdir -p docs/strategy/
mkdir -p docs/reference/
```

---

### **KROK 2: Migrovat & rozšířit stávající dokumenty**

#### **CMS — Obsah bez deploymentu (F11)**

Stávající: `docs/agent-tasks/CMS-FEATURE-SPEC.md`  
Migrovat do:

```
docs/features/CMS/
├── FEATURE-SPEC.md
│   ← Obsah z docs/agent-tasks/CMS-FEATURE-SPEC.md
│
├── ARCHITECTURE.md
│   ← Obsah z docs/agent-tasks/CMS-IMPLEMENTATION-EXAMPLES.md
│   ← Databázové schéma (tabulky page_sections, gallery_items, hero_config)
│   ← API diagram (admin CRUD + public cache)
│   ← Vue komponenty struktura
│
├── IMPLEMENTATION-GUIDE.md
│   ← Step-by-step kód (fáze 1–4)
│   ← SQL migrace (0013)
│   ← API implementace (JavaScript)
│   ← Vue komponenty (kopírovat + upravit)
│   ← Problematické situace a řešení
│
├── API-REFERENCE.md
│   ← POST /api/admin/page-sections
│   ← GET /api/admin/page-sections
│   ← GET /api/admin/page-sections/:key
│   ← PUT /api/admin/page-sections/:key
│   ← DELETE /api/admin/page-sections/:key
│   ← POST /api/admin/gallery/upload
│   ← GET /api/admin/gallery/:gallery_key
│   ← PUT /api/admin/gallery/:id
│   ← DELETE /api/admin/gallery/:id
│   ← POST /api/admin/gallery/:gallery_key/reorder
│   ← POST /api/admin/hero/:page_key
│   ← GET /api/admin/hero/:page_key
│   ← PUT /api/admin/hero/:page_key
│   ← GET /api/public/page-sections/:key
│   ← GET /api/public/gallery/:gallery_key
│   ← GET /api/public/hero/:page_key
│   (s curl příklady, request/response)
│
├── TESTING-STRATEGY.md
│   ← Unit testy (API validation)
│   ← Integration testy (API → D1 → R2)
│   ← E2E test (operátor → upload → web zobrazí)
│   ← Performance (< 500ms API, cache hit ratio)
│
├── DEPLOYMENT-RUNBOOK.md
│   ← Jak se nasazuje (kroky)
│   ← D1 migrace
│   ← KV cache invalidation
│   ← R2 binding
│   ← Rollback procedura
│   ← Post-deploy smoke test
│
└── OPERATOR-GUIDE.md
    ← Screenshots: jak se přihlásit
    ← Jak editovat text
    ← Jak nahrát fotku
    ← Jak uspořádat fotky (drag-n-drop)
    ← Jak si myslet o hero banneru
    ← FAQ: "Co když se něco pokazí?"
    ← Kontakt na support
```

---

#### **AI STUDIO — Generování obsahu (ADR-003, F1–F5)**

Stávající: `docs/adr/ADR-003-ai-studio.md` (2KB)  
Nová dokumentace:

```
docs/features/AI-STUDIO/
├── FEATURE-SPEC.md
│   ← Cíl: Operátor vygeneruje obsah bez Photoshopu
│   ← Priorita: 🟠 DŮLEŽITÁ (po handoveru)
│   ← Odhad: 40–50 hodin
│   ← Co to dělá: text + obraz → publikace se schválením
│
├── SKILLS-ARCHITECTURE.md
│   ← Co je skill? (nadstavba nad promptem)
│   ← text-content skill (jak se píšou články, nadpisy, tónus)
│   ← visual-content skill (jak vypadá brand, barvy, negativní pravidla)
│   ← chatbot skill (persona, hranice, eskalace)
│   ← Kde se skills píšou (functions/lib/ai/skills/)
│   ← Jak se skill používá (příklady)
│
├── PROVIDERS-CHAIN.md
│   ← Primární model: @cf/meta/llama-3.3-70b-instruct-fp8-fast (CF)
│   ← Fallback 1: Groq API (když CF padne)
│   ← Fallback 2: Gemini API (poslední možnost)
│   ← Jak se nastavuje (env proměnné)
│   ← Jak se testuje fallback
│   ← Cost kalkulace (cf $$$, groq $$$, gemini $$$)
│
├── VISUAL-GENERATION.md
│   ← Lucid Origin (primary, $0.007 per image)
│   ← Flux (fallback 1)
│   ← Gemini (fallback 2)
│   ← Prompt engineering: co funguje, co ne
│   ← Image variations (16:9, 1:1, 9:16)
│   ← Brand guidelines v promptu
│   ← DailyCAP: max 50 images/den (konfigurovatelné)
│
├── COMPOSER.md
│   ← SVG + text layer strategie
│   ← Jak se přidává text na obrázek (Canvas API)
│   ← Brand typografie (Cormorant Garamond, Montserrat)
│   ← Brand barvy (RGB, RGBA)
│   ← Template pro karusel (5 slidů: slide 1 obraz+nadpis, slides 2–5 šablona)
│   ← Edita bez regenerace (important!)
│
├── WIZARD-UI.md
│   ← UI flow: volba typu → draft text → vizuál → live preview → schválení
│   ← Stav każdého kroku (loading, error, success)
│   ← Mockupy (wireframes) každého kroku
│   ← Vue komponenty: WizardStep1, WizardStep2, atd.
│   ← Live preview (jak se vidí výsledek)
│   ← Regenerate každého kroku (independent)
│
├── IMPLEMENTATION-GUIDE.md (VELKÝ!)
│   ← Fáze 1: Refaktor providers.js (CRITICAL — bez regrese)
│   ├── Krok 1.1: Vytvořit functions/lib/ai/providers.js
│   ├── Krok 1.2: runText() funkce (CF → Groq → Gemini)
│   ├── Krok 1.3: runImage() funkce
│   ├── Krok 1.4: Convertovat chat.js, copywriter.js na nový interface
│   ├── Krok 1.5: Regresní testy (ne breaknout!)
│   │
│   ← Fáze 2: Skills
│   ├── Krok 2.1: functions/lib/ai/skills/text-content.js
│   ├── Krok 2.2: functions/lib/ai/skills/visual-content.js
│   ├── Krok 2.3: functions/lib/ai/skills/chatbot.js
│   ├── Krok 2.4: Integrace guardrail (v skills)
│   │
│   ← Fáze 3: Vizuál
│   ├── Krok 3.1: functions/lib/ai/composer.js (SVG + text)
│   ├── Krok 3.2: /admin/imagine endpoint
│   ├── Krok 3.3: R2 upload (ai-studio/{rok}/{uuid}.png)
│   ├── Krok 3.4: D1 media_assets table (migrace 0011)
│   ├── Krok 3.5: Audit log
│   │
│   ← Fáze 4: Admin UI
│   ├── Krok 4.1: WizardStep1.vue (content type picker)
│   ├── Krok 4.2: WizardStep2.vue (text generation)
│   ├── Krok 4.3: WizardStep3.vue (visual generation)
│   ├── Krok 4.4: WizardStep4.vue (preview + approve)
│   ├── Krok 4.5: MediaGallery.vue (vygenerované obrázky)
│   │
│   ← Fáze 5: Integrace do pipeline
│   ├── Krok 5.1: Napojení na social_posts
│   ├── Krok 5.2: Schválení → automatické publikace
│   │
│   ← Potíže & řešení
│   ├── Model vrací špatný obrázek → upravit visual-content skill
│   ├── CF image API limit → přepnout na Flux
│   ├── Text v obrázku je špatný → composer.js debug
│
├── API-REFERENCE.md
│   ← POST /admin/imagine (CF Access required)
│   ← GET /admin/media-assets (galerie)
│   ← PUT /admin/media-assets/:id
│   ← DELETE /admin/media-assets/:id
│   (s curl příklady)
│
├── TESTING-STRATEGY.md
│   ← Unit testy:
│   │ ├── providers.js (runText, runImage fallbacks)
│   │ ├── skills (prompt composition)
│   │ ├── composer.js (SVG rendering)
│   │
│   ← Integration testy:
│   │ ├── skill → provider → R2 upload → D1 zápis
│   │ ├── Audit log
│   │
│   ← E2E test:
│   │ ├── Admin vybere typ → AI generuje → preview → schválí
│   │ ├── Obrázek se uložit do R2 + DB
│   │ ├── Operátor vidí galerii
│   │
│   ← Performance:
│   │ ├── Image generation < 5s (Lucid Origin)
│   │ ├── API response < 500ms (before image)
│   │ ├── R2 upload < 2s (1MB)
│   │ ├── Daily CAP test (50 images/den)
│
├── DEPLOYMENT-RUNBOOK.md
│   ← Jak se nasazuje (v pořadí fází 1–5)
│   ← Smoke test po F1 (bez regrese)
│   ← Smoke test po F3 (R2 + D1)
│   ← Smoke test po F4 (UI v admin)
│   ← Rollback: kde se reverovat (migrace, code)
│   ← Monitoring: co se měří (image generation latency, cost, errors)
│
└── OPERATOR-GUIDE.md
    ← "Co je Bicom Studio?" (in Czech)
    ← Jak se spustí (kde kliknout)
    ← Krok 1: Výběr typu obsahu
    ← Krok 2: Naplnit text
    ← Krok 3: Nechat AI vygenerovat obrázek
    ← Krok 4: Schválit nebo regenerovat
    ← Krok 5: Publikovat
    ← FAQ: "Cena za generování?", "Kde se obrázky ukládají?"
    ← Troubleshooting: "AI generuje blbě" → tip na visual-content skill
```

---

### **DALŠÍ FEATURES (zkráceno, pattern stejný)**

#### **CHATBOT — AI poradce**

```
docs/features/CHATBOT/
├── FEATURE-SPEC.md
├── CONVERSATION-DESIGN.md       ← Jak se mluví s uživatelem
├── CONTEXT-AWARENESS.md         ← Kontextuální info (location, service)
├── GUARDRAIL-INTEGRATION.md     ← Bezpečnost (žádná diag)
├── IMPLEMENTATION-GUIDE.md
├── API-REFERENCE.md
├── TESTING-STRATEGY.md
└── DEPLOYMENT-RUNBOOK.md
```

#### **SOCIAL-AUTOMATION — IG/FB publikace**

```
docs/features/SOCIAL-AUTOMATION/
├── FEATURE-SPEC.md
├── META-GRAPH-INTEGRATION.md    ← Napojení na IG/FB API
├── SCHEDULING-ENGINE.md         ← Plánování
├── CONTENT-PIPELINE.md          ← Tok: obsah → připravit → publikovat
├── IMPLEMENTATION-GUIDE.md
├── API-REFERENCE.md
└── TESTING-STRATEGY.md
```

#### **SEO-GEO — Lokální landing stránky**

```
docs/features/SEO-GEO/
├── FEATURE-SPEC.md
├── LANDING-PAGE-TEMPLATE.md     ← HTML struktura
├── KEYWORD-STRATEGY.md          ← 5 měst + keywords
├── JSON-LD-GENERATION.md        ← Strukturované data
├── LOCALIZATION-STRATEGY.md     ← Jak se lokalizují
├── IMPLEMENTATION-GUIDE.md
└── SEO-CHECKLIST.md
```

#### **NEWSLETTER — Email sekvence**

```
docs/features/NEWSLETTER/
├── FEATURE-SPEC.md
├── SEQUENCE-DESIGN.md           ← Welcome (5 emailů) + nurture
├── SEGMENTATION-RULES.md        ← Jak se dělí subscribenti
├── IMPLEMENTATION-GUIDE.md
└── TEMPLATE-EXAMPLES.md
```

#### **MONITORING-OPS — Backups, monitoring**

```
docs/features/MONITORING-OPS/
├── FEATURE-SPEC.md
├── BACKUP-STRATEGY.md           ← Denní export D1 → R2
├── ALERTING-RULES.md            ← Co triggeruje alert
├── IMPLEMENTATION-GUIDE.md
└── RUN-BOOK.md                  ← Jak se responds na incidenty
```

---

### **KROK 3: Vytvořit STRATEGY dokumenty**

```
docs/strategy/
├── DEVELOPMENT-PHASES.md        ← Cesta A/B/C timeline
├── SPRINT-PLANNING.md           ← Jak se plánují sprinty (2-týdenní)
├── DELIVERY-TIMELINE.md         ← Gantt: kdy co vychází
├── TESTING-STRATEGY.md          ← Globální testing (unit, integration, E2E)
├── PERFORMANCE-TARGETS.md       ← SLA: 99.9% uptime, < 500ms API
├── SECURITY-CHECKLIST.md        ← Audity: XSS, GDPR, encryption
├── SCALING-STRATEGY.md          ← MEVERIK template pro ostatní
└── HANDOVER-RUNBOOK.md          ← Detailní předání (operátor training)
```

---

### **KROK 4: Vytvořit REFERENCE dokumenty**

```
docs/reference/
├── DATABASE-SCHEMA.md           ← Vysvětlení db/schema.sql
├── API-CONVENTIONS.md           ← Jak se píšou endpointy
├── COMPONENT-PATTERNS.md        ← Vue patterns
├── CODING-STANDARDS.md          ← Code style (Prettier, ESLint)
├── TESTING-PATTERNS.md          ← Jak se píšou testy
├── DEPLOYMENT-CHECKLIST.md      ← Co ověřit před pushem
├── TROUBLESHOOTING.md           ← Common issues + solutions
└── GLOSSARY.md                  ← Termíny (booking, slot, guardrail)
```

---

### **KROK 5: Vytvořit MASTER INDEX**

```
docs/INDEX.md                     ← Navigace: "Chci vědět X, kde to je?"
```

---

## 📊 TIMELINE: Kdy se vytvoří

| Fáze | Aktivita | Čas | Prio |
|------|----------|-----|------|
| 1 | Vytvořit directory strukturu | 15 min | 🔴 |
| 2 | Migrovat CMS dokumenty | 2h | 🔴 |
| 3 | Rozšířit CMS (API-REF, Testing, atd) | 3h | 🔴 |
| 4 | Vytvořit AI-STUDIO dokumentaci | 8h | 🟠 |
| 5 | Vytvořit ostatní features (5×) | 20h | 🟠 |
| 6 | STRATEGY dokumenty | 6h | 🟠 |
| 7 | REFERENCE dokumenty | 4h | 🟢 |
| 8 | Master INDEX + cross-references | 2h | 🔴 |
| **CELKEM** | | **~45 hodin** | |

---

## ✅ CHECKLIST: Jak postupovat

**Den 1: Struktura**
- [ ] Vytvořit všechny adresáře (`docs/features/`, `docs/strategy/`, `docs/reference/`)
- [ ] Git commit struktury (prázdné readme)

**Den 2–3: CMS dokumenty**
- [ ] Migrovat & rozšířit CMS dokumenty
- [ ] Napsat API-REFERENCE (všechny endpointy)
- [ ] Napsat TESTING-STRATEGY
- [ ] Napsat DEPLOYMENT-RUNBOOK
- [ ] Napsat OPERATOR-GUIDE

**Den 4–7: Ostatní features**
- [ ] AI-STUDIO (8h)
- [ ] CHATBOT (4h)
- [ ] SOCIAL-AUTOMATION (4h)
- [ ] SEO-GEO (4h)
- [ ] NEWSLETTER (2h)
- [ ] MONITORING-OPS (2h)

**Den 8: Finalizace**
- [ ] Vytvořit STRATEGY dokumenty
- [ ] Vytvořit REFERENCE dokumenty
- [ ] Vytvořit master INDEX.md
- [ ] Ověřit cross-references (všechny linky fungují)
- [ ] Final git commit

---

## 🎯 VÝSLEDEK

Po tomto procesu bude:

✅ **Jasná struktura**: Každý feature má svoje dokumenty v logické lokaci  
✅ **Snadno nalezitelné**: INDEX.md dělá orientaci triviální  
✅ **Kompletní**: Každý feature má SPEC + ARCH + IMPL-GUIDE + API + TESTING + DEPLOYMENT  
✅ **Kontextované**: Vše je propojeno skrz cross-references  
✅ **Praktické**: Developer si vezme feature, přečte IMPLEMENTATION-GUIDE, a začne kódovat  
✅ **Budoucí-proof**: Když přijde nový dev, má všechno co potřebuje  

---

## 🚀 PŘÍŠTÍ KROK

Jakmile se tato struktura vytvoří, bude:

1. **Zdroj pravdy pro vývoj** — místo aby si agent ptaly, má vše co potřebuje
2. **Onboarding pro nové lidi** — "Chci se zapojit" → "Čti docs/features/"
3. **SOP (Standard Operating Procedures)** — jak se vyvíjí, testuje, nasazuje
4. **Knowledge base** — pro budoucí maintainance (MEVERIK template)

---

*Toto je konkrétní plán. Dá se přepsat do tasků a automatizovat.*
