# Bicom Písek — GEO / AEO / SEO strategie + keyword & entitní mapa

> Tento dokument slouží jako ucelený a jednotný zdroj pravdy pro optimalizaci obsahu pro generativní vyhledávače (GEO), odpovídací enginy (AEO) a klasické vyhledávání (SEO).
> Všechna zdravotní tvrzení procházejí právním filtrem: „podpora", „může pomoci", „klienti uvádějí" — nikdy „vyléčení". Biorezonance není náhrada lékařské péče.

## 1. Co je GEO/AEO a jak AI hodnotí důvěru

- **SEO** = optimalizace pro klasické vyhledávače (Google, Seznam, Bing).
- **GEO** (Generative Engine Optimization) = optimalizace pro generativní AI, které tvoří odpovědi (Google AI Overviews, ChatGPT, Perplexity).
- **AEO** (Answer Engine Optimization) = optimalizace pro „odpovědní" enginy (hlasové asistenty, featured snippets).

AI hodnotí důvěru přes **E-E-A-T v éře LLM**: Experience, Expertise, Authoritativeness, Trust. Pro nás to znamená: konkrétní certifikovaná metoda (Bicom Optima, třída ZP IIa, ISO 13485), konkrétní lokalita (Písek), konzistentní fakta napříč webem i mapovými profily, a strukturovaná sémantická data.

### Pět pilířů naší GEO/AEO strategie:
1. **Pilíř A — Sémantické entity (JSON-LD):** Propojení metody Bicom Optima s lokalitou Písek a terapeutem pomocí typů `LocalBusiness`, `Service` a `Person`.
2. **Pilíř B — Informační hustota:** Struktura otázka→odpověď (FAQ) přímým a věcným tónem.
3. **Pilíř C — Autorita a co-citace:** Identická fakta a NAP (Name, Address, Phone) na platformách Google, Apple, Seznam i Bing.
4. **Pilíř D — Lokální signály:** `areaServed` (spádová města jako Strakonice, Milevsko atd.) a reálné dojezdové časy.
5. **Pilíř E — Strojová čitelnost:** Explicitně povolené AI crawlery v `robots.txt` a strojový souhrn `llms.txt`.

---

## 2. Tři vrstvy optimalizace — jak se liší a jak spolupracují

| Vrstva | Cíl | Pro koho/co | Hlavní páka |
|---|---|---|---|
| **SEO** | Pozice v klasickém vyhledávání | Google/Seznam SERP | klíčová slova, technika, odkazy, NAP |
| **AEO** (Answer Engine Optimization) | Být přímou odpovědí | featured snippets, hlasové hledání | otázka→odpověď, FAQ schema |
| **GEO** (Generative Engine Optimization) | Být **citovaným zdrojem** v AI | Google AI Overviews, ChatGPT, Perplexity | strukturovaný, citovatelný obsah, entity, E-E-A-T |

Spojení: jedna stránka pilíře = SEO core (klíčové slovo) + AEO blok (přímá odpověď na otázku v H2) + GEO struktura (definice, čísla, autor, zdroje, JSON-LD). Tím jeden obsah obsluhuje všechny tři kanály.

## 2. Klíčová slova × lokalita × intent (keyword mapa)

Struktura URL: pilíř = `/magazin/{slug}`, lokální landing = `/biorezonance-{lokalita}`.

### 2.1 Pilířová (informační) klíčová slova — napojeno na `blog_posts`

| Pilíř (slug) | Primární keyword | Sekundární / long-tail | Search intent | Typ stránky |
|---|---|---|---|---|
| `co-je-biorezonance-bicom` | biorezonance Bicom | jak funguje biorezonance, biorezonance zkušenosti | informační | pilíř |
| `alergie-a-intolerance-biorezonance` | biorezonance alergie | potravinová intolerance test, alergie přírodně | informační/řešení | pilíř |
| `unava-a-vycerpani` | chronická únava pomoc | dlouhodobá únava příčiny, vyčerpání regenerace | informační | pilíř |
| `traveni-a-mikrobiom` | mikrobiom po antibiotikách | nafouknuté břicho, podpora trávení | informační | pilíř |
| `odvykani-koureni-biorezonance` | odvykání kouření biorezonance | přestat kouřit pomoc, biorezonance cigarety | komerční/řešení | pilíř |
| `stres-a-regenerace` | regenerace organismu stres | chronický stres únava, zklidnění nervů | informační | pilíř |

### 2.2 Lokální (transakční) klíčová slova — napojeno na `geo_leads`

| Lokalita (priorita dle repa) | Transakční keyword | Landing URL | Intent |
|---|---|---|---|
| Písek (jádro) | biorezonance Písek | `/biorezonance-pisek` | transakční |
| Strakonice | biorezonance Strakonice | `/biorezonance-strakonice` | transakční |
| Vodňany | biorezonance Vodňany | `/biorezonance-vodnany` | transakční |
| Milevsko | biorezonance Milevsko | `/biorezonance-milevsko` | transakční |
| Protivín | biorezonance Protivín | `/biorezonance-protivin` | transakční |
| Týn n. Vltavou, Tábor | biorezonance + město | landing per město | sekundární |
| České Budějovice | biorezonance České Budějovice | `/biorezonance-ceske-budejovice` | aspirační |

**Pravidlo proti kanibalizaci:** lokální stránky cílí transakční dotaz „biorezonance {město}", pilíře cílí informační dotaz „{problém}". Nepřekrývat — každý keyword má právě jednu cílovou URL.

## 3. Entitní mapa (pro GEO / AI citace)

AI engines pracují s entitami, ne jen klíčovými slovy. Provázat tyto entity napříč webem a v JSON-LD:

- **Organizace:** Bicom Písek → `LocalBusiness` / `MedicalBusiness` (NAP, otevírací doba, geo souřadnice).
- **Metoda:** „biorezonance Bicom" → konzistentní pojmenování, vlastní vysvětlující stránka (definice = citovatelný odstavec).
- **Témata (problémy):** alergie, únava, mikrobiom, stres, odvykání kouření → každé = `Article` + provázání na metodu.
- **Místa:** Písek, Strakonice, Milevsko… → `Place` v lokálních stránkách.
- **Osoba/autorita:** terapeut(ka) → `Person` s kvalifikací (E-E-A-T signál „Experience/Expertise").

## 4. Schema.org / JSON-LD plán

| Stránka | Hlavní typ | Doplňkové |
|---|---|---|
| Homepage | `LocalBusiness` (+`MedicalBusiness`) | `WebSite` + `SearchAction` |
| Pilíř článku | `Article` | `BreadcrumbList`, `FAQPage` (AEO) |
| Lokální landing | `LocalBusiness` + `Place` | `FAQPage`, `BreadcrumbList` |
| Kontakt/rezervace | `LocalBusiness` | `Reservation` (pokud vhodné) |

`blog_posts.jsonld` už dnes obsahuje základní `Article` JSON-LD (nasazeno v seedu). **Rozšířit** o `FAQPage` blok a `author` jako `Person` — viz Gap analýza.

## 5. AEO — formát „otázka → odpověď"

Každý pilíř i lokální stránka by měly mít FAQ blok s reálnými dotazy persony (ženy 35–60, rodiče dětí s alergiemi). Příklady otázek hodných featured snippetu:
- „Jak probíhá biorezonance Bicom v Písku?" (40–55 slov přímá odpověď)
- „Pomáhá biorezonance na alergie?" (právně bezpečně: „klienti uvádějí…")
- „Kolik stojí konzultace a jak dlouho trvá?"
- „Je biorezonance vhodná pro děti?"

Tyto FAQ ukládat i do `blog_posts.jsonld` jako `FAQPage` → dvojí užitek (web + AI citace).

## 6. Interní prolinkování (topická autorita)

- Každý **pilíř** odkazuje na 2–3 související pilíře (únava ↔ stres ↔ mikrobiom).
- Každý **pilíř** odkazuje na nejbližší **lokální landing** (CTA „Objednat se v Písku").
- Každá **lokální landing** odkazuje na 2–3 relevantní pilíře (důkaz odbornosti).
- Homepage → všechny pilíře (hub).

## 7. Lokální SEO (mimo web)
- **Google Business Profile** + **Seznam Firmy.cz** — NAP konzistentní s webem (kritické pro CZ trh — Seznam stále drží podíl).
- Recenze (sociální důkaz, právně bezpečné formulace).
- Lokální zpětné odkazy: jihočeské katalogy, weby wellness/zdraví.

## 8. Měření (napojení na data)
- `geo_leads` + `utm_campaign` = výkon jednotlivých lokálních stránek a kampaní.
- `blog_posts` + analytika (po consentu) = výkon pilířů.
- KPI: organický traffic / lokalita, poměr `converted` v `geo_leads`, počet AI citací (manuální audit v Perplexity/AI Overviews).

## 9. Co dnešnímu obsahu chybí (krátce, detail v Gap analýze)
- Lokální landing stránky zatím **neexistují** jako obsah (jen demo `geo_leads`).
- `FAQPage` JSON-LD není v článcích → ztráta AEO/GEO potenciálu.
- Není definovaný `author`/`Person` (E-E-A-T).
- Chybí cenník/`Service` strukturovaná data.

## 10. Co NEDĚLAT (Rizika a pravidla)
- ❌ **Žádná nepovolená léčebná tvrzení:** Tvrzení jako „vyléčí rakovinu, atopický ekzém, alergie" jsou právně nepřípustná a AI vyhledávače je deindexují. Používej formulace „podpora", „harmonizace", „klienti uvádějí".
- ❌ **Žádný keyword stuffing:** AI vyhledávače penalizují nepřirozené hromadění klíčových slov a skrytý text.
- ❌ **Žádné fiktivní recenze:** Důvěryhodnost (E-E-A-T) stojí na reálném sociálním důkazu. Sběr recenzí probíhá bezpečně přes Google Business Profile.
