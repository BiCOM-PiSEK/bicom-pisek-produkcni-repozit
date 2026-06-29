# Plán implementace: GEO/SEO/AEO Marketingová Kaskáda & Reporting

Tento plán popisuje kroky k realizaci pokročilého lokalizovaného vyhledávání (GEO), optimalizace pro vyhledávače (SEO) a umělou inteligenci (AEO) včetně integrace analytického a mapového reportingu v administraci (virtuální kanceláři) Bicom Písek.

---

## 🗺️ Integrace Google API & Externí Zdroje (Checklist)

Pro dosažení světového standardu v reportování a akvizici využijeme bezplatné limity a kreditní programy od Google. Většina služeb spadá do **Free Tier** nebo má měsíční kredity pokrývající běžný provoz.

### 🔑 Co musí zajistit / připravit Uživatel:

1. **Google Cloud Platform (GCP) Projekt:**
   - Aktivovat **Fakturaci (Billing)** na GCP účtu (vyžadováno pro aktivaci a fungování Maps JavaScript API a Geocoding API).
   - Nastavit **rozpočtový strop (Budget Alert)** na GCP na 300 Kč měsíčně k absolutní kontrole nákladů a zamezení nechtěného překročení bezplatných kvót.

2. **Google Maps API Key:**
   - V GCP konzoli povolit **Maps JavaScript API** (zobrazení map) a **Geocoding API** (převod adres/PSČ na souřadnice).
   - Vygenerovat API klíč a omezit jej pouze na HTTP referer `https://bicom-pisek.cz/*` a lokální vývojové porty (bezpečnostní standard).

3. **Google Search Console (GSC) API Přístup:**
   - Vytvořit **Service Account** (servisní účet) v GCP projektu.
   - Stáhnout privátní klíč ve formátu JSON (ten bezpečně uložíme do Cloudflare environmentu jako tajnou proměnnou `GSC_SERVICE_ACCOUNT_JSON`).
   - V rozhraní Google Search Console přidat e-mailovou adresu tohoto Service Accountu jako uživatele s oprávněním "Omezený" (Restricted) nebo "Úplný" (Full) pro web `https://bicom-pisek.cz`.

4. **Google Business Profile (GBP):**
   - Ujistit se, že profil "Bicom Písek" je ověřený a data (adresa, telefon, otevírací doba) přesně odpovídají strukturovaným datům na webu (NAP konzistence).

5. **IndexNow API Key:**
   - Vygenerovat a umístit API klíč pro službu **IndexNow** (využívá Seznam.cz a Bing pro okamžitou indexaci změn obsahu a lokálních stránek).

---

## 💸 Odhad Provozních Nákladů (GCP & Cloudflare)

Všechny navržené nástroje jsou navrženy tak, aby se vešly do bezplatných limitů:
- **Google Maps JS API (zobrazení map):** Bezplatný limit pokrývá do 28 000 načtení dynamických map měsíčně (cca 900 zobrazení denně). Náš admin dashboard a lokální stránky spotřebují maximálně desítky načtení denně, což je hluboko pod limitem.
- **Google Geocoding API:** Bezplatná kvóta pokrývá do 40 000 požadavků měsíčně. Naše aplikace bude geokódovat pouze při uložení nových geo_leads, což je zanedbatelné množství.
- **Google Search Console API:** Zcela zdarma bez poplatků (limit je 10 000 volání na web za den).
- **IndexNow:** Zcela zdarma.
- **Cloudflare D1/KV/Pages:** V rámci bezplatného plánu (100 000 D1 zápisů/den, 10 milionů KV čtení/měsíc).

---

## 🚀 Krok za Krokem: Implementační Postup

### Krok 1: Inicializace a Nastavení Prostředí (GCP & Secrets)
- [ ] Vytvoření Service Accountu na GCP a stažení JSON klíče.
- [ ] Aktivace a zabezpečení Google Maps API klíče.
- [ ] Uložení API klíčů a Service Account JSON do Cloudflare:
  - `wrangler pages secret put GOOGLE_MAPS_API_KEY`
  - `wrangler pages secret put GSC_SERVICE_ACCOUNT_JSON`

### Krok 2: Backendový Geocoding & Analytický Engine
- [ ] **API Endpoint pro geolokační data (`functions/api/geo-leads.js`):**
  - Vytvořit API endpoint, který načte reálné zákazníky/poptávky z tabulky `geo_leads`.
  - Agreguje lokality podle H3 indexu (či PSČ) a vrátí souřadnice pro vykreslení na mapě.
- [ ] **API Endpoint pro Search Console (`functions/api/seo-analytics.js`):**
  - Implementovat backendový klient, který se pomocí Service Account JSON autentizuje vůči Google API.
  - Dotáže se na Google Search Console API a vytáhne klíčová slova, pro která se Bicom Písek zobrazuje (imprese, kliknutí, pozice), filtrovaná na regionální výrazy (např. "biorezonance Strakonice", "Bicom Blatná").

### Krok 3: Admin Reporting Dashboard v Administraci
- [ ] **UI Komponenta pro Geo-Leads a SEO report (`public/admin/js/modules/geo-dashboard.js`):**
  - Vytvořit moderní přehledový panel.
  - **GEO Sekce:** Integrace Google Maps (přes vložené Maps JS API) s vizualizací heatmapy (Heatmap Layer) nebo shluků (Marker Clusterer) reprezentujících poptávku z jednotlivých spádových měst.
  - **SEO/AEO Sekce:** Tabulkový a grafický přehled klíčových slov a dotazů z Google Search Console. Zobrazení trendu průměrné pozice pro lokální dotazy.
  - **AI Doporučení:** Modul, který na základě dojezdové mapy poptávek a vyhledávaných klíčových slov zformuluje doporučení (např. *"Zvyšuje se zájem v Milevsku, doporučujeme spustit lokální FB kampaň"*).

### Krok 4: SEO / AEO On-Page Optimalizace
- [ ] **Kanonizace a struktura:**
  - Odstranit z routeru a odkazů natvrdo `.html` přípony.
  - Nastavit hlavičky `_headers` na Cloudflare pro kanonické přesměrování a SPA fallbacky.
- [ ] **JSON-LD Schema na podstránkách služeb:**
  - Vytvořit skript nebo rozšířit stávající pro generování strukturovaných dat typu `MedicalProcedure` pro každý z 11 programů na podstránkách `/sluzby/*`.
- [ ] **IndexNow Integrace:**
  - Vytvořit skript, který při uvolnění nové verze CMS nebo aktualizaci stránek automaticky rozešle ping na IndexNow endpointy Seznamu a Bingu pro okamžitou re-indexaci.

### Krok 5: Verifikace a Měření
- [ ] Ověření funkčnosti Google Maps v admin konzoli.
- [ ] Ověření načítání dat z Search Console API.
- [ ] Testování rychlosti načítání nových stránek (Core Web Vitals) — cíl: LCP < 2.0s.

---

## 🗂️ Navrhované Změny v Souborech

### [NEW] [geo-leads.js](file:///C:/Users/PC/Documents/github/bicom-pisek-produkcni-repozit/functions/api/geo-leads.js)
- Serverless endpoint pro agregaci a anonymizaci geografických dat o poptávkách z DB.

### [NEW] [seo-analytics.js](file:///C:/Users/PC/Documents/github/bicom-pisek-produkcni-repozit/functions/api/seo-analytics.js)
- Serverless endpoint komunikující s Google Search Console API za použití JWT a Service Accountu.

### [NEW] [geo-dashboard.js](file:///C:/Users/PC/Documents/github/bicom-pisek-produkcni-repozit/public/admin/js/modules/geo-dashboard.js)
- Frontend modul administrace s Google Maps Heatmapou a SEO analytickými grafy.

### [MODIFY] [router.js](file:///C:/Users/PC/Documents/github/bicom-pisek-produkcni-repozit/public/assets/js/router.js)
- Registrace nového dashboardu v navigaci admin konzole.

---

## 🛡️ Bezpečnost Dat a Ochrana Soukromí (GDPR)

1. **Anonymizace v GEO mapách:**
   - Na mapě nebudou nikdy zobrazeny přesné adresy klientů (ochrana osobních údajů).
   - Geolokační body budou agregovány na úroveň obcí/měst nebo šumu (např. geokódování pouze na základě PSČ / H3 indexu rozlišení 7).
2. **Šifrování klíčů:**
   - JSON klíč od Google Service Accountu bude uložen výhradně v šifrovaných proměnných prostředí Cloudflare a nikdy nebude vystaven na klientské straně.
