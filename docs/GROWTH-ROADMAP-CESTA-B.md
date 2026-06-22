# CESTA B: Growth Features — Masterplan (Post-Launch)

> **Status:** Planning phase — ready for execution po handoveru  
> **Timeline:** Měsíce 2–3 po live (September–October 2026)  
> **Owner:** MEVERIK (dev) + Klient (approval)  
> **Priority:** P1 (revenue impact high)

---

## 🎯 Objective

Po handoveru Bicom Písek na Live (v1.0 RC), projekt se rozšiřuje o:
1. **AI Studio** — Automatická generace obsahu (články, vizuály, sociální posty)
2. **SEO & GEO** — Lokální landing pages, schema markup, Google Business optimization
3. **Social Automation** — IG/FB publikace s scheduling a insights
4. **Content Growth** — Newsletter, chatbot, lead scoring

**Výsledek:** Web si generuje obsah sám, přitahuje inbound trafik, klient má 24/7 revenue engine.

---

## 📋 BLOK B1: AI Studio (F1–F5, ADR-003)

### B1.1: Refactor — Providers → Skills

**Task:** Přestrukturovat AI architecture z monolitického copywriteru na modularní skill systém.

**Specifika:**
- Provider pool: Workers AI (Llama) → Groq API → Gemini API (3-level fallback)
- Skill types: `TextGeneration`, `ImageGeneration`, `AudioProcessing`, `SocialPostGeneration`
- Guardrail integration: Každý skill má pre/post checks (health claims, brand compliance)

**Deliverables:**
```
functions/lib/skills/
  ├── base-skill.js           // BaseSkill class + lifecycle
  ├── text-generation-skill.js // Article, description, headline generation
  ├── image-generation-skill.js // Flux + Lucid Origin integration
  ├── social-post-skill.js     // IG/FB captions + hashtags
  ├── audio-skill.js           // Voice transcription + TTS
  └── skill-registry.js        // Discovery + orchestration

functions/api/admin/skills/
  ├── GET /list              // List available skills + schemas
  ├── POST /execute          // Run skill (async, queued)
  └── GET /:skill_id/status  // Poll async job status
```

**DB Schema:**
```sql
CREATE TABLE ai_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT, -- 'text', 'image', 'audio', 'social'
  provider TEXT, -- 'workers-ai', 'groq', 'gemini'
  schema_version INT,
  is_active BOOLEAN,
  monthly_calls INT,
  cost_per_call DECIMAL(6,4),
  created_at TIMESTAMP
);

CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY,
  skill_id TEXT REFERENCES ai_skills(id),
  user_id TEXT,
  status TEXT, -- 'queued', 'running', 'success', 'failed'
  input_params JSON,
  output_result JSON,
  created_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

**UI Mockup:**
```
Admin Console → AI Studio → Skills
  ├── Text Generation
  │   ├── Article Generator (input: topic, tone, length)
  │   ├── Service Description Generator
  │   └── Headline Generator
  ├── Image Generation
  │   ├── Flux (realistic photos)
  │   └── Lucid Origin (abstract graphics)
  ├── Social Posts
  │   ├── IG Caption Generator (with hashtags)
  │   └── FB Post Generator (engagement hooks)
  └── [+ Add custom skill]
```

---

### B1.2: AI Copywriter v2 — Enhanced

**Task:** Vylepšit existující copywriter s skill system + voice input + approval workflow.

**Specifika:**
- Voice input: Operátor nahraje voice note, AI transkribuje (Whisper API) → generuje text
- Approval workflow: Draft → Preview → Guardrail check → Publikace/Edit
- Multi-channel output: Web article + IG post + Newsletter snippet (same prompt, different outputs)

**Deliverables:**
```
functions/api/admin/ai-copywriter/
  ├── POST /generate           // Input: text/voice + topic + tone → outputs
  ├── POST /guardrail-check    // Validate health claims + brand
  ├── POST /publish            // Move from draft to live
  └── GET /templates           // List approval templates

admin/pages/
  └── AIStudio.html           // UI for all operations
```

**Test Coverage:**
- Health claim detection (GDPR, misleading claims)
- Brand compliance (tone, keywords, style)
- Fallback chains (Llama timeout → Groq → Gemini)
- Cost tracking (monthly budget per skill)

---

### B1.3: Image Generation — Flux + Lucid Origin

**Task:** Integrovat dva image providers pro berbě obsahu (fotka vs. grafika).

**Specifika:**
- **Flux** (Black Forest Labs) — Realistic photos (6 sec inference)
  - Use case: People, locations, products
  - Prompt: "A smiling therapist in a bright clinic, warm lighting"
- **Lucid Origin** — Abstract/artistic graphics
  - Use case: Headers, social covers, infographics
  - Prompt: "Abstract wellness mandala, blues and greens"
- Fallback: If both fail, use stock photo (Unsplash API)

**Deliverables:**
```
functions/lib/image-generators/
  ├── flux-client.js         // Flux API integration
  ├── lucid-origin-client.js // LucidOrigin API
  └── unsplash-fallback.js   // Stock photo fallback

functions/api/admin/imagine/
  ├── POST /generate         // Input: prompt + type → image URL
  ├── POST /variations       // Generate 4 variants of same prompt
  └── POST /favorite         // Save to gallery
```

**DB Schema:**
```sql
CREATE TABLE ai_media (
  id TEXT PRIMARY KEY,
  url TEXT (R2 path),
  prompt TEXT,
  generator TEXT, -- 'flux', 'lucid', 'unsplash'
  cost DECIMAL(6,4),
  created_at TIMESTAMP,
  created_by TEXT,
  is_favorited BOOLEAN
);
```

---

## 📋 BLOK B2: SEO & GEO Optimization

### B2.1: Lokální Landing Pages (5 měst)

**Task:** Vytvořit 5 lokálních variant webu pro: Písek, Strakonice, Vodňany, Milevsko, Protivín.

**Specifika:**
- Template: Stejný HTML/CSS/JS, jen přepísané texty (geo-specific)
- URL struktura:
  - `/` — Hlavní Písek
  - `/strakonice/` — Pro Strakonice
  - `/vodňany/` — Pro Vodňany
  - atd.
- Obsah (AI-generated):
  - Úvod: "Biorezonance terapie v [městě]"
  - Služby: "Příznaky léčené v [městě]"
  - Tým: "Naši terapeuti v [městě]"
  - FAQ: Lokální specifika (dopravní dostupnost, lékárny apod.)

**Deliverables:**
```
public/
  ├── index.html              // Main Písek
  ├── strakonice/index.html
  ├── vodňany/index.html
  ├── milevsko/index.html
  └── protivín/index.html

db/schema.sql
  → ALTER TABLE landing_pages ADD COLUMN city_id TEXT
  → Table: local_landing_pages (city_id, city_name, slug, content, seo_title, seo_desc)
```

**SEO Strategy:**
- Keyword: "biorezonance [město]" (long-tail)
- H1: "Biorezonance terapie v [městě] — [název ordinace]"
- Meta desc: "Léčba bolesti, únavy, alergiíí skrze biorezonanci v [městě]. Infolinka: +420 XXX"
- Schema: LocalBusiness + Address + Phone

---

### B2.2: JSON-LD Schema Expansion

**Task:** Přidat strukturovaná data pro:
1. FAQPage (pro featured snippets)
2. Service (pro každou službu)
3. Offer (pro bookings/promotions)
4. Person (terapeuta)
5. Review/Rating (Google Business reviews)

**Specifika:**
- Auto-generated z DB (`services`, `faq_items`, `reviews`)
- Dynamický based na page (/ vs. /strakonice/ vs. /article/:slug)
- Validation: schema.org + Google Rich Results Test

**Deliverables:**
```
functions/lib/json-ld.js
  ├── generateFAQPageSchema()
  ├── generateServiceSchema()
  ├── generateOfferSchema()
  ├── generatePersonSchema()
  └── generateReviewSchema()

public/pages/*.html
  → <script type="application/ld+json">{ ... }</script> injected
```

**Example:**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Jak se léčí bolest hlavy biorezonancí?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Biorezonance identifikuje..."
      }
    }
  ]
}
```

---

### B2.3: Google Business Optimization

**Task:** Automatizovat a monitorovat Google My Business (GMB) pro všech 5 měst.

**Specifika:**
- Photo sync: Upload profesionálních fotek (z AI generátoru) automaticky
- Post scheduler: Týdení posty s health tips
- Review monitoring: Alert když přijde nová review
- NAP consistency: Ověřit Name/Address/Phone across all sources

**Deliverables:**
```
functions/workers/gmb-sync.js  // Daily cron: photos, posts, reviews
admin/pages/GMBDashboard.html  // Overview: all 5 cities, reviews, photos

DB: gmb_posts (city_id, content, published_at, views)
```

---

## 📋 BLOK B3: Social Automation

### B3.1: IG/FB Publisher (plánovaná publikace)

**Task:** Plánovat a publikovat posty na IG/FB bez ručního práce.

**Specifika:**
- Upload: Operátor nahraje foto/video + napíše caption
- Schedule: Vybere čas publikace (AI doporučí best times)
- Publish: Automaticky publikuje skrze Meta Graph API
- Insights: Tracking views, likes, comments

**Deliverables:**
```
functions/api/admin/social/
  ├── POST /schedule-post    // Input: image, caption, platforms, datetime
  ├── GET /scheduled         // List upcoming posts
  ├── DELETE /:post_id       // Cancel scheduled post
  └── GET /insights          // Analytics: views, engagement

admin/pages/SocialPublisher.html

DB:
  CREATE TABLE social_posts (
    id TEXT PRIMARY KEY,
    content TEXT,
    image_url TEXT,
    platforms TEXT, -- 'instagram,facebook'
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    views INT,
    likes INT,
    meta_post_id TEXT -- IG/FB post ID
  );
```

---

### B3.2: Karusel Generování

**Task:** Automaticky generovat IG carousel (5 slides) ze single promptu.

**Specifika:**
- Slide 1: Title (bold) + image
- Slide 2–4: Key points (text overlay na images)
- Slide 5: CTA (Call-to-Action) + booking link

**Example:**
```
Prompt: "Jak se zbavit přetrvávající bolesti krku"

Slide 1: [Image: neck pain illustration] "Bolest krku — řešení?"
Slide 2: [Image: stress] "Příčina #1: Stres a napětí"
Slide 3: [Image: posture] "Příčina #2: Špatná poloha"
Slide 4: [Image: therapy] "Řešení: Biorezonance"
Slide 5: [CTA] "Zarezervuj si session. +420 XXX"
```

**Deliverables:**
```
functions/lib/carousel-generator.js
  ├── generateCarouselFromPrompt()
  ├── createSlideImage()
  └── publishToInstagram()
```

---

### B3.3: Social Calendar

**Task:** UI dashboard pro přehled publikovaných i plánovaných postů.

**Specifika:**
- Month view (když? kdo? kam?)
- Week view (detail + edit možnosti)
- Analytics: Top performers (by engagement)
- Recommendations: "Best time to post is Wednesday 9 AM"

**Deliverables:**
```
admin/pages/SocialCalendar.html
  → Calendar view (Grid + List toggle)
  → Filters: Platform (IG, FB), Date range
  → Export: CSV pro reporting
```

---

## 📋 BLOK B4: Content Growth & Engagement

### B4.1: Newsletter Welcome Sekvence

**Task:** Automatizovat onboarding emailů po subscribe.

**Specifika:**
- Email 1 (Day 0, 9 AM): Welcome + intro to clinic
- Email 2 (Day 2): "Jak se připravit na první session"
- Email 3 (Day 4): Case study: úspěšný klient
- Email 4 (Day 7): Special offer: -20% na next booking

**Deliverables:**
```
functions/lib/email-sequences.js
  └── sendWelcomeSequence(email, subscription_date)

DB:
  ALTER TABLE email_subscriptions ADD COLUMN sequence_stage INT
  → Cron daily: Move subscribers through sequence
```

**Email templates (Resend):**
- Template IDs: welcome_email_1, welcome_email_2, etc.
- Personalization: {{ firstName }}, {{ clinic_name }}

---

### B4.2: Chatbot — AI Health Assistant

**Task:** Chat widget na webu (bottom-right) — AI poradce.

**Specifika:**
- Visitor napíše symptom (bolest hlavy, únava apod.)
- Bot navrhne řešení: "Tyto příznaky se často léčí biorezonancí. Zarezervuj si session."
- CTA button: Link na reservation form
- Guardrail: Bez medicínských diagóz, jen informace

**Deliverables:**
```
public/js/chatbot-widget.js    // Embedded chat bubble
functions/lib/chatbot.js       // AI backend

DB: chatbot_conversations (visitor_id, messages JSON, created_at)
```

---

### B4.3: Lead Scoring & CRM Integration

**Task:** Automaticky skórovat a kategorizovat leads z bookings.

**Specifika:**
- Score based on: Demographics, booking history, email engagement, reservation frequency
- Categories: "Hot" (booking tento měsíc), "Warm" (browsing last month), "Cold" (inactive >3 months)
- Action: Auto-trigger nurture emails pro "Warm" leads

**Deliverables:**
```
functions/workers/lead-scoring.js  // Daily: re-score all leads
functions/lib/lead-classifier.js

DB:
  ALTER TABLE contacts ADD COLUMN lead_score INT
  ALTER TABLE contacts ADD COLUMN lead_category TEXT
```

---

## 📊 BLOK B5: Monitoring & Analytics

### B5.1: Analytics Dashboard (Revenue + Traffic)

**Task:** Admin dashboard s KPIs (conversions, revenue, traffic sources).

**Specifika:**
- **Metrics:**
  - Total bookings (MTD, YTD)
  - Revenue (paid invoices)
  - Conversion rate (website visitors → bookings)
  - Traffic by source (organic, direct, paid)
  - Top pages, bounce rate
- **Data sources:** Cloudflare Analytics Engine, D1 bookings table, GA4 (optional)

**Deliverables:**
```
admin/pages/AnalyticsDashboard.html
  → Cards: Total Revenue, Bookings This Month, Conversion Rate
  → Charts: Revenue trend (30 day), Traffic sources, Booking sources
  → Filters: Date range, therapist, city
```

---

### B5.2: Performance Monitoring

**Task:** Kontinuální monitoring uptime, latency, error rates.

**Specifika:**
- Cloudflare Analytics (requests, response time, cache hit ratio)
- Sentry (errors, exceptions)
- D1 query performance
- Alert: SMS/email když je downtime

**Deliverables:**
```
functions/workers/health-check.js   // 5min interval: Ping all endpoints
admin/pages/StatusPage.html         // Public: https://status.bicom-pisek.cz

DB: status_checks (endpoint, response_time, status_code, timestamp)
```

---

## 🗓️ Timeline (Post-Launch)

```
Week 1–2:     BLOK B1.1 — Skill refactor (parallel: B2.1 lokální stránky)
Week 3–4:     BLOK B1.2 — AI Copywriter v2 + B1.3 Image gen
Week 5–6:     BLOK B2.2 — JSON-LD + B2.3 GMB sync
Week 7–8:     BLOK B3.1–B3.3 — Social automation (scheduler → calendar)
Week 9–10:    BLOK B4 — Newsletter, chatbot, lead scoring
Week 11–12:   BLOK B5 — Analytics dashboard + monitoring + performance tuning
```

**Total:** ~12 týdnů (3 měsíce) na implementaci.

---

## 💰 Costs & ROI

| Component | Monthly Cost | ROI Impact |
|---|---|---|
| Workers AI (Llama) | €5–20 | +200 words/day content |
| Flux Image Gen | €0–15 | +3–5 images/week |
| Groq API (fallback) | €0 | Reliability |
| Resend (emails) | €20–50 | Newsletter conversion |
| Google Ads (optional) | €200–500/mo | Lead acquisition |
| **Total** | **€225–585** | **+50–100% MoM growth** |

---

## 📋 Checklist — Ready to Launch CESTA B

Before starting:
- [ ] v1.0 RC is live + stable (24h+ monitoring green)
- [ ] Klient is comfortable with admin console
- [ ] CESTA B roadmap approved
- [ ] Budget approved (€300–600/month for tooling)
- [ ] Dev team capacity confirmed (3–4 people, 12 weeks)

**Owner:** MEVERIK (tech lead) + Klient (approval/feedback)

---

*Dokument: GROWTH-ROADMAP-CESTA-B.md*  
*Verze: 1.0*  
*Status: Draft (ready for approval)*  
*Created: 2026-06-22*
