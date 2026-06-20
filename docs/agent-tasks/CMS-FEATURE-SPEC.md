# 📋 CMS FEATURE — Obsah webu editorován bez deploymentu

**Status:** 🟢 NAPLÁNOVÁNO  
**Priorita:** 🔴 KRITICKÁ (handover blocker)  
**Odhadovaná práce:** 8–12 hodin  
**Blok:** CMS + Obsah (F11)

---

## 🎯 Cíl

Umožnit operátorům (administrátorům ordinace) měnit **obsah webu přímo z admin konzole** (virtuální kanceláře) **bez nutnosti redeploy** nebo vývojářských zásahů.

### Co by mělo být editovatelné:

1. **Galerie obrázků** — fotky ordinace, služby, články
2. **Textové obsahu** — hero banner, sekční popisky, FAQ, menu
3. **Service popis + obrázky** — dlouhý popis služeb, kategoriální ikony
4. **Blog + obrázky** — články v magazínu (už částečně)
5. **Kontaktní údaje** — titul, úvodní text na webu (bez změny struktury)

### Co zůstane fixní (bez editace):

- HTML struktura a layout (Pages SPA router)
- CSS (branding zůstane konzistentní)
- Navigační struktura (menu items), jen texty popisů

---

## 🏗️ Architektura řešení

### 1. **Datový model** (D1)

Rozšíříme existující `content_blocks` a přidáme nové tabulky pro galerie a assets:

```sql
-- TABULKA 1: Rozšíření obsahu webu (textové sekce)
CREATE TABLE page_sections (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,        -- 'hero-title', 'ordinace-intro', 'faq-intro', atd.
    title TEXT NOT NULL,
    content TEXT NOT NULL,            -- HTML nebo markdown (max 10KB)
    description TEXT,                 -- Interní poznámka pro operátora (co se zde edituje)
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'html', 'heading', 'contact')),
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX idx_page_sections_key ON page_sections(key);

-- TABULKA 2: Galerie obrázků (ordinace, služby, články)
CREATE TABLE gallery_items (
    id TEXT PRIMARY KEY,
    gallery_key TEXT NOT NULL,        -- 'ordinace', 'service-energia', 'blog-post-xyz', atd.
    title TEXT,
    caption TEXT,                     -- Popisek pod obrázkem
    image_url TEXT NOT NULL,          -- R2 URL nebo cesta
    image_filename TEXT,              -- Originální název pro tracking
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX idx_gallery_key ON gallery_items(gallery_key);
CREATE INDEX idx_gallery_sort ON gallery_items(gallery_key, sort_order);

-- TABULKA 3: Hero banner config (s obrázky)
CREATE TABLE hero_config (
    id TEXT PRIMARY KEY,
    page_key TEXT UNIQUE NOT NULL,    -- 'homepage', 'ordinace', atd.
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT,
    cta_link TEXT,
    background_image_url TEXT,        -- R2 URL
    overlay_color TEXT DEFAULT 'rgba(0,0,0,0.3)',
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);

-- TABULKA 4: Service doplnění (association s galerií)
-- services tabulka se rozšíří o sloupec:
ALTER TABLE services ADD COLUMN gallery_key TEXT;
ALTER TABLE services ADD COLUMN hero_image_url TEXT;

-- TABULKA 5: Audit trail pro změny obsahu (audit log)
CREATE TABLE content_audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT CHECK(entity_type IN ('page_section', 'gallery_item', 'hero', 'service')),
    entity_id TEXT NOT NULL,
    action TEXT CHECK(action IN ('create', 'update', 'delete')),
    old_value TEXT,                   -- JSON serialized previous state
    new_value TEXT,                   -- JSON serialized new state
    changed_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES operators(id)
);
```

### 2. **API Endpointy** (Workers)

```
POST   /api/admin/page-sections                  — vytvořit sekci
GET    /api/admin/page-sections                  — vypsat všechny
GET    /api/admin/page-sections/:key             — jednu sekci
PUT    /api/admin/page-sections/:key             — upravit sekci
DELETE /api/admin/page-sections/:key             — smazat sekci

POST   /api/admin/gallery/upload                 — nahrát obrázek (multipart) → R2
GET    /api/admin/gallery/:gallery_key           — vypsat obrázky galerie
PUT    /api/admin/gallery/:id                    — upravit metadata (popis, title)
DELETE /api/admin/gallery/:id                    — smazat obrázek z R2 a DB
POST   /api/admin/gallery/:gallery_key/reorder   — pořadí obrázků (drag-n-drop)

POST   /api/admin/hero/:page_key                 — uložit hero config
GET    /api/admin/hero/:page_key                 — načíst hero config
PUT    /api/admin/hero/:page_key                 — upravit

GET    /api/public/page-sections/:key            — veřejný přístup k textům
GET    /api/public/gallery/:gallery_key          — veřejný přístup k fotkám
GET    /api/public/hero/:page_key                — veřejný přístup k hero
```

**Autentizace:** Všechny `/api/admin/*` endpointy jsou chráněny JWT (Cloudflare Access).  
**Veřejné:** `/api/public/*` dostupné bez přihlášení (pro rendering webu).

### 3. **Frontend — Admin UI** (Vue.js modul v virtuální kanceláři)

Nový tab v admin konzoli: **"Obsah webu"**

#### Struktura UI:

```
┌─ Obsah webu
│  ├─ Sekce textu
│  │  ├─ Formulář (title, content, type)
│  │  ├─ Náhled
│  │  └─ Uložit / Zrušit
│  │
│  ├─ Galerie
│  │  ├─ Výběr galerie (dropdown: ordinace, services, blog)
│  │  ├─ Drag-n-drop upload
│  │  ├─ Preview obrázků (tabulka s thumb)
│  │  ├─ Edit popis / title
│  │  ├─ Odstranit
│  │  └─ Pořadí (drag pro reorder)
│  │
│  └─ Hero banner
│     ├─ Výběr stránky (homepage, ordinace, atd)
│     ├─ Headline, subheadline, CTA text
│     ├─ Upload background image
│     └─ Uložit
```

**Komponenty:**

- `CmsPageSections.vue` — správa textů
- `CmsGallery.vue` — správa fotek
- `CmsHero.vue` — hero banner
- `ContentAuditLog.vue` — changelog

### 4. **Public Web Integration** (HTML + JS)

Stránky se budou dynamicky rendrovat z DB místo hardcoded HTML:

```javascript
// Pseudokód: src/assets/js/cms-client.js
async function renderSection(pageKey) {
  const section = await fetch(`/api/public/page-sections/${pageKey}`).then(r => r.json());
  return section.content; // Inject HTML
}

async function loadGallery(galleryKey, containerId) {
  const items = await fetch(`/api/public/gallery/${galleryKey}`).then(r => r.json());
  // Render obrázky do containeru
}

// Na stranách s obsahu:
// <script>renderSection('ordinace-intro')</script>
// <div id="gallery-ordinace"></div>
// <script>loadGallery('ordinace', 'gallery-ordinace')</script>
```

---

## 📋 Implementační plán (detailní kroki)

### **Fáze 1: Database & Migrace (1–2h)**

1. Vytvořit migraci `0013_cms_content_management.sql`:
   - Nové tabulky: `page_sections`, `gallery_items`, `hero_config`, `content_audit_log`
   - ALTERy na `services` (přidat `gallery_key`, `hero_image_url`)
   - Seed default sekce (hero-title, ordinace-intro, etc.)

2. Aktualizovat `db/schema.sql` s novými tabulkami

3. Testovat lokálně: `wrangler d1 execute DB --local --file=db/migrations/0013_cms_content_management.sql`

### **Fáze 2: API Endpointy (3–4h)**

Vytvořit v `functions/api/`:

1. **`admin/page-sections.js`** (CRUD texty)
   - GET /api/admin/page-sections
   - POST /api/admin/page-sections (create)
   - GET /api/admin/page-sections/:key
   - PUT /api/admin/page-sections/:key
   - DELETE /api/admin/page-sections/:key
   - **Autentizace:** JWT + Cloudflare Access
   - **Audit:** Insert do content_audit_log

2. **`admin/gallery.js`** (CRUD + upload)
   - GET /api/admin/gallery/:gallery_key (vypsat)
   - POST /api/admin/gallery/upload (multipart → R2 + DB)
     - Constraints: max 5MB, image/* mimetypes
     - Filename: sanitize + hash + ext (e.g., `ordinace-abc123.jpg`)
   - PUT /api/admin/gallery/:id (metadata)
   - DELETE /api/admin/gallery/:id (R2 delete + DB delete)
   - POST /api/admin/gallery/:gallery_key/reorder (sort_order update)

3. **`admin/hero.js`** (CRUD hero banner)
   - POST /api/admin/hero/:page_key
   - GET /api/admin/hero/:page_key
   - PUT /api/admin/hero/:page_key

4. **`public/page-sections.js`** (veřejný cache)
   - GET /api/public/page-sections/:key (vrátí z D1, cache 60s v KV)
   - GET /api/public/gallery/:gallery_key (cache 5m)
   - GET /api/public/hero/:page_key (cache 5m)

5. **R2 Binding** (Wrangler):
   - Aktualizovat `wrangler.toml`: `r2_buckets = [ { binding = "BICOM_MULTIMEDIA", bucket_name = "bicom-multimedia" } ]`
   - Použít v upload handler

### **Fáze 3: Admin UI (3–4h)**

Rozšířit `public/assets/js/admin/`:

1. **`cms-page-sections.vue`**
   ```vue
   <template>
     <div class="cms-sections">
       <h2>Textové sekce</h2>
       <div class="section-list">
         <div v-for="section in sections" :key="section.id" class="section-card">
           <input v-model="section.title" />
           <textarea v-model="section.content"></textarea>
           <button @click="saveSection(section)">Uložit</button>
           <button @click="deleteSection(section.id)">Smazat</button>
         </div>
       </div>
       <button @click="createNew">+ Nová sekce</button>
     </div>
   </template>
   ```

2. **`cms-gallery.vue`**
   ```vue
   <template>
     <div class="cms-gallery">
       <h2>Galerie</h2>
       <select v-model="selectedGallery">
         <option value="ordinace">Ordinace</option>
         <option value="service-energia">Energie (služba)</option>
         <!-- ... -->
       </select>
       
       <div class="upload-zone" @drop="onDrop" @dragover.prevent>
         Přetáhněte obrázky sem nebo
         <input type="file" @change="onFileSelect" multiple accept="image/*" />
       </div>
       
       <div class="gallery-items" v-sortable="{ onEnd: onReorder }">
         <div v-for="img in items" :key="img.id" class="gallery-item">
           <img :src="img.image_url" />
           <input v-model="img.caption" placeholder="Popis" />
           <button @click="save(img)">Uložit</button>
           <button @click="delete_(img.id)">Smazat</button>
         </div>
       </div>
     </div>
   </template>
   ```

3. **`cms-hero.vue`** — Hero banner config

4. **`cms-audit-log.vue`** — Audit trail (kdo co a kdy změnil)

5. Přidat do `admin-router.vue` nový route: `/admin/cms`

### **Fáze 4: Web Integration (2–3h)**

1. Vytvořit `public/assets/js/cms-client.js` pro veřejný web
   - Funkce: `loadSection()`, `loadGallery()`, `loadHero()`
   - KV cache fallback pro offline režim

2. Aktualizovat HTML stránky:
   - `ordinace.html` — `<div id="cms-ordinace-intro"></div>` + `<script>loadSection('ordinace-intro')</script>`
   - `galerie.html` — `<div id="cms-gallery-ordinace"></div>` + `loadGallery('ordinace', ...)`
   - `magazine.html` — blog články
   - Ostatní stránky s statickým textem

3. Fallback na hardcoded obsah (pokud API down)

### **Fáze 5: Testing & Docs (1–2h)**

1. E2E test: operátor nahraje obrázek, změní text, ověří na webu
2. Aktualizovat `HANDOVER.md` — sekce o CMS pro operátora
3. Create inline help texty v admin UI
4. Performance: měřit latenci API, cache hits

---

## 🗄️ Soubory k vytvoření / úpravě

### Nové soubory:

```
db/migrations/0013_cms_content_management.sql
functions/api/admin/page-sections.js
functions/api/admin/gallery.js
functions/api/admin/hero.js
functions/api/public/page-sections.js
public/assets/js/admin/cms-page-sections.vue
public/assets/js/admin/cms-gallery.vue
public/assets/js/admin/cms-hero.vue
public/assets/js/admin/cms-audit-log.vue
public/assets/js/cms-client.js
docs/CMS_GUIDE.md
```

### Úpravy existujících souborů:

```
db/schema.sql
  ├─ Přidat CREATE TABLE pro nové tabulky
  └─ ALTERy na services

wrangler.toml
  └─ Přidat R2 binding

public/admin-router.vue (nebo admin app)
  └─ Přidat route /admin/cms s komponentami CMS

public/*.html (všechny strany)
  └─ Nahradit hardcoded texty za CMS placeholdery

docs/HANDOVER.md
  └─ Přidat sekci "Jak editovat obsah webu"
```

---

## 🔐 Bezpečnost & Validace

### Input validation:

- **Textový obsah:** Max 10KB, HTML sanitize (DOMPurify), XSS check
- **Filenames:** Sanitize (remove `..`, `/`, atd.), SHA256 hash + ext
- **Image MIME:** Whitelist `image/jpeg`, `image/png`, `image/webp`
- **Upload size:** Max 5MB na soubor
- **Rate limiting:** 10 uploads/min per operator (Redis / CF KV)

### Autentizace:

- Všechny `/api/admin/` endpointy vyžadují JWT (z Cloudflare Access)
- Veřejné `/api/public/` bez auth (ale cached)

### Audit trail:

- Každá změna se loguje do `content_audit_log` s operátorovým ID a timestampem
- Operátor vidí changelog v UI (kdo, co, kdy)

---

## ⚡ Performance Optimization

1. **KV cache** pro `/api/public/*`:
   - `page-sections`: 60 sekund
   - `gallery`: 5 minut
   - `hero`: 5 minut
   - Cache key: `cms:section:{key}`, `cms:gallery:{key}`

2. **Image optimization**:
   - R2 image variant generation (resize na 800px wide pro web)
   - WebP conversion (CF Image Optimization)
   - CDN caching (CF Cache Rules)

3. **Database**:
   - Indexy na `page_sections(key)`, `gallery_items(gallery_key, sort_order)`
   - Lazy load obrázků (pagination, limit 20 per request)

---

## 📚 Handover Documentation

Vytvořit `docs/CMS_GUIDE.md` s:

1. **Pro operátora:**
   - Jak se přihlásit do "Obsahu webu"
   - Jak editovat texty (s příklady)
   - Jak nahrát fotky (drag-n-drop)
   - Jak uspořádat fotky (drag order)
   - Jak vidět historii změn

2. **Technika (pro developery po handoveru):**
   - Jak přidat novou sekci (přidat do DB, přidat do UI, přidat na web)
   - Jak migrovat stávající obsah z hardcoded → CMS
   - Backups (`db/backups/`, R2 versioning)

---

## ✅ Kritéria přijetí (DoD)

- [x] Databáze: 5 nových tabulek + ALTERy, bez chyb
- [x] API: Všech 8 endpointů funguje (GET/POST/PUT/DELETE), validace, error handling
- [x] Admin UI: Všechny 4 moduly (sekce, galerie, hero, audit) — výstup v CSS designu
- [x] Web: Dynamicky renderuje obsah z API (fallback na hardcoded)
- [x] Bezpečnost: JWT + input validation + rate limiting, bez XSS
- [x] Performance: KV cache, <500ms latence na public API
- [x] Testing: E2E test operátor→upload→web, 0 console errors
- [x] Docs: HANDOVER.md + CMS_GUIDE.md, 100% pokrytí UI
- [x] Audit: content_audit_log plnit, operátor vidí changelog

---

## 📊 Časový odhad

| Fáze | Aktivita | Hodin |
|------|----------|-------|
| 1 | Database & Migrace | 1.5 |
| 2 | API Endpointy | 3.5 |
| 3 | Admin UI (Vue) | 3 |
| 4 | Web Integration | 2 |
| 5 | Testing & Docs | 1.5 |
| **CELKEM** | | **~12 hodin** |

---

## 🚀 Příští kroky po implementaci

1. Migrovat existující hardcoded obsah → CMS (1–2h manuální)
2. Training operátora (1h)
3. Go-live na produkci (1–2h deploy + testing)
4. Měsíční monitoring (uptime, cache hits, audit log)

---

## 📎 Závislosti & Bloky

- Vyžaduje: JWT autentizaci (✅ hotovo)
- Vyžaduje: R2 binding (✅ v wrangler.toml)
- Vyžaduje: Vue.js admin app (✅ existuje)
- Závisí na: Operátor musí mít Cloudflare Access SSO (✅ admin@bicom-pisek.cz)

---

## Poznámky

- **Migrační data:** První seed s default sekcemi a proměnlivým obsahem (hero, intro texty)
- **Rollback:** V případě chyby se vrátit na poslední backup v `backups/` a znovu deployovat
- **Budoucí rozšíření:** Newsletter template editor, SMS template editor, automatické generování OG images

---

*Verze 1.0 · 2026-06-20 · Připraveno k agentskému zpracování*
