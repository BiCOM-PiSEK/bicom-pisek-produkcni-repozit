# ✅ CMS Feature — Task Checklist pro agenty

**Status:** 🟢 PŘIPRAVENO K ZPRACOVÁNÍ  
**Verze:** 1.0 · 2026-06-20  
**Odhadovaná doba:** 12 hodin agentského zpracování

---

## 🎯 Kontext

Bicom Písek potřebuje CMS pro obsah webu. Operátoři (provozovatelky ordinace) mají přístup do admin konzole ("virtuální kanceláře") a potřebují **bez vývoje / bez deploymentu** měnit:

- **Texty** na webu (hero, úvody, popisky)
- **Obrázky** (galerie ordinace, služeb, článků)
- **Kontaktní údaje** a přesměrování

Cíl: web se dynamicky renderuje z DB + API, nikoliv z hardcoded HTML.

---

## 📚 Přípravné dokumenty

Před zahájením si **povinně** přečti:

1. **[CMS-FEATURE-SPEC.md](CMS-FEATURE-SPEC.md)** — kompletní spec (5 fází, architektura, modely, bezpečnost)
2. **[CMS-IMPLEMENTATION-EXAMPLES.md](CMS-IMPLEMENTATION-EXAMPLES.md)** — konkrétní kód: migrace, API vzorky, Vue komponenty

**Jejich obsah je zdroj pravdy.** Tento checklist je pouze orchestrace.

---

## 🔧 Checklist — Fáze 1: Database

- [ ] **1.1** Vytvořit soubor `db/migrations/0013_cms_content_management.sql` (viz EXAMPLES.md)
  - [ ] 5 nových CREATE TABLE (page_sections, gallery_items, hero_config, content_audit_log, + ALTER services)
  - [ ] Správné indexy a ForeignKey constraints
  - [ ] Default data (seed) — hero-title, ordinace-intro, moje-cesta-intro, faq-title

- [ ] **1.2** Aktualizovat `db/schema.sql`
  - [ ] Přidat CREATE TABLE ze migrace 0013
  - [ ] Ověřit, že `db/schema.sql` je zdroj pravdy (schema.sql > migrace)

- [ ] **1.3** Testovat migraci lokálně
  - [ ] `wrangler d1 execute bicom-pisek-db --local --file=db/migrations/0013_cms_content_management.sql`
  - [ ] Ověřit: tabulky existují, indexy existují, seed data OK

- [ ] **1.4** Aktualizovat `wrangler.toml`
  - [ ] R2 binding: `r2_buckets = [ { binding = "BICOM_MULTIMEDIA", bucket_name = "bicom-multimedia" } ]` (měl by již existovat)
  - [ ] Ověřit existenci proměnných pro JWT/auth

---

## 🔧 Checklist — Fáze 2: API Endpointy

### Admin CRUD endpointy (JWT protected)

- [ ] **2.1** `functions/api/admin/page-sections.js` (8 endpointů — list, get, post, put, delete)
  - [ ] JWT ověření (verifyJWT)
  - [ ] GET /api/admin/page-sections (list všechny)
  - [ ] POST /api/admin/page-sections (create)
  - [ ] GET /api/admin/page-sections/:key (get jednu)
  - [ ] PUT /api/admin/page-sections/:key (update — sanitize HTML)
  - [ ] DELETE /api/admin/page-sections/:key
  - [ ] Audit log pro každou akci
  - [ ] KV cache invalidation
  - [ ] Error handling, input validation

- [ ] **2.2** `functions/api/admin/gallery.js` (6 endpointů — upload, list, edit, delete, reorder)
  - [ ] JWT ověření
  - [ ] POST /api/admin/gallery/upload (multipart)
    - [ ] Validace: max 5MB, image/* mimetypes
    - [ ] Upload na R2 (key: `cms/{gallery_key}/{hash}.{ext}`)
    - [ ] Uložit do DB + vráti R2 URL
  - [ ] GET /api/admin/gallery/:gallery_key (list)
  - [ ] PUT /api/admin/gallery/:id (metadata — title, caption)
  - [ ] DELETE /api/admin/gallery/:id (smazat z R2 i DB)
  - [ ] POST /api/admin/gallery/:gallery_key/reorder (sort_order update)
  - [ ] Audit log
  - [ ] KV cache invalidation

- [ ] **2.3** `functions/api/admin/hero.js` (3 endpointy)
  - [ ] POST /api/admin/hero/:page_key (create/upsert)
  - [ ] GET /api/admin/hero/:page_key (load)
  - [ ] PUT /api/admin/hero/:page_key (update)
  - [ ] Audit log, cache invalidation

### Veřejné endpointy (bez auth, cache)

- [ ] **2.4** `functions/api/public/page-sections.js`
  - [ ] GET /api/public/page-sections/:key
  - [ ] KV cache 60s s fallback na D1
  - [ ] Fallback na hardcoded obsah pokud DB/KV padne

- [ ] **2.5** `functions/api/public/gallery.js`
  - [ ] GET /api/public/gallery/:gallery_key
  - [ ] KV cache 5m
  - [ ] Vrátit pole items (title, caption, image_url, sort_order)

- [ ] **2.6** `functions/api/public/hero.js`
  - [ ] GET /api/public/hero/:page_key
  - [ ] KV cache 5m

---

## 🔧 Checklist — Fáze 3: Admin UI (Vue komponenty)

- [ ] **3.1** `public/assets/js/admin/CmsPageSections.vue`
  - [ ] Komponenta pro správu textů
  - [ ] List všech sekcí
  - [ ] Formulář: title, content, description, type
  - [ ] Save, Delete, Create new
  - [ ] HTML textarea (s sanitací na backendu)
  - [ ] Responsive design (mobilní, tablet, desktop)

- [ ] **3.2** `public/assets/js/admin/CmsGallery.vue`
  - [ ] Komponenta pro správu fotek
  - [ ] Dropdown: výběr galerie (ordinace, services, blog)
  - [ ] **Drag-n-drop upload zone** (nebo `<input type="file" multiple>`)
  - [ ] List fotek s thumb preview
  - [ ] Edit metadata (title, caption)
  - [ ] Delete
  - [ ] **Drag reorder** (knihovna: Sortable.js nebo Vue.Sortable)
  - [ ] Progress bar při uploadu

- [ ] **3.3** `public/assets/js/admin/CmsHero.vue`
  - [ ] Komponenta pro hero banner
  - [ ] Dropdown: výběr stránky (homepage, ordinace, atd)
  - [ ] Formulář: headline, subheadline, cta_text, cta_link
  - [ ] Upload background image
  - [ ] Overlay color picker
  - [ ] Live preview (desktop)

- [ ] **3.4** `public/assets/js/admin/CmsAuditLog.vue`
  - [ ] Komponenta pro changelog
  - [ ] Tabulka: co, kdo, kdy
  - [ ] Sortování + paginace

- [ ] **3.5** Integrace do admin routeru
  - [ ] Nový route: `/admin/cms`
  - [ ] Tab/menu item: "Obsah webu"
  - [ ] Loader pro komponenty (lazy-load)
  - [ ] Náhrada v existující admin struktuře

---

## 🔧 Checklist — Fáze 4: Web Integration

- [ ] **4.1** `public/assets/js/cms-client.js`
  - [ ] Funkce: `renderSection(key, containerId)`
  - [ ] Funkce: `loadGallery(key, containerId, options)`
  - [ ] Funkce: `loadHero(key)` → vrátí hero config
  - [ ] KV cache fallback
  - [ ] Hardcoded fallback

- [ ] **4.2** Aktualizovat HTML stránky (zásah do obsahu)
  - [ ] `public/index.html` — hero section + intro text
    - [ ] `<div id="cms-ordinace-intro"></div><script>renderSection('ordinace-intro', ...)</script>`
  - [ ] `public/ordinace.html` — intro + galerie
  - [ ] `public/sluzby.html` — service descriptions
  - [ ] `public/moje-cesta.html` — service grid + description per service
  - [ ] `public/magazin.html` — blog articles
  - [ ] Všechny stránky se hardcoded textem → nahradit za CMS placeholdery
  
- [ ] **4.3** Fallback na hardcoded obsah
  - [ ] Ověřit, že pokud API selže → web stále zobrazuje něco rozumného
  - [ ] CSS pro `.cms-loading`, `.cms-error` stavy

---

## 🔧 Checklist — Fáze 5: Bezpečnost & Validace

- [ ] **5.1** Input validation
  - [ ] Page sections: max 10KB, HTML sanitace (DOMPurify)
  - [ ] Filenames: sanitace (no `..`, `/`), SHA256 hash + ext
  - [ ] Image MIME: whitelist `image/jpeg`, `image/png`, `image/webp`
  - [ ] Upload size: max 5MB

- [ ] **5.2** Autentizace
  - [ ] Všechny `/api/admin/*` vyžadují JWT
  - [ ] Ověřit Cloudflare Access token (nebo vlastní JWT)
  - [ ] `/api/public/*` jsou bez auth

- [ ] **5.3** Rate limiting
  - [ ] Max 10 uploads/min per operator (Redis / KV)
  - [ ] DDoS protection (Turnstile na admin, není třeba)

- [ ] **5.4** CORS & Headers
  - [ ] Admin API: allow pouze `admin@bicom-pisek.cz` origin
  - [ ] Public API: open CORS (web potřebuje)

---

## 🔧 Checklist — Fáze 6: Testing & QA

- [ ] **6.1** Unit/Integration testy
  - [ ] API endpoints — mock DB, ověřit request/response
  - [ ] Sanitace HTML — XSS payload test
  - [ ] File upload — velikost, typ, chybové stavy

- [ ] **6.2** E2E test (manuální nebo Playwright)
  - [ ] Operátor se přihlásí do admin
  - [ ] Vytvoří novou sekci
  - [ ] Nahraje obrázek do galerie
  - [ ] Ověří, že se změní na webu (bez reload? refresh po 60s cache?)

- [ ] **6.3** Performance
  - [ ] API latence < 500ms (D1 query)
  - [ ] R2 upload < 2s na 1MB
  - [ ] KV cache hit rate > 95%
  - [ ] No console errors na webu

- [ ] **6.4** Cross-browser
  - [ ] Chrome, Firefox, Safari, Edge
  - [ ] Mobile: iOS Safari, Chrome Android
  - [ ] Responsivní UI admin konzole

---

## 🔧 Checklist — Fáze 7: Documentation & Handover

- [ ] **7.1** Vytvořit `docs/CMS_GUIDE.md`
  - [ ] **Pro operátora:** Jak se přihlásit, editovat texty, nahrát fotky, vidět historii
  - [ ] Screenshots, video návod (optional)
  - [ ] FAQ — co když se něco pokazí, jak rollback

- [ ] **7.2** Aktualizovat `docs/HANDOVER.md`
  - [ ] Nová sekce: "CMS & Obsah webu"
  - [ ] Jak operátor edituje obsah
  - [ ] Jak developer přidá novou sekci

- [ ] **7.3** Aktualizovat `docs/API_KEYS_CHECKLIST.md`
  - [ ] Přidat R2 binding `BICOM_MULTIMEDIA` (mělo by již být)

- [ ] **7.4** Aktualizovat `db/README.md` nebo `db/migrations/README.md`
  - [ ] Počet migrací zvýšit na 0013

---

## 🚀 Checklist — Deployment & Launch

- [ ] **8.1** Lokální testing
  - [ ] `npm run dev` — vše funguje na localhost
  - [ ] Database se inicializuje migracemi

- [ ] **8.2** Staging deployment
  - [ ] Deploy na CF Pages dev build
  - [ ] Ověřit, že všechny endpointy fungují
  - [ ] Ověřit, že R2 binding funguje

- [ ] **8.3** Production deployment
  - [ ] Merge PR do `main`
  - [ ] Měřit: performance, error rate, KV cache hits
  - [ ] SLA: < 1 error za den, < 500ms latence

- [ ] **8.4** Notifikace
  - [ ] Operátor dostane email s CMS_GUIDE.md
  - [ ] Live training call (1h)
  - [ ] Support hotline (chatbot, email)

---

## 📋 Potřebná vstupní data

Aby agent zpracoval task, potřebuje/měl by mít:

- ✅ Přístup k repo (`bicom-pisek-produkcni-repozit`)
- ✅ Přístup do `main` branch (mergovat po review)
- ✅ Znalost struktury: `functions/api/`, `db/migrations/`, `public/assets/`
- ✅ Admin Vue app — kde je? (`public/admin.vue`? `public/admin/`?)
- ✅ JWT library — která se používá? (Cloudflare CF.ACCOUNT? jsonwebtoken? jose?)
- ✅ R2 binding name v kódu — je to `env.BICOM_MULTIMEDIA`? Ověřit v `wrangler.toml`

**Pokud agent neví odpověď, měl by si ji najít (grep, view).**

---

## ⚠️ Úkoly — Předpoklady

Aby tato fáze byla uskutečnitelná bez blokace:

1. **Cloudflare Access** — je operátor `admin@bicom-pisek.cz` přidán? (měl by být, dle HANDOVER.md)
2. **R2 bucket** — `bicom-multimedia` existuje a je navázán v `wrangler.toml` jako `BICOM_MULTIMEDIA`?
3. **D1 database** — `bicom-pisek-db` je online a obsahuje tabulky z `db/schema.sql`?
4. **Vue admin app** — kde přesně je? (`public/admin.vue`? `public/admin/app.vue`? Adresář `public/components/admin/`?)
5. **JWT verification** — jak se v projektu ověřuje JWT? (ACCOUNT API? Custom?)

**Jestli některý předpoklad není splněn, agenta to zablokuje — informuj mě.**

---

## 🎯 Kritéria přijetí (DoD)

Feature je HOTOVÁ, když:

- ✅ Všech 8 API endpointů funguje bez chyb
- ✅ Admin UI se otevře v konzoli bez runtime errors
- ✅ Operátor může:
  - Editovat texty (create, read, update, delete)
  - Nahrát fotky (drag-n-drop, upload na R2)
  - Uspořádat fotky (drag reorder)
  - Vidět historii změn (audit log)
- ✅ Web dynamicky renderuje obsah (test: měň v DB, ověř refresh na webu)
- ✅ Fallback: pokud API padne, web se stále zobrazuje (hardcoded obsah)
- ✅ Bezpečnost: žádné XSS, rate limiting, JWT auth
- ✅ Performance: API < 500ms, R2 upload < 2s, cache > 95% hit rate
- ✅ Zero console errors (dev console, production)
- ✅ Dokumentace: CMS_GUIDE.md + HANDOVER.md updatovány

---

## 🔄 Workflow pro agenta

1. **Přečti spec + examples** (30 min)
2. **Implementuj Fázi 1: Database** (1.5h)
   - Vytvoř migraci, updatuj schema.sql, testuj
3. **Implementuj Fázi 2: API** (3.5h)
   - Admin CRUD + public cache endpointy
4. **Implementuj Fázi 3: Admin UI** (3h)
   - Vue komponenty, integrace do routeru
5. **Implementuj Fázi 4: Web Integration** (2h)
   - CMS client, update HTML stránek
6. **Fáze 5–7: Security, Testing, Docs** (2h)
   - Validace, testy, handover guide

**Celkem: ~12 hodin**

---

## 📞 Při blokaci

Když se agent zasekne:
1. Přečti si znovu spec nebo příslušné sekce
2. Grep/view soubory v repozitáři — odpověď je tam
3. Pokud je to architektonické rozhodnutí (např. "Jak ověřit JWT?"), vrať se do chatu a zeptej se

---

## ✅ Podpis

**Připraveno k zpracování:** 2026-06-20  
**Aktualizáno:** N/A  
**Status:** 🟢 Čeká na agentské zpracování

*Tento checklist je orchestrace. Detaily jsou v CMS-FEATURE-SPEC.md a CMS-IMPLEMENTATION-EXAMPLES.md.*
