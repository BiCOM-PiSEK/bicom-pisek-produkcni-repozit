# ADR-003: AI Studio — sjednocená AI vrstva se skills architekturou

**Datum:** 2026-06-11 · **Stav:** Schváleno · **Navazuje na:** ADR-001
(Cloudflare-first), ADR-002 (guardrail jako modul)

## Kontext

Projekt má tři AI funkce (chatbot, copywriter, připravované vizuální
generování) a každá si nese vlastní kopii logiky:

1. **Duplicitní provider řetězec** — chat.js i copywriter.js implementují
   vlastní kaskádu Workers AI → Groq → Gemini. Incident s deprecated
   modelem (květen 2026) se musel opravovat na dvou místech.
2. **Řídicí znalost roztroušená v promptech** — tone-of-voice, struktura
   článků, persona chatbota žijí jako stringy uuprostřed endpointů.
3. **Vizuální obsah neexistuje** — covery článků, social vizuály a
   bannery se řeší ručně mimo systém.

ADR-002 zavedlo vzor „řídicí dokumentace jako modul v repu" (guardrail).
Toto ADR jej zobecňuje na celou AI vrstvu.

## Rozhodnutí

Zavádíme **AI Studio**: vrstvu `functions/lib/ai/` + admin modul „Studio".

### 1. Struktura
functions/lib/ai/
├── providers.js          # JEDINÝ provider řetězec pro text i obraz
│                         #   runText({env, messages, maxTokens})
│                         #   runImage({env, prompt, options})
├── composer.js           # kompozice: textová vrstva nad vizuálem
│                         #   (SVG→PNG ve Workeru), brand typografie
├── skills/
│   ├── text-content.js   # styl, struktura, délky dle typu, tone-of-voice
│   ├── visual-content.js # brand vizuál: paleta, kompozice, formáty,
│   │                     #   negativní pravidla (žádná klinika/ezoterika)
│   └── chatbot.js        # persona AI Rádce, hranice, eskalace
└── (guardrail/ zůstává vedle — skills jej importují)
Vzorec každé AI funkce: **skill (co a jak) + guardrail (co nesmí)
+ providers (čím) + composer (sazba)**. Endpointy se zmenší na:
validace → prompt ze skillu → providers → uložení.

### 2. Modelové řetězce

| Úloha | Primární | Fallback 1 | Fallback 2 |
|---|---|---|---|
| Text | @cf/meta/llama-3.3-70b-instruct-fp8-fast | Groq API | Gemini API |
| Obraz | @cf/leonardo/lucid-origin | @cf/black-forest-labs/flux-1-schnell | Gemini API (image) |

Názvy modelů žijí POUZE v providers.js (poučení z deprecation incidentu
— příští výměna = 1 řádek).

### 3. Typy obsahu (šablony výstupů)

| Typ | Formát | Text v obraze | Skladba |
|---|---|---|---|
| Article cover | 16:9 | ne | 1 AI vizuál |
| IG/FB post | 1:1 | ano — nadpis/claim | AI vizuál + textová vrstva |
| IG/FB story | 9:16 | ano | AI vizuál + textová vrstva |
| Karusel IG/FB | 1:1 × (1+3–5) | slide 1: nadpis; slides 2+: textové | slide 1 = AI vizuál + nadpis; slides 2+ = brandová šablona (Quiet Luxury pozadí + typografie), texty z text-content skillu |
| Banner web | dle umístění | volitelně | AI vizuál + vrstva |

**Text v obraze — dvouvrstvá strategie:** AI generuje čistý vizuál,
text se přidává programově jako kompoziční vrstva (composer.js).
Důvody: 100% správná česká diakritika, přesné brand fonty (Cormorant
Garamond / Montserrat) a barvy, text editovatelný bez přegenerování
obrázku. Karuselové slides 2+ jsou čistě šablonové — rychlé, levné,
vizuálně konzistentní.

### 4. Vícefázové generování (wizard ve Studiu)

1. volba typu obsahu →
2. AI navrhne texty (nadpis, claimy, texty slidů) →
3. AI vygeneruje vizuál(y) →
4. kompozice + živý náhled, texty editovatelné →
5. schválení člověkem →
6. uložení do R2 + media_assets → (F5: zařazení do social fronty).

Každý krok lze přegenerovat samostatně. Platí pravidlo z ADR-002:
**AI nepublikuje sama** — vše schvaluje člověk.

### 5. Datový tok vizuálu

Admin Studio → POST /admin/imagine (CF Access)
→ skill visual-content složí prompt → providers.runImage
→ composer (volitelná textová vrstva)
→ R2 bucket bicom-multimedia (ai-studio/{rok}/{uuid}.png)
→ D1: nová tabulka media_assets (id, r2_key, kind, prompt, model,
   status[draft|approved|archived], created_by, created_at) — migrace 0011
→ audit_log (akce ai_image_generate).

### 6. Náklady a limity

- Lucid Origin ≈ $0.007 / 512px dlaždice → 1080p obraz v řádu centů.
- Denní strop generování: KV čítač (vzor AI_CHAT_DAILY_CAP), výchozí
  50/den, laditelné přes process_states.
- Bez nové infrastruktury: R2, D1, KV, Workers AI už běží (ADR-001 platí).

## Fáze implementace

- **F1 — Refaktor základu:** providers.js; chat.js + copywriter.js
  převést. Bez změny chování (regresní test).
- **F2 — Skills:** text-content.js, chatbot.js; prompty z endpointů
  do skills.
- **F3 — Vizuál:** visual-content.js, composer.js, /admin/imagine,
  migrace 0011, R2 zápis, audit.
- **F4 — Studio UI:** admin modul, wizard, galerie, schvalování.
- **F5 (horizont):** organizer skill, napojení na _cron-social pipeline.

Zahájení F1 až po dokončení stabilizačního základu (demo data cleanup,
Google Calendar zápis, menu) — dle dohodnutého pořadí.

## Nultá úroveň (Zero-Level completion gates)

AI Studio je považováno za dokončené až po splnění všech bodů:

1. **Architektura bez driftu**
   - `functions/lib/ai/` je jediný zdroj pravdy pro providers + skills + composer.
   - Endpointy neobsahují ad-hoc systémové prompty mimo skills.
2. **Plná F1-F5 realizace**
   - Text, vizuál, wizard, schvalování, publish orchestrace.
3. **Prompt governance**
   - Versioned systémové prompty per skill, runtime přepínače, audit změn.
4. **Provozní spolehlivost**
   - Retry/failed handling, telemetrie provider failoveru, reprodukovatelné akceptační scénáře.
5. **Externí integrace dokončeny**
   - Meta App Review + live publish validace jsou součást done, ne "future work".

## Důsledky

**Pozitivní:** jeden zdroj pravdy pro modely i řídicí znalost; výměna
modelu = 1 řádek; nová AI funkce = nový skill, ne nový subsystém;
end-to-end obsahová pipeline (text + vizuál + kompozice) s lidským
schvalováním a auditem.

**Negativní/rizika:** refaktor F1 dočasně zvyšuje riziko regrese
(mitigace: fázování, regresní testy po každé fázi); růst nákladů
Workers AI (mitigace: denní stropy v KV); kvalita vizuálů pro brand
vyžaduje iterativní ladění promptů ve visual-content skillu.
