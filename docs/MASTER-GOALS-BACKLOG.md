# 🎯 MASTER GOALS & BACKLOG — Bicom Písek (kompletní vidění projektu)

> **Zdroj pravdy:** Agreguje ROADMAP.md + GAP_ANALYSIS_OPPORTUNITIES.md + ADR-001..005 + interní poznámky  
> **Verze:** 1.0 · 2026-06-20  
> **Čteno jako:** „Všechno, co by měl web/admin umět, aby byl 100% kompletní"

---

## 🎯 Vision: Bicom Písek jako kompletní DIY health-tech ekosystém

Ordinace si spravuje **vše v jednom místě:**
- 📅 Rezervační systém (24/7 online, inteligentní výběr času)
- 💬 AI poradce (chatbot na webu, nabízí řešení)
- 📱 Marketing automation (obsah generuje AI, publikuje sám se schválením)
- 👥 Admin konzole (správa rezervací, klientů, obsahu, financí)
- 🌐 Veřejný web (živý obsah, SEO, sociální sítě)
- 💰 Platby & fakturace (Stripe + iDoklad)
- 📧 Komunikace (email, SMS, WhatsApp, Telegram)

**Bez nutnosti vývojáře.**

---

## 📊 MASTER BACKLOG (Kategorie + velikost)

### **BLOK 1: Rezervační ekosystém (✅ HOTOVO)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **F1–F7** | Rezervační systém s časový výběrem | ✅ HOTOVO | 🔴 | CRITICAL |
| **G2–G4** | Admin správa rezervací + Google Calendar sync | ✅ HOTOVO | 🔴 | CRITICAL |
| **L1–L9** | 9 launch blockerů (Stripe, email, SMS, antispam) | ⚠️ 7/9 HOTOVO | 🔴 | VARIES |
| **Stripe integration** | Zálohové platby, webhook, test mode | ✅ HOTOVO (config) | 🔴 | CRITICAL |
| **Email (Resend)** | Potvrzení, upomínky, welcome sekvence | ✅ HOTOVO | 🔴 | CRITICAL |
| **SMS (GoSMS)** | SMS upomínky, CZ telefonní čísla | ✅ HOTOVO (config) | 🟠 | CRITICAL |
| **WhatsApp (Meta)** | WhatsApp upomínky, media | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Telegram** | Notifikace majitelkám + bot pro chatting | ✅ HOTOVO | 🟠 | MEDIUM |
| **Encryption** | AES-GCM citlivá data (jméno, email, tel, poznámky) | ✅ HOTOVO | 🔴 | CRITICAL |
| **Google Calendar DWD** | Přímá impersonace `admin@bicom-pisek.cz` | ✅ HOTOVO | 🔴 | CRITICAL |

---

### **BLOK 2: Admin konzole & Obsah (🟡 PROBÍHÁ + 🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **F11 CMS** | Editace textu, fotek, hero bez deploymentu | 🟢 NAPLÁNOVÁNO | 🔴 | LARGE |
| **Obsah editace** | Galerie, služby, hero banner, menu | 🟢 NAPLÁNOVÁNO | 🔴 | LARGE |
| **Gallery & uploads** | Drag-n-drop fotky na R2, pořadí | 🟢 NAPLÁNOVÁNO | 🔴 | MEDIUM |
| **Audit log** | Kdo, co, kdy změnil (vč. obsahu) | 🟢 NAPLÁNOVÁNO | 🟠 | SMALL |
| **Newsletter admin** | Správa subscribentů, welcome sekvence (Resend) | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Blog editor** | Tvorba/publikace/archivace článků | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Booking nastavení** | Slot duration, gaps, min lead, max horizon | ✅ HOTOVO | 🟠 | SMALL |
| **Invoicing (iDoklad)** | Zálohová faktura po platbě | 🟢 ČEKÁ (config) | 🔴 | MEDIUM |
| **GEO lead tracking** | Mapa PSČ, city, service, source, conversion | ✅ HOTOVO (data) | 🟠 | SMALL |
| **Operator management** | Přidělování rezervací, přístupová práva | 🟢 ČEKÁ | 🟠 | MEDIUM |

---

### **BLOK 3: AI Studio & Obsah (🟢 ČEKÁ — ADR-003)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **F1–F5** | AI Studio (refaktor providers → skills) | 🟢 NAPLÁNOVÁNO | 🟠 | LARGE |
| **AI Copywriter** | Text → články, popis služeb, nadpisy | ✅ HOTOVO (basic) | 🟠 | MEDIUM |
| **AI Vizuál** | Generování obrázků (Lucid Origin, Flux) | 🟢 ČEKÁ | 🟠 | LARGE |
| **Imagine endpoint** | /admin/imagine — generuj obraz ze skill promptu | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Media assets DB** | Galerie AI generovaných obrázků s versioningem | 🟢 ČEKÁ | 🟠 | SMALL |
| **Wizard (Studio UI)** | Volba typu → text draft → obraz → preview → schválení | 🟢 ČEKÁ | 🟠 | LARGE |
| **Composer** | SVG + text vrstva, brand typografie | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Guardrail v3** | Zdravotní tvrzení, brand, legální check | 🟢 ČEKÁ | 🔴 | MEDIUM |

---

### **BLOK 4: Sociální sítě & Publishing (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **IG/FB Publisher** | Plánovaná publikace (social_posts) | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Meta Graph integrace** | Two-way sync: publikace + insights | 🟢 ČEKÁ | 🟠 | LARGE |
| **IG Story scheduling** | Story templaty, automatické publikace | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Karusel generování** | 5-slide IG carousel (title + 4× texty) | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Instagram→Blog sync** | Aktivace toku C (IG caption → blog post) | 🟢 ČEKÁ | 🟢 | SMALL |
| **LinkedIn publishing** | B2B obsah pro terapeuta (wellness, health) | 🟢 ČEKÁ | 🟢 | SMALL |
| **TikTok integration** | Vertikální video — long-tail trafik | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Social calendar** | Přehled publikovaných postů, scheduling | 🟢 ČEKÁ | 🟠 | MEDIUM |

---

### **BLOK 5: SEO, GEO, AEO (Search Engines) (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **Lokální landing pages** | 5 měst (Písek, Strakonice, Vodňany, Milevsko, Protivín) | 🟢 ČEKÁ | 🔴 | LARGE |
| **FAQPage JSON-LD** | Strukturovaná FAQ pro featured snippets | 🟢 ČEKÁ | 🟠 | SMALL |
| **Service/Offer JSON-LD** | Automatická generace z `services` tabulky | 🟢 ČEKÁ | 🟠 | SMALL |
| **Person (Author) JSON-LD** | Terapeuta profil, E-E-A-T signály | 🟢 ČEKÁ | 🟠 | SMALL |
| **Review/Rating schema** | Google Business reviews, AggregateRating | 🟢 ČEKÁ | 🟠 | SMALL |
| **Google Business optimization** | NAP, foto, postů, odpovědi | 🟢 ČEKÁ | 🟠 | SMALL |
| **Seznam.cz / Firmy.cz** | CZ lokální indexace | 🟢 ČEKÁ | 🟠 | SMALL |
| **Sitemap regenerace** | Dynamická sitemap.xml (blog, pages) | ✅ HOTOVO | 🟠 | SMALL |
| **llms.txt update** | AI crawlery (Perplexity, Claude, ChatGPT) | ✅ HOTOVO (basic) | 🟢 | SMALL |
| **AI Overviews tracking** | Měsíční audit: kde se web cituje v AI | 🟢 ČEKÁ | 🟢 | SMALL |

---

### **BLOK 6: AI Chatbot (Shadow Web) (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **AI Rádce chatbot** | Na webu: otázka → řešení (biorezonance, prevence) | 🟢 ČEKÁ | 🟠 | LARGE |
| **Contextual offerings** | "Máte bolest hlavy? Pokuste se X, nebo si zamluvte Y" | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Multi-turn conversation** | Dialogy, follow-up, eskalace | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Chatbot persistence** | Chat history (user ID / JWT) | 🟢 ČEKÁ | 🟢 | SMALL |
| **Guardrail chatbot** | Bez zdravotnických tvrzení (ADR-002) | 🟢 ČEKÁ | 🔴 | SMALL |
| **Telegram chatbot** | Bot pro ordinaci (potvrzení rezervací, odpovědi) | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Shadow web builder** | Skrytý web pro AI crawlery (JSON, markdown) | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **AI Advisor recommendations** | V chatě: „Zkuste si zamluvit konzultaci" → direct /book link | 🟢 ČEKÁ | 🟢 | SMALL |

---

### **BLOK 7: Performance, Reliability, Ops (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **D1 automatic backup** | Denní export do R2/bicom-multimedia | 🟢 ČEKÁ | 🔴 | SMALL |
| **GDPR anonymization cron** | Automatické smazání po 30 dnech | 🟢 ČEKÁ | 🔴 | SMALL |
| **Rate limiting & WAF** | 100 req/min na /api/book, /api/newsletter | 🟢 ČEKÁ | 🟠 | SMALL |
| **Monitoring & alerting** | Sentry + healthcheck crony, Slack notifikace | 🟢 ČEKÁ | 🟠 | MEDIUM |
| **Error tracking** | Console errors, API 500s, Worker failures | 🟢 ČEKÁ | 🟠 | SMALL |
| **Performance audit** | Lighthouse CI, Core Web Vitals tracking | 🟢 ČEKÁ | 🟠 | SMALL |
| **Load testing** | Simulation 100 concurrent bookings | 🟢 ČEKÁ | 🟢 | SMALL |
| **CDN cache strategy** | CF Cache Rules per content type | 🟢 ČEKÁ | 🟠 | SMALL |
| **Cloudflare Access monitoring** | SSO login audit, MFA enforcement | 🟢 ČEKÁ | 🟠 | SMALL |

---

### **BLOK 8: Handover & Training (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **CMS operátor guide** | Jak editovat obsah bez developera | 🟢 ČEKÁ | 🔴 | SMALL |
| **Admin quick-start** | Onboarding pro nové operátory (PDF + video) | 🟢 ČEKÁ | 🟠 | SMALL |
| **Runbook & SLA** | Procedury: co když padne, co dělat | 🟢 ČEKÁ | 🔴 | SMALL |
| **API documentation** | Swagger/OpenAPI pro budoucí integraci | 🟢 ČEKÁ | 🟢 | SMALL |
| **Developer handover** | Jak pokračovat v rozvoji (architektura, patterns) | ✅ HOTOVO (ADRs) | 🟢 | SMALL |
| **Monitoring dashboard** | Public status page (Cloudflare) | 🟢 ČEKÁ | 🟢 | SMALL |
| **Training call** | Live 1–2h pro operátory (booking, obsah, chat) | 🟢 ČEKÁ | 🔴 | ACTIVITY |
| **Go-live checklist** | Finální kontrola před ostrým provozem | 🟢 ČEKÁ | 🔴 | SMALL |

---

### **BLOK 9: Rozšíření & Partnerství (🟢 ČEKÁ)**

| # | Funkce | Status | Prio | Velikost |
|---|--------|--------|------|----------|
| **MEVERIK solution template** | Zabalit Bicom jako opakovatelný pattern (pro další klienty) | 🟢 ČEKÁ | 🟢 | LARGE |
| **Whitepaper: health tech DIY** | Publikovat metodologii | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Partner integrations** | iDoklad + Stripe + Resend + GoSMS API | ✅ HOTOVO (config) | 🔴 | VARIES |
| **Webhook marketplace** | Třetí strany se mohou napojit (IFTTT atd.) | 🟢 ČEKÁ | 🟢 | MEDIUM |
| **Mobile app (future)** | Native iOS/Android pro booking | 🟢 ČEKÁ | 🟢 | XLARGE |
| **Analytics dashboard** | Insights: conversions, revenue, trends | 🟢 ČEKÁ | 🟢 | MEDIUM |

---

## 🎯 PRIORITNÍ CESTY (Next Steps)

### **CESTA A: Handover (příští 1–2 týdny)**
1. ✅ CMS (F11) — Operátoři editují obsah
2. ✅ Handover docs — CMS_GUIDE.md, operátor training
3. ✅ Go-live checklist — DNS, secrets, monitoring
4. ✅ DNS cutover — bicom-pisek.cz production (remove dev redirect)

**Výsledek:** Web je veřejný, operátoři jej spravují.

---

### **CESTA B: Growth (měsíce 2–3 po handoveru)**
1. AI Studio (ADR-003) — Obsah se generuje, ne píše ručně
2. SEO landing pages — 5 měst × automatický lokální obsah
3. Social automation — IG/FB publishes se schválením
4. Chatbot — Web sám nabízí řešení

**Výsledek:** Web si generuje obsah, přitahuje inbound.

---

### **CESTA C: Scale (měsíce 4+ po handoveru)**
1. Newsletter automation — 1–2 weekly emails, welcome sekvence
2. Monitoring & SLA — 99.9% uptime
3. Advanced analytics — Revenue tracking, customer LTV
4. Mobile app — Native iOS/Android

**Výsledek:** Ordinace má 24/7 revenue engine.

---

## 📋 PŘÍMO V REPU (kde to najít)

| Téma | Soubor |
|------|--------|
| Hotové features (✅) | `docs/ROADMAP.md` → "HOTOVO" sekce |
| Co se dělá (🟡) | `docs/ROADMAP.md` → "PROBÍHÁ" sekce |
| Co čeká (🟢) | `docs/ROADMAP.md` → "ČEKÁ" sekce |
| Architektonické rozhodnutí | `docs/adr/ADR-*.md` (5 ADRů) |
| Gap analýza & příležitosti | `docs/GAP_ANALYSIS_OPPORTUNITIES.md` |
| AI Studio masterplan | `docs/adr/ADR-003-ai-studio.md` |
| Guardrail vrstva | `docs/adr/ADR-002-guardrail-modularni-vrstva.md` |
| Rezervační systém | `docs/adr/ADR-004-rezervacni-system.md` |
| Admin správa | `docs/adr/ADR-005-admin-sprava-rezervaci.md` |
| Handover & launch | `docs/HANDOVER.md` |
| Database schéma | `db/schema.sql` |
| Agent tasks (specifikace) | `docs/agent-tasks/` |

---

## 📊 GRAFICKÁ REPREZENTACE (Timeline)

```
┌─ TEĎ (2026-06-20) ───────────────────────────────────────┐
│                                                             │
│  ✅ Rezervační systém (F1–F7)                              │
│  ✅ Admin konzole (G2–G4, booking)                         │
│  ✅ Google Calendar sync                                  │
│  ✅ Email/SMS upomínky                                    │
│  ✅ Encryption, GDPR                                      │
│  ✅ Repo dokumentace, ROADMAP                             │
│                                                             │
│  🟡 NYNÍ: CMS (F11) — Operátoři editují obsah             │
│  🟡 NYNÍ: Handover docs & training                        │
│                                                             │
│ 🎯 CÍЛЬ: Web veřejný, operátoři jej spravují              │
└─────────────────────────────────────────────────────────┘

┌─ BĚHEM NÁSLEDUJÍCÍCH 2–3 MĚSÍCŮ ──────────────────────────┐
│                                                             │
│  🟢 AI Studio (F1–F5): Obsah se generuje                   │
│  🟢 SEO landing pages (5 měst)                             │
│  🟢 Social automation (IG/FB)                              │
│  🟢 Chatbot & guardrail v3                                │
│  🟢 Newsletter sekvence                                    │
│  🟢 Performance audit                                      │
│                                                             │
│ 🎯 CÍЛЬ: Web si generuje obsah, přitahuje organický trafik │
└─────────────────────────────────────────────────────────┘

┌─ HORIZONTÁLNÍ VID (6–12 MĚSÍCŮ) ──────────────────────────┐
│                                                             │
│  🟢 Mobile app (iOS/Android)                               │
│  🟢 Advanced analytics & LTV tracking                      │
│  🟢 Partner integrations (marketplace)                     │
│  🟢 MEVERIK solution template (scalable pattern)           │
│                                                             │
│ 🎯 CÍЛЬ: Ordinace má 24/7 revenue engine + template pro   │
│          ostatní zdravotníky                               │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Jak se v tomto orientovat?

**Pokud se zeptáš:** *"Co máme na řadě?"*  
👉 Podívej se na CESTY A/B/C výše.

**Pokud se zeptáš:** *"Kde to je v repu?"*  
👉 Podívej se do tabulky "PŘÍMO V REPU" výše.

**Pokud se zeptáš:** *"Je to architektonické rozhodnutí?"*  
👉 Nejdeš do `docs/adr/ADR-*.md` (5 souborů).

**Pokud se zeptáš:** *"Je tam nějaký hidden backlog?"*  
👉 Tyhle MASTER GOALS obsahují všechno. Nic není "hidden".

**Pokud se zeptáš:** *"Kolik zbývá času?"*  
👉 Cesta A (handover): 1–2 týdny. Cesta B (growth): 8–12 týdnů.

---

## ⚠️ Co NENÍ v tomto backlogu

- Juridické konzultace (advokát musí, my já)
- Fyzická ordinace (stavby, vybavení — mimo software)
- Operátoská rozhodnutí (která péče, ceny, reklama — na nich)
- Produkční incident response (na operátorovi + my jsme on-call)

---

## ✅ Finální summary

| Aspekt | Stav |
|--------|------|
| **Cíль projektu** | ✅ Jasný: DIY health-tech bez developera |
| **Hotové components** | ✅ Rezervační systém, admin, Google Calendar, email/SMS |
| **Next (1–2 týdny)** | 🟡 CMS + handover |
| **Growth (2–3 měsíce)** | 🟢 AI Studio, SEO, social, chatbot |
| **Scale (6–12 měsíců)** | 🟢 Mobile, analytics, template |
| **Vedení dokumentace** | ✅ ROADMAP.md, GAP analýza, 5 ADRů, HANDOVER.md |
| **Agent tasks hotovy** | ✅ CMS specifikace v `docs/agent-tasks/` |
| **Rizika** | ⚠️ Launch blockery (L1–L9) — nutné resolver externally |
| **Klíčová úskalí** | ⚠️ Zdravotní tvrzení (musí být pod guardrailem), GDPR, právní |

---

*Toto je kompletní masterplan. Nic tu není "skryté" nebo "na side". Všechno je tady.*

*Příští otázka: "Co dělat dál?" → Odpověď: Podívej se na CESTY A/B/C a řekni který chceš.*
