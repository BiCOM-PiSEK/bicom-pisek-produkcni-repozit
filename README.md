# 🌿 Bicom Písek — Virtual Office & produkční web

Verze: **v1.0 RC — aktivní finalizace před předáním**

Hlavní produkční repozitář organizace **BiCOM-PiSEK** (`bicom-pisek-produkcni-repozit`). Tento repozitář představuje autoritativní zdroj pravdy (Single Source of Truth) pro celé technologické a programové řešení lokálního centra. Projekt je navržen a realizován podle standardu **MEVERIK STUDIO** s využitím moderní architektury **Edge-First** – veškerá aplikační logika, databáze i umělá inteligence běží na okraji sítě (Edge), což zajišťuje bleskovou odezvu (typicky < 200 ms), vysokou spolehlivost a nulové fixní provozní náklady za pronájem klasických serverů.

**Provozovatel:** BIO ONE LIFE s.r.o. (klient)  
**Dodavatel:** WHC s.r.o. / MEVERIK STUDIO

> ⚠️ **Právní vymezení:** Biorezonanční metoda BICOM Optima je komplementární (doplňková) metoda. Nenahrazuje standardní lékařskou péči, diagnostiku ani klinickou léčbu. Provozovatel neposkytuje zdravotní služby ve smyslu zákona č. 372/2011 Sb., o zdravotních službách. Všechny prezentované texty a výstupy AI nástrojů jsou důsledně podrobeny tomuto tónu.

**Kanonická doména:** [bicom-pisek.cz](https://bicom-pisek.cz)

---

## 🏗️ Celková architektura ekosystému

Projekt je kompletně integrován v rámci globální infrastruktury Cloudflare. Následující diagram znázorňuje tok požadavků od uživatele, přes bezpečnostní filtry, aplikační vrstvu na Edge, až po asynchronní zpracování na pozadí a externí integrace.

```mermaid
flowchart TD
    subgraph Edge ["Edge & Security Layer (Cloudflare)"]
        DNS["Cloudflare DNS & WAF\n(DDoS Protection, Bot Mgmt, TLS 1.3)"]
        Access["Cloudflare Access\n(Zero Trust SSO, One-Time PIN pro Admin)"]
    end

    subgraph Frontend ["Frontend Web Applications"]
        PublicWeb["Veřejný portál (Pages)\n(HTML5, Tailwind, Vanilla SPA)"]
        AdminSPA["Virtual Office SPA (Pages)\n(Administrace, Vanilla JS, CSS grid)"]
    end

    subgraph Logic ["Logic & API Layer (CF Pages Functions & Workers)"]
        API["Pages Functions API\n(Request Router, Rate Limiter)"]
        BookingConsumer["Booking Consumer (Worker)\n(Zpracování rezervační fronty)"]
        SocialConsumer["Social Consumer (Worker)\n(Zpracování sociální fronty)"]
        CronWorker["Cron Trigger Worker\n(7 automatizovaných úloh)"]
    end

    subgraph AI ["AI Services (Cloudflare Workers AI)"]
        WorkersAI["Workers AI\n(Model Llama 3)"]
        AIFallback["Trojitý fallback řetězec\n(Workers AI ➔ Groq ➔ Gemini)"]
    end

    subgraph Data ["Data & Storage Layer"]
        D1["Cloudflare D1 (SQLite Database)\n- 14 schválených tabulek (GDPR AES-GCM)"]
        R2["Cloudflare R2\n(bicom-multimedia bucket)"]
        KV["Cloudflare KV\n(Cache, Rate Limiting, Config)"]
    end

    subgraph Async ["Asynchronous Job Queues"]
        BookingQueue["CF Queue: booking-jobs"]
        SocialQueue["CF Queue: social-jobs"]
    end

    subgraph External ["External Integrations"]
        GCal["Google Calendar API\n(Termíny & Operátoři)"]
        GW["Google Workspace\n(Gmail Mailer)"]
        Resend["Resend API\n(Transactional Email)"]
        GoSMS["GoSMS API\n(SMS upomínky)"]
        MetaGraph["Meta Graph API\n(Instagram Sync)"]
        iDoklad["iDoklad API\n(Fakturace)"]
        Stripe["Stripe API\n(Platební zálohy)"]
        Telegram["Telegram API\n(Monitoring & Cashflow)"]
    end

    %% Propojení prvků a datové toky
    DNS --> PublicWeb
    DNS --> Access
    Access --> AdminSPA
    
    PublicWeb --> API
    AdminSPA --> API
    
    API --> BookingQueue
    API --> SocialQueue
    API --> KV
    API --> D1
    
    BookingQueue --> BookingConsumer
    SocialQueue --> SocialConsumer
    
    BookingConsumer --> GCal
    BookingConsumer --> GW
    BookingConsumer --> Resend
    BookingConsumer --> GoSMS
    BookingConsumer --> iDoklad
    BookingConsumer --> Telegram
    
    API --> WorkersAI
    WorkersAI --> AIFallback
    
    CronWorker --> D1
    CronWorker --> R2
    CronWorker --> Telegram
    CronWorker --> MetaGraph
```

---

## 🛠️ Technologický Stack

Architektura je postavena na principu **Edge-First, Cloudflare-native**. Produkční repozitář představuje optimalizovanou a stabilní předatelnou výseč širší platformy MEVERIK STUDIO, přičemž je plně zachován zero-cost provozní model a maximální bezpečnost.

| Vrstva | Technologie | Funkce v systému |
| :--- | :--- | :--- |
| **Edge Runtime & DNS** | Cloudflare DNS, WAF | Ochrana sítě, TLS 1.3 certifikace, WAF pravidla, rate-limiting a bot management. |
| **Frontend** | HTML5, CSS3 (Vanilla CSS + Tailwind), Vanilla ES6 JS | Rychlý static web (Pages) bez zbytečného JS overheadu, responzivní layouty, plynulé přechody (View Transitions API). |
| **Backend & Logika** | Cloudflare Pages Functions, Cloudflare Workers | Serverless API endpointy, zprostředkování datových toků, zpracování událostí v reálném čase. |
| **Relační databáze** | Cloudflare D1 (SQLite na okraji sítě) | Transakční databáze (14 tabulek) s CHECK constrainty, cizími klíči a indexy. |
| **Stavová Cache & Limiter** | Cloudflare KV | Rychlá distribuovaná cache, koordinace rate-limiteru a ukládání konfiguračních stavů. |
| **Blob Storage** | Cloudflare R2 | Bezúdržbový bucket pro obrázky a média (nulový egress poplatek). |
| **Asynchronní fronty** | Cloudflare Queues | Zpracování úloh na pozadí (booking consumer, social consumer) odolné vůči výpadkům třetích stran. |
| **Umělá inteligence** | Cloudflare Workers AI, Groq, Gemini API | Integrace lokálního modelu Llama 3 s fallback řetězcem přes Groq na Gemini API. |
| **Administrativní Auth** | Cloudflare Access (Zero Trust) | Zabezpečení administrativní zóny Virtual Office, One-Time PIN přihlašování přes registrované e-maily. |

---

## 🌟 Klíčové Funkce

- **Moderní asynchronní rezervace:** Uživatel odešle poptávku termínu přes interaktivního průvodce. API okamžitě zašifruje data, uloží požadavek do D1 a zařadí jej do asynchronní fronty (`booking-jobs`). Booking Consumer následně na pozadí zapíše událost do Google kalendáře, vygeneruje a odešle e-mail přes Resend a SMS upomínku přes GoSMS.
- **GDPR Security & Field-level šifrování:** Osobní údaje (jméno, e-mail, telefon, poznámka) jsou před zápisem do DB šifrovány pomocí standardu AES-GCM (256-bit, Web Crypto API) dle článku 9 GDPR. Dešifrovací klíč žije v bezpečném prostředí a data se dešifrují až na klientu v administraci.
- **Automatická anonymizace (GDPR cron):** Cron worker denně vyhledává a anonymizuje data rezervací starší než 30 dní (nahrazení citlivých polí prázdným řetězcem `''`), čímž splňuje legislativní minimalizaci dat. Ukládá se pouze auditní log o provedené akci.
- **AI Copywriter s právním guardrailem:** Generátor textů v admin SPA ("Quiet Luxury" tón) s modulární právní bariérou (rules-health) a 4 úrovněmi přísnosti (`off`, `mild`, `optimal`, `strict`) řízenými z nastavení. Zabraňuje generování nepovolených medicínských tvrzení (červená a oranžová zóna rizikových frází) a navrhuje bezpečná synonyma.
- **AI Rádce (Chatbot):** Veřejný chatovací widget napojený na Workers AI, poskytující odpovědi na dotazy s dynamickým právním filtrem a trojitým fallbackem.
- **Bezúdržbový blog / Instagram Sync:** Cron worker stahuje příspěvky z Instagramu a ukládá je do R2, čímž automaticky plní sekci Magazínu na webu bez nutnosti ručního psaní článků.
- **GEO-Marketing & Analytics:** Sběr a vyhodnocování geografických dat (leadů) na základě PSČ a měst pro doporučování a optimalizaci regionálních kampaní.
- **Virtual Office SPA:** Kompletní administrativní konzole (Dashboard s KPI a trendy, Kalendář, Blog a AI nástroje, Fakturace, GEO přehledy, Nastavení).

---

## 🔗 Registr API a Endpointů

### Veřejné API (`/api/*`)
- `GET /api/services` — Načtení katalogu programů z D1 s fallbackem na KV cache.
- `POST /api/book` — Zpracování poptávky termínu, šifrování osobních dat a zápis do fronty.
- `GET /api/booking-config` — Veřejné načtení toggle stavů nastavení (např. nutnost Stripe platby).
- `POST /api/newsletter` — Přihlášení k newsletteru s kontrolou duplicity a šifrováním.
- `POST /api/chat` — AI Rádce na webu s napojením na databázový kontext FAQ a služeb.
- `GET /api/blog` — Výpis blogových příspěvků a IG sync článků pro veřejný Magazín.
- `GET/POST /api/calendar-hook` — Webhook pro synchronizaci změn z Google kalendáře zpět do D1.
- `POST /api/stripe-checkout` — Inicializace platby zálohy na Stripe.
- `POST /api/stripe-webhook` — Zpracování potvrzení platby a dokončení rezervace.
- `GET /api/health` — Diagnostika zdraví databáze, cache, front a nastavení.

### Administrační API (`/admin/*` — pod ochranou CF Access)
- `GET /admin/dashboard` — Agregovaná data, statistiky, trendy a seznam posledních rezervací.
- `GET/PUT /admin/bookings` — Správa a dešifrování rezervací s automatickým zápisem do audit logu.
- `POST /admin/copywriter` — Generování obsahu s dynamickým právním guardrailem.
- `GET/PUT /admin/settings` — Čtení a zápis konfiguračních klíčů z process_states.
- `GET /admin/activity` — Logování uživatelských a systémových akcí (Audit Log).
- `GET /admin/geo` — Geografická distribuce leadů a analýza lokalit.
- `GET /admin/invoices` — Synchronizace a přehled faktur z iDokladu.

---

## 🔌 Integrace třetích stran

| Služba | Účel integrace | Stav |
| :--- | :--- | :--- |
| **Google Calendar & Workspace** | Zápis a čtení termínů rezervací, organizace kalendáře. | Integrováno; Domain-Wide Delegation ověřena přes `admin@bicom-pisek.cz` |
| **Resend** | Odesílání transakčních e-mailů s potvrzením rezervací a upomínkami. | Integrováno; ověření doručitelnosti před spuštěním |
| **GoSMS** | Odesílání SMS upomínek 24h před konáním biorezonance. | Integrováno; aktivace kreditu před spuštěním |
| **Meta Graph API** | Synchronizace příspěvků z Instagramu pro Magazín. | Integrováno; čeká na schválení Meta App Review |
| **iDoklad** | Automatické vystavování zálohových a řádných faktur. | Mechanika hotová; chybí produkční klíče a ostrý test |
| **Stripe** | Zpracování plateb online záloh na rezervované termíny. | Mechanika hotová; chybí produkční klíče, webhook a live test |
| **Telegram** | Monitoring cashflow, chybových hlášení a denních/týdenních statistik. | Aktivní |

---

## 🔒 Bezpečnost & GDPR

Projekt je od počátku navržen v souladu s nařízením **GDPR** (článek 9 – zpracování zvláštních kategorií osobních údajů):
1. **Cloudflare Access (Zero Trust):** Celá administrativní sekce `/admin/*` je chráněna přes identity provider na Cloudflare. Vstup je povolen pouze schváleným e-mailům přes jednorázové kódy (PIN).
2. **Field-level šifrování (AES-GCM):** Citlivé údaje (jména, kontakty, poznámky o zdravotním stavu) jsou v databázi uloženy v šifrovaném formátu. Dešifrování probíhá lokálně na klientovi po přihlášení do admin sekce.
3. **Minimalizace dat:** Po uplynutí 30 dní od konání rezervace jsou citlivé osobní údaje automaticky odstraněny (nahrazeny prázdným řetězcem `''`).
4. **Auditování:** Každá manipulace s citlivými údaji (čtení/dešifrování, úprava, smazání) je zapsána do nezměnitelného systémového logu (`audit_log`).
5. **Správa klíčů:** Veškeré API klíče a secrets jsou nahrány v Cloudflare Environment Variables a nejsou součástí repozitáře.

---

## 📈 GEO / AEO / SEO & Vyhledávače

- **Lokální SEO landingy:** 5 specializovaných stránek pro regiony (Písek, Strakonice, Vodňany, Milevsko, Protivín) pro zachycení vyhledávacích dotazů na lokální biorezonanci.
- **Strukturovaná data (JSON-LD):** Detailní Person a LocalBusiness schémata, Service schémata v D1 generovaná za účelem zvýšení důvěryhodnosti u Google (E-E-A-T) i vyhledávačů.
- **AI-SEO & AEO (llms.txt):** Strojově čitelný popis celého projektu v rootu (`llms.txt`) pro usnadnění procházení vyhledávacími roboty AI asistentů (GPTBot, PerplexityBot apod.), aby AI asistenti odpovídali přesně a pravdivě o službách Bicom Písek.
- **Sitemap & Robots.txt:** Automaticky generovaná mapa stránek a pravidla pro roboty povzbuzující procházení obsahu.

---

## 🔄 Stav Vývoje a Migrace

> 📍 **Aktuální detailní stav a plán:** viz [docs/ROADMAP.md](docs/ROADMAP.md) — kompas projektu (hotovo / dolaďuje se / čeká).

Projekt je v aktivní fázi dolaďování před konečným předáním. Produkční kód je postupně zrcadlen z vývojového balíku MEVERIK STUDIO do tohoto čistého repozitáře.

```
 HOTOVO
 ├─ Veřejný web + lokální landingy + SEO/AEO základ
 ├─ Rezervační systém F1-F5 (availability backend, admin otevírací doba/výjimky, frontend time-picker)
 ├─ Admin konzole Virtual Office včetně dashboardu, blogu, GEO, fakturace a booking akcí
 ├─ no_show workflow (`no_show_flag`, badge, filtr, šednutí Google eventu)
 ├─ Google Calendar přes Domain-Wide Delegation (`admin@bicom-pisek.cz`)
 └─ GEO modul bez mock dat — jen reálné `geo_leads` + poctivé empty stavy

 PRÁVĚ SE LADÍ / FIXUJE
 ├─ Rezervační systém F6-F7 (`POST /api/book` v2, kolizní zámek, DST/KV cache, QA)
 ├─ Admin použitelnost a handover dokumentace pro klienta
 ├─ Produkční integrace Stripe / iDoklad / Resend / GoSMS
 └─ Známý bug `audit_log.action` — akce `cancel` / `reschedule` dnes mohou vracet HTTP 500

 NA HORIZONTU (Budoucí rozvoj)
 ├─ Generování obrázků, bannerů a Instagram/Facebook postů přímo z AI Copywritera
 ├─ Detekční/cenzurní vrstva právního guardrailu (detect.js v Kroku 2)
 ├─ Plné obousměrné napojení na Meta Graph (automatická publikace)
 └─ Rozšíření CRM nástrojů v administraci Virtual Office (správa klientů)
```

---

## 🚀 Lokální Spuštění

Pro lokální spuštění a vývoj je zapotřebí nainstalovat Node.js a npx wrangler CLI:

```bash
# 1. Klonování repozitáře
git clone https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git
cd bicom-pisek-produkcni-repozit

# 2. Instalace závislostí
npm install

# 3. Nastavení lokálních proměnných (vytvořte ze šablony)
cp .dev.vars.example .dev.vars

# 4. Inicializace lokální SQLite D1 databáze
npm run db:init:local

# 5. Spuštění lokálního vývojového serveru Wrangler
npm run dev
```

Pravidla pro vývoj, větvení a synchronizaci se řídí dokumentem [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md).

---

Vydání: **v1.0 RC — aktivní finalizace před předáním**  
© 2026 **MEVERIK STUDIO / WHC s.r.o.**  
Všechna práva vyhrazena.  
Kanonický web: [bicom-pisek.cz](https://bicom-pisek.cz)
