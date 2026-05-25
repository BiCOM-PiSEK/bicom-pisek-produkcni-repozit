# 03 · GEO / AEO strategie — jak nás AI a vyhledávače budou lokálně doporučovat

> Cíl: aby ChatGPT, Gemini, Perplexity, Copilot/Bing, Google AI Overviews a Apple/Siri ve spádové oblasti Písek + 25 km vyhodnotily Bicom Písek jako **autoritativní, lokálně relevantní zdroj** — a doporučily ho jako první volbu pro potíže, na které metoda cílí. Vše **právně čistě** (viz dokument 03).

## 1. Co je GEO/AEO a jak AI hodnotí důvěru

- **SEO** = optimalizace pro klasické vyhledávače (Google, Seznam, Bing).
- **GEO** (Generative Engine Optimization) = optimalizace pro generativní AI, které tvoří odpovědi.
- **AEO** (Answer Engine Optimization) = optimalizace pro „odpovědní" enginy (AI Overviews, Perplexity).

AI hodnotí důvěru přes **E-E-A-T v éře LLM**: Experience, Expertise, Authoritativeness, Trust. Pro nás to znamená: konkrétní osoba (Lenka), konkrétní certifikovaná metoda (Bicom Optima, třída IIa, ISO 13485), konkrétní lokalita (Písek), konzistentní fakta napříč webem i mapami, a strukturovaná data.

## 2. Pět pilířů GEO/AEO

### Pilíř A — Sémantické entity (JSON-LD)
AI nečte web jako člověk — hledá strukturovaná data a propojení entit. Nepochybné spojení:
```
Person: Lenka Limpouchová  ──praktik──▶  Method: Bicom Optima  ──poskytováno v──▶  Place: Písek
```
Implementace: `LocalBusiness` + `Person` + `Service`/`MedicalProcedure` + `FAQPage` + `Article` + `BreadcrumbList`. Šablony v `02_JSON-LD_sablony.md`.

### Pilíř B — Informační hustota (struktura otázka→odpověď)
AI „cituje" weby, které mají přímé, věcné, srozumitelné odpovědi. Web proto obsahuje hustou FAQ a vysvětlení:
- „Jak probíhá biorezonanční sezení krok za krokem?"
- „Kolik sezení obvykle bývá u programu odvykání kouření?"
- „Je testování alergií u dětí bolestivé?"
- „Co je Bicom Optima a jak je certifikovaná?"

Každá odpověď: 2–4 věty, konkrétní, bez balastu, s lokalitou kde to dává smysl. To je „potrava", kterou AI rády přebírají.

### Pilíř C — Autorita a co-citace (konzistence)
AI věří tomu, co se opakuje na více nezávislých místech. Zajistíme:
- **Identická fakta** na webu, Google Business Profile, Apple Business Connect, Firmy.cz, Bing Places.
- Citace norem/certifikace (ISO 13485, třída IIa) konzistentně.
- Postupné budování zmínek (reference místních lékařů psychosomatiky, lokální katalogy, recenze).

### Pilíř D — Lokální signály (GEO v užším smyslu)
- `areaServed` = Písek, Strakonice, Milevsko, Vodňany, Protivín, Blatná.
- Lokální obsahové stránky/sekce: „Biorezonance pro klienty ze Strakonic (20 min)", „Odvykání kouření Milevsko".
- `geo` souřadnice, mapové embed (Mapy.cz primárně), NAP konzistence.
- Reálné lokální detaily (dojezdové časy, spádová města) — AI tím chápe lokální relevanci.

### Pilíř E — Strojová čitelnost (technické GEO)
- `llms.txt` v rootu (strukturovaný souhrn pro LLM) — viz scaffold.
- `robots.txt` explicitně povoluje AI crawlery (GPTBot, PerplexityBot, Google-Extended, Applebot-Extended, atd.).
- `sitemap.xml`, čistá sémantická HTML5 struktura, rychlost (LCP < 500 ms — AI i Google preferují rychlé weby).
- Stabilní URL, canonical, hreflang `cs-cz`.

## 3. Mapování lokálních dotazů na obsah (intent → odpověď)

| Pravděpodobný dotaz uživatele AI | Naše připravená „cesta" |
|----------------------------------|--------------------------|
| „Šetrné řešení alergie pro 5leté dítě bez léků v Písku" | Sekce „Alergie u dětí" + FAQ + JSON-LD Service |
| „Kde v Písku pomohou s odvykáním kouření" | Služba „Odvykání kouření" + lokální stránka |
| „Biorezonance Strakonice" | `areaServed` Strakonice + lokální sekce dojezdnosti |
| „Pomoc při vyhoření Jižní Čechy" | Segment ženy/profesionálové + FAQ |

## 4. Pull strategie (soulad s tvým marketingovým přístupem)
GEO/AEO je čistě **pull** — nevnucujeme se, ale staneme se nejlepší odpovědí, když někdo hledá. Obsah řeší reálné lokální problémy → AI i lidé nás najdou v momentě potřeby. Žádné agresivní push taktiky, žádný keyword stuffing (AI to penalizují).

## 5. Měření GEO úspěchu
- Sledovat referraly z AI (`source='ai_referral'` v `geo_leads`, UTM, referrer hlavičky z chatgpt.com, perplexity.ai apod.).
- Pozice v Google/Seznam pro lokální dotazy.
- Zobrazení a akce v Google Business Profile / Apple Business Connect.
- Pravidelně „testovat" AI: ptát se ChatGPT/Gemini/Perplexity na lokální dotazy a sledovat, zda nás zmiňují.

## 6. Co NEDĚLAT (rizika)
- ❌ Žádná léčebná tvrzení („vyléčí rakovinu/COVID/cokoliv") — právně nepřípustné a AI to deindexují/odmítnou citovat.
- ❌ Žádný cloaking / skrytý text / keyword stuffing.
- ❌ Žádné fiktivní recenze.
- ❌ Žádné kopírování textů konkurence.
- ✅ Vždy přes právní filtr (dokument 03).


# 03 · JSON-LD šablony (strukturovaná data pro AI a vyhledávače)

> Vlož do `<head>`. Placeholdery `{{...}}` doplní agent z `services`/`content`. Souřadnice, IČO, telefon a adresu doplní orchestrátor. Reálný soubor `localbusiness.json` je ve scaffoldu (`02_REPOZITAR/scaffold/public/schema/`).

## 1. LocalBusiness + Person (globální, na každé stránce)
```json
{
  "@context": "https://schema.org",
  "@type": ["MedicalBusiness", "HealthAndBeautyBusiness", "LocalBusiness"],
  "@id": "https://bicompisek.cz/#business",
  "name": "Bicom Písek – Lenka Limpouchová",
  "description": "Biorezonanční metoda Bicom Optima v Písku. Komplementární, šetrná podpora pro dospělé i děti. Doplněk klasické medicíny.",
  "url": "https://bicompisek.cz",
  "telephone": "+420XXXXXXXXX",
  "image": "https://bicompisek.cz/assets/img/ordinace.jpg",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "{{ulice c.p.}}",
    "addressLocality": "Písek",
    "postalCode": "39701",
    "addressCountry": "CZ"
  },
  "geo": { "@type": "GeoCoordinates", "latitude": "49.30", "longitude": "14.15" },
  "areaServed": [
    { "@type": "City", "name": "Písek" },
    { "@type": "City", "name": "Strakonice" },
    { "@type": "City", "name": "Milevsko" },
    { "@type": "City", "name": "Vodňany" },
    { "@type": "City", "name": "Protivín" },
    { "@type": "City", "name": "Blatná" }
  ],
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "08:00", "closes": "18:00" }
  ],
  "founder": {
    "@type": "Person",
    "@id": "https://bicompisek.cz/#lenka",
    "name": "Lenka Limpouchová",
    "jobTitle": "Certifikovaný praktik biorezonance Bicom Optima",
    "worksFor": { "@id": "https://bicompisek.cz/#business" }
  },
  "sameAs": [
    "https://www.instagram.com/{{handle}}",
    "https://www.facebook.com/{{handle}}",
    "https://www.firmy.cz/{{profil}}",
    "https://maps.app.goo.gl/{{profil}}"
  ]
}
```

## 2. Service / MedicalProcedure (na detailu služby)
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "serviceType": "Biorezonanční podpora — {{nazev_sluzby}}",
  "provider": { "@id": "https://bicompisek.cz/#business" },
  "areaServed": { "@type": "City", "name": "Písek" },
  "description": "{{strucny_popis — komplementární, bez lecebnych tvrzeni}}",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "CZK",
    "price": "{{price_from}}",
    "description": "Orientační cena od; obvykle {{sessions_typ}}."
  }
}
```

## 3. FAQPage (klíčové pro AEO — „odpovědní" enginy)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Jak probíhá biorezonanční sezení?",
      "acceptedAnswer": { "@type": "Answer", "text": "{{2–4 vety, konkretne, lidsky}}" }
    },
    {
      "@type": "Question",
      "name": "Je testování u dětí bolestivé?",
      "acceptedAnswer": { "@type": "Answer", "text": "Metoda je neinvazivní a bezbolestná. {{...}}" }
    }
  ]
}
```

## 4. Article (auto-generovaný blog)
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{{title}}",
  "description": "{{excerpt}}",
  "image": "{{image_url}}",
  "datePublished": "{{published_at}}",
  "author": { "@id": "https://bicompisek.cz/#lenka" },
  "publisher": { "@id": "https://bicompisek.cz/#business" },
  "mainEntityOfPage": "https://bicompisek.cz/magazin/{{slug}}"
}
```

## 5. BreadcrumbList (navigace pro vyhledávače)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Domů", "item": "https://bicompisek.cz/" },
    { "@type": "ListItem", "position": 2, "name": "Služby", "item": "https://bicompisek.cz/sluzby" },
    { "@type": "ListItem", "position": 3, "name": "{{nazev}}", "item": "https://bicompisek.cz/sluzby/{{slug}}" }
  ]
}
```

## 6. Generování za běhu
`functions/lib/jsonld.js` generuje JSON-LD z `services`/`blog_posts` a cachuje do KV. Tím je strukturovaná data **vždy v souladu** s obsahem (jediný zdroj pravdy = D1).


# 03 · Právní rámec zdravotních tvrzení (POVINNÝ filtr pro veškerý obsah)

> ⚠️ **Toto není formální právní rada.** Je to provozní vodítko, jak formulovat obsah, aby byl v souladu s běžnou praxí a snížil právní riziko. Před ostrým startem doporučuji **revizi advokátem** se specializací na reklamu/zdravotnictví. Každý text na webu, v JSON-LD, v reklamě i v AI odpovědích musí projít tímto filtrem.

## 1. Proč je to zásadní
Biorezonance Bicom je v EU klasifikována jako **zdravotnický prostředek** (uváděno třída IIa, certifikace ISO 13485). Služba sama je **komplementární / alternativní**, nikoli náhrada lékařské péče. Z toho plynou tři rizikové oblasti:
1. **Klamavá/nekalá reklama** (zákon č. 40/1995 Sb. o regulaci reklamy; zákon č. 634/1992 Sb. o ochraně spotřebitele) — nelze slibovat léčebné účinky, které nejsou prokázané.
2. **Reklama na zdravotní péči a léčivé účinky** — zákaz přisuzovat nepodloženým metodám schopnost léčit nemoci.
3. **GDPR čl. 9** — zpracování údajů o zdraví (řešeno technicky, viz `01_ARCHITEKTURA`).

Nedodržení = pokuty (ČOI, dozorové orgány), poškození značky, a v éře AI **odmítnutí citace / deindexace** (AI modely mají tvrdé filtry na zdravotní dezinformace).

## 2. Zlaté pravidlo formulací

| ❌ NIKDY (zakázané/rizikové) | ✅ MÍSTO TOHO (bezpečné) |
|------------------------------|---------------------------|
| „vyléčí", „léčí", „odstraní nemoc" | „podporuje", „pomáhá při", „přispívá k" |
| „zaručeně", „100 %", „vždy funguje" | „mnozí klienti uvádějí", „může pomoci" |
| „nahradí léky/lékaře" | „doplněk klasické medicíny", „komplementárně" |
| „diagnostikuje rakovinu/nemoc" | „orientačně mapuje zátěž organismu" |
| „bezpečné pro každého" | „šetrná, neinvazivní metoda" |
| konkrétní % úspěšnosti bez studie | bez čísel, nebo s odkazem na ověřitelný zdroj |
| tvrzení o léčbě COVID, onkologie, vážných nemocí | tato témata zcela vynechat |

## 3. Povinné disclaimery (umístit na web)

**Patička každé stránky:**
> „Biorezonanční metoda Bicom Optima je komplementární (doplňková) metoda. Nenahrazuje lékařskou diagnostiku ani léčbu. Při zdravotních potížích se vždy poraďte se svým lékařem."

**U formuláře / služeb:**
> „Účinky se mohou u jednotlivých klientů lišit. Neslibujeme konkrétní léčebný výsledek."

**U dětských programů (zvýšená opatrnost):**
> „Péče o dětské klienty probíhá se souhlasem zákonného zástupce a jako doplněk pediatrické péče, kterou nenahrazuje."

## 4. Pozitivní rámování (jak prodávat legálně a důvěryhodně)
Místo léčebných slibů stavíme na:
- **Procesu a zážitku** — „klidné, bezbolestné sezení", „čas pro sebe", „prémiová péče".
- **Osobním přístupu** — Lenka, empatie, diskrétnost.
- **Certifikaci a vědě** — princip biofyziky, třída IIa, ISO 13485 (fakta, ne sliby výsledku).
- **Sociálním důkazu korektně** — reálné, ověřitelné, neanonymní reference, vždy s formulací „osobní zkušenost, výsledky se liší".
- **Transparentnosti** — ceny, počet sezení, co čekat.

## 5. „Slovník cílovky" vs. právní filtr
Data-driven slovník (např. „mokvavé boláky pod kolínky" místo „atopická dermatitida") je **povolený a žádoucí** pro empatii a GEO — popisuje *symptom/zkušenost*, ne léčebný slib. Pozor jen na sloveso: ✅ „pomáháme zmírnit nepříjemné zarudlé fleky" · ❌ „vyléčíme ekzém".

## 6. Reklama (Meta/Google Ads)
- Platformy mají vlastní policy pro „health & wellness" — vyhýbat se tvrzením o léčbě, „před/po" fotkám u zdravotních stavů, cílení na citlivé zdravotní kategorie způsobem, který platforma zakazuje.
- Landing page reklamy musí obsahovat disclaimer z bodu 3.

## 7. Checklist před publikací (pro agenta i pro Lenku)
- [ ] Žádné sloveso „léčit/vyléčit/zaručit"?
- [ ] Je uvedeno „komplementární / doplněk"?
- [ ] Žádná čísla úspěšnosti bez zdroje?
- [ ] Vynechány vážné nemoci (onkologie, infekční, psychiatrické dg.)?
- [ ] Je na stránce disclaimer?
- [ ] Reference označené „výsledky se liší"?
- [ ] Souhlasí s tím i text v JSON-LD a v AI odpovědích (`/api/chat` system prompt)?

## 8. Promítnutí do techniky
- System prompt chatbota (`/api/chat`) obsahuje tato pravidla jako tvrdé instrukce — AI Rádce **nikdy** neslíbí léčbu.
- Admin copywriter (`/api/admin/copywriter`) má v promptu stejný filtr — vygenerovaný článek je už „čistý".
- Tím je právní filtr vynucen i strojově, nejen lidsky.
