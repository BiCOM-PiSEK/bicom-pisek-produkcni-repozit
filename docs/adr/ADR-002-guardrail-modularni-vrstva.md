# ADR-002: Guardrail jako modulární vrstva v repozitáři

**Status:** Přijato  
**Datum:** 2026-06-09  
**Rozhoduje:** Matěj (MEVERIK STUDIO / WHC)  
**Kontext vzniku:** Implementace právního guardrailu pro AI Copywriter (SEC-6a / Fáze B)  

---

## Kontext

Bicom Písek generuje články pro blog, sociální sítě a newslettery pomocí AI (Workers AI, Groq, Gemini). Vzhledem k regulacím (např. zákon č. 372/2011 Sb. o zdravotních službách, evropské regulace zdravotnických prostředků a omezení pro alternativní medicínu) nesmí AI generovat nepovolená zdravotní tvrzení (např. „léčí“, „vyléčí“, „uzdraví“, diagnostika konkrétních nemocí atd.).

Vznikla architektonická otázka, jak tuto guardrail kontrolu (systémové prompty, zakázané fráze, disclaimery a post-zpracování) implementovat:
1. Zda ji vyčlenit jako **samostatnou externí službu** (např. microservice běžící v Cloud Run).
2. Zda ji realizovat jako **modulární vrstvu přímo v repozitáři** (v rámci Cloudflare Pages Functions).

---

## Rozhodnutí

Rozhodli jsme se implementovat guardrail jako **modulární runtime vrstvu přímo uvnitř repozitáře** (umístěnou v `functions/lib/guardrail/`). 

Všechny Pages Functions (jako `copywriter.js`, budoucí `chat.js` apod.) budou tuto vrstvu importovat lokálně. Nastavení úrovně přísnosti (`off`, `mild`, `optimal`, `strict`) se ukládá do databáze D1 (`process_states`), což umožňuje měnit chování za chodu bez nutnosti nového deploye.

---

## Zvážené varianty

### A — Guardrail jako modulární knihovna v repozitáři (zvoleno)
Importuje se přímo jako kód do Cloudflare Workers / Pages Functions.
* **Plus:** Nulová latence (žádný síťový hop / HTTP volání).
* **Plus:** Jednoduché verzování a testování v rámci jednoho repozitáře (v souladu s ADR-001 cloudflare-first).
* **Plus:** Snadná modularita per-nástroj (např. `rules-health.js` pro zdravotní témata, budoucí `rules-brand.js` pro marketingové tónování).
* **Mínus:** Kód sdílí paměť a limity (např. velikost bundle) s hlavním workerem (vzhledem k velikosti pravidel a regexů na Bicomu je toto ale zanedbatelné).

### B — Samostatná externí mikroslužba (Cloud Run / API)
Guardrail by běžel jako samostatné API (např. v Pythonu/FastAPI).
* **Plus:** Nezávislost na programovacím jazyku a platformě, možnost sdílení napříč desítkami různých klientských webů.
* **Mínus:** Každé vygenerování obsahu by vyžadovalo HTTP požadavek navíc -> zvýšení latence a riziko výpadku (další point of failure).
* **Mínus:** Vyšší provozní náklady (provoz Cloud Run / Firebase). Pro malý, edge-first web ordinace se jedná o neobhajitelnou režii.

---

## Trade-off

Ponechání guardrailu uvnitř repozitáře plně odpovídá principům **ADR-001 (Produkční výseč čistě na Cloudflare)**. Zamezuje se zbytečné síťové režii a udržuje se zero-cost architektura. 

Modularita je zajištěna oddělením pravidel (např. `rules-health.js`) od orchestrátoru promptů (`index.js`). To umožňuje rozšíření na další oblasti (např. brandové či finanční hlídače) pouhým přidáním nového rulebooku bez nutnosti zásahu do integračních částí.

---

## Důsledky

* **Snazší nasazení:** Guardrail se nasazuje a aktualizuje společně s celou aplikací přes standardní PR/GitHub flow.
* **Laditelnost:** Administrátor může v nastavení měnit úroveň přísnosti guardrailu (`off`/`mild`/`optimal`/`strict`), která se promítne okamžitě úpravou systémových promptů při dalším volání AI.
* **Runtime integrace:** Kód v `copywriter.js` zůstává čistý a pouze volá `buildSystemPrompt(...)`.

---

## Spouštěče budoucí revize (Triggers)

K přehodnocení tohoto rozhodnutí dojde v případě, že:
1. Pravidla pro guardrail narostou do gigantických rozměrů (stovky KB dat/regexů), které by výrazně zpomalily start workeru (cold start) nebo překročily bundle size limit Cloudflare Free tieru (1 MB).
2. Vznikne potřeba sdílet stejná pravidla a detekční logiku napříč více než 3 nezávislými aplikacemi/repozitáři MEVERIK.
