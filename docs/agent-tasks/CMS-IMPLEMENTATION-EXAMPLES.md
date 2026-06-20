# 🔧 CMS — Implementační příklady & kód (vzorový obsah)

Tento dokument doplňuje [CMS-FEATURE-SPEC.md](CMS-FEATURE-SPEC.md) — obsahuje konkrétní kód a SQL, kterou budou agenti zpracovávat.

---

## 1️⃣ Database Migrace (db/migrations/0013_cms_content_management.sql)

```sql
-- Migration 0013: CMS Content Management
-- Adds: page_sections, gallery_items, hero_config, content_audit_log
-- Extends: services (add gallery_key, hero_image_url)
--
-- Run: wrangler d1 execute bicom-pisek-db --local --file=db/migrations/0013_cms_content_management.sql

-- ============================================================
-- PAGE SECTIONS — Textové obsahu webu
-- ============================================================

CREATE TABLE IF NOT EXISTS page_sections (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,                -- HTML/markdown, max 10KB
    description TEXT,                     -- Help text: "Úvodní text na homepage"
    type TEXT DEFAULT 'text' CHECK(type IN ('text', 'html', 'heading', 'contact')),
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_page_sections_key ON page_sections(key);

-- ============================================================
-- GALLERY ITEMS — Obrázky v galeriích
-- ============================================================

CREATE TABLE IF NOT EXISTS gallery_items (
    id TEXT PRIMARY KEY,
    gallery_key TEXT NOT NULL,            -- 'ordinace', 'service-energia', 'blog-post-xyz'
    title TEXT,
    caption TEXT,                         -- Popis pod obrázkem
    image_url TEXT NOT NULL,              -- R2 URL
    image_filename TEXT,                  -- Orig filename
    sort_order INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    updated_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_gallery_key ON gallery_items(gallery_key);
CREATE INDEX IF NOT EXISTS idx_gallery_sort ON gallery_items(gallery_key, sort_order);

-- ============================================================
-- HERO CONFIG — Hero banner per page
-- ============================================================

CREATE TABLE IF NOT EXISTS hero_config (
    id TEXT PRIMARY KEY,
    page_key TEXT UNIQUE NOT NULL,        -- 'homepage', 'ordinace'
    headline TEXT,
    subheadline TEXT,
    cta_text TEXT,
    cta_link TEXT,
    background_image_url TEXT,            -- R2 URL
    overlay_color TEXT DEFAULT 'rgba(0,0,0,0.3)',
    updated_by TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES operators(id)
);

-- ============================================================
-- CONTENT AUDIT LOG — Změny obsahu
-- ============================================================

CREATE TABLE IF NOT EXISTS content_audit_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT CHECK(entity_type IN ('page_section', 'gallery_item', 'hero', 'service')),
    entity_id TEXT NOT NULL,
    action TEXT CHECK(action IN ('create', 'update', 'delete')),
    old_value TEXT,                       -- JSON
    new_value TEXT,                       -- JSON
    changed_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES operators(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON content_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON content_audit_log(created_at);

-- ============================================================
-- ALTER services — Add CMS fields
-- ============================================================

ALTER TABLE services ADD COLUMN gallery_key TEXT DEFAULT NULL;
ALTER TABLE services ADD COLUMN hero_image_url TEXT DEFAULT NULL;

-- ============================================================
-- DEFAULT DATA — Seed page_sections
-- ============================================================

INSERT OR IGNORE INTO page_sections (id, key, title, content, description, type, updated_by)
VALUES
    (lower(hex(randomblob(8))), 'homepage-hero-title', 'Bicom Písek — Biorezonance',
     '<h1>Cesta k rovnováze skrze biorezonanci</h1>', 'Hero nadpis na homepage', 'html', NULL),
    
    (lower(hex(randomblob(8))), 'ordinace-intro', 'O naší ordinaci',
     '<p>Vítejte v ordinaci Bicom Písek.</p>', 'Úvodní text na stránce "Naše ordinace"', 'text', NULL),
    
    (lower(hex(randomblob(8))), 'moje-cesta-intro', 'Moje cesta k rovnováze',
     '<p>Jednotlivé problémy, které řešíme...</p>', 'Intro text před seznamem služeb', 'text', NULL),
    
    (lower(hex(randomblob(8))), 'faq-title', 'Často kladené otázky',
     '<h2>FAQ — Biorezonance</h2>', 'Nadpis FAQ sekcí', 'heading', NULL);

-- Seed hero configs
INSERT OR IGNORE INTO hero_config (id, page_key, headline, subheadline, cta_text, cta_link, background_image_url)
VALUES
    (lower(hex(randomblob(8))), 'homepage', 
     'Cesta k rovnováze', 'Biorezonance pro zdraví a vitalitu',
     'Rezervovat konzultaci', '/book',
     'https://r2-url.example.com/hero-homepage.jpg');

-- ============================================================
-- Done
-- ============================================================
</sql>
```

---

## 2️⃣ API Endpointy — Admin CRUD

### A) `functions/api/admin/page-sections.js`

```javascript
// functions/api/admin/page-sections.js
// Endpoints:
//   GET  /api/admin/page-sections
//   POST /api/admin/page-sections
//   GET  /api/admin/page-sections/:key
//   PUT  /api/admin/page-sections/:key
//   DELETE /api/admin/page-sections/:key

import { verifyJWT, auditLog } from '../lib/auth.js';
import { sanitizeHTML } from '../lib/sanitize.js';
import { v4 as uuidv4 } from 'uuid';

export default {
  async fetch(request, env) {
    // Verify JWT
    const user = await verifyJWT(request, env);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const url = new URL(request.url);
    const method = request.method;
    const key = url.searchParams.get('key');
    const pathParts = url.pathname.split('/').filter(p => p);

    try {
      if (method === 'GET') {
        if (key) {
          // GET /api/admin/page-sections/:key
          const db = env.DB;
          const result = await db.prepare(
            'SELECT * FROM page_sections WHERE key = ?'
          ).bind(key).first();
          
          if (!result) return new Response('Not found', { status: 404 });
          return new Response(JSON.stringify(result), { status: 200 });
        } else {
          // GET /api/admin/page-sections (list all)
          const db = env.DB;
          const results = await db.prepare(
            'SELECT id, key, title, description, type, updated_at FROM page_sections ORDER BY key'
          ).all();
          return new Response(JSON.stringify(results.results || []), { status: 200 });
        }
      }

      if (method === 'POST') {
        // POST /api/admin/page-sections (create)
        const body = await request.json();
        const db = env.DB;
        
        if (!body.key || !body.title || !body.content) {
          return new Response('Missing required fields', { status: 400 });
        }

        const id = uuidv4();
        const sanitized = sanitizeHTML(body.content);
        
        await db.prepare(`
          INSERT INTO page_sections (id, key, title, content, description, type, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(id, body.key, body.title, sanitized, body.description || '', body.type || 'text', user.id).run();

        // Audit
        await auditLog(db, 'page_section', id, 'create', null, JSON.stringify(body), user.id);

        // Invalidate cache
        await env.KV.delete(`cms:section:${body.key}`);

        return new Response(JSON.stringify({ id }), { status: 201 });
      }

      if (method === 'PUT') {
        // PUT /api/admin/page-sections/:key (update)
        const body = await request.json();
        const db = env.DB;

        const existing = await db.prepare('SELECT * FROM page_sections WHERE key = ?').bind(key).first();
        if (!existing) return new Response('Not found', { status: 404 });

        const sanitized = sanitizeHTML(body.content || existing.content);

        await db.prepare(`
          UPDATE page_sections 
          SET title = ?, content = ?, description = ?, type = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE key = ?
        `).bind(body.title || existing.title, sanitized, body.description || existing.description, 
                body.type || existing.type, user.id, key).run();

        // Audit
        await auditLog(db, 'page_section', existing.id, 'update', JSON.stringify(existing), JSON.stringify(body), user.id);

        // Invalidate cache
        await env.KV.delete(`cms:section:${key}`);

        return new Response('OK', { status: 200 });
      }

      if (method === 'DELETE') {
        // DELETE /api/admin/page-sections/:key
        const db = env.DB;
        const existing = await db.prepare('SELECT id FROM page_sections WHERE key = ?').bind(key).first();
        
        if (!existing) return new Response('Not found', { status: 404 });

        await db.prepare('DELETE FROM page_sections WHERE key = ?').bind(key).run();

        // Audit
        await auditLog(db, 'page_section', existing.id, 'delete', JSON.stringify(existing), null, user.id);

        // Invalidate cache
        await env.KV.delete(`cms:section:${key}`);

        return new Response('Deleted', { status: 200 });
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (err) {
      console.error('CMS Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
```

### B) `functions/api/admin/gallery.js` (zkráceno)

```javascript
// functions/api/admin/gallery.js
// Endpoints:
//   POST /api/admin/gallery/upload (multipart)
//   GET  /api/admin/gallery/:gallery_key
//   PUT  /api/admin/gallery/:id (metadata)
//   DELETE /api/admin/gallery/:id
//   POST /api/admin/gallery/:gallery_key/reorder (sort)

import { verifyJWT, auditLog } from '../lib/auth.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export default {
  async fetch(request, env) {
    const user = await verifyJWT(request, env);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const url = new URL(request.url);
    const method = request.method;

    try {
      if (method === 'POST' && url.pathname.includes('/upload')) {
        // POST /api/admin/gallery/upload
        const formData = await request.formData();
        const file = formData.get('file');
        const galleryKey = formData.get('gallery_key');

        if (!file || !galleryKey) {
          return new Response('Missing file or gallery_key', { status: 400 });
        }

        // Validate
        if (file.size > 5 * 1024 * 1024) { // 5MB
          return new Response('File too large', { status: 413 });
        }
        if (!file.type.startsWith('image/')) {
          return new Response('Not an image', { status: 400 });
        }

        // Upload to R2
        const hash = crypto.randomBytes(8).toString('hex');
        const ext = file.name.split('.').pop();
        const r2Key = `cms/${galleryKey}/${hash}.${ext}`;
        
        const buffer = await file.arrayBuffer();
        await env.BICOM_MULTIMEDIA.put(r2Key, buffer, {
          httpMetadata: { contentType: file.type }
        });

        // Get R2 URL
        const imageUrl = `https://cdn.bicom-pisek.cz/${r2Key}`;

        // Save to DB
        const id = uuidv4();
        const db = env.DB;
        await db.prepare(`
          INSERT INTO gallery_items (id, gallery_key, image_url, image_filename, sort_order, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM gallery_items WHERE gallery_key = ?), ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(id, galleryKey, imageUrl, file.name, galleryKey, user.id).run();

        // Audit
        await auditLog(db, 'gallery_item', id, 'create', null, JSON.stringify({ gallery_key: galleryKey, filename: file.name }), user.id);

        // Invalidate cache
        await env.KV.delete(`cms:gallery:${galleryKey}`);

        return new Response(JSON.stringify({ id, url: imageUrl }), { status: 201 });
      }

      if (method === 'GET') {
        // GET /api/admin/gallery/:gallery_key
        const galleryKey = url.pathname.split('/')[4];
        const db = env.DB;
        const items = await db.prepare(`
          SELECT id, title, caption, image_url, sort_order, active
          FROM gallery_items
          WHERE gallery_key = ? AND active = 1
          ORDER BY sort_order
        `).bind(galleryKey).all();

        return new Response(JSON.stringify(items.results || []), { status: 200 });
      }

      if (method === 'PUT') {
        // PUT /api/admin/gallery/:id (metadata)
        const id = url.pathname.split('/')[4];
        const body = await request.json();
        const db = env.DB;

        await db.prepare(`
          UPDATE gallery_items
          SET title = ?, caption = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(body.title, body.caption, user.id, id).run();

        // Audit + cache invalidation (omitted for brevity)
        return new Response('OK', { status: 200 });
      }

      if (method === 'DELETE') {
        // DELETE /api/admin/gallery/:id
        const id = url.pathname.split('/')[4];
        const db = env.DB;

        const item = await db.prepare('SELECT * FROM gallery_items WHERE id = ?').bind(id).first();
        if (!item) return new Response('Not found', { status: 404 });

        // Delete from R2
        const r2Key = item.image_url.split('/cdn.bicom-pisek.cz/')[1];
        await env.BICOM_MULTIMEDIA.delete(r2Key);

        // Delete from DB
        await db.prepare('DELETE FROM gallery_items WHERE id = ?').bind(id).run();

        // Audit + cache invalidation
        return new Response('Deleted', { status: 200 });
      }

      if (method === 'POST' && url.pathname.includes('/reorder')) {
        // POST /api/admin/gallery/:gallery_key/reorder
        const body = await request.json(); // { items: [{ id: '...', sort_order: 0 }, ...] }
        const db = env.DB;

        for (const item of body.items) {
          await db.prepare('UPDATE gallery_items SET sort_order = ? WHERE id = ?')
            .bind(item.sort_order, item.id).run();
        }

        return new Response('Reordered', { status: 200 });
      }

      return new Response('Method not allowed', { status: 405 });
    } catch (err) {
      console.error('Gallery Error:', err);
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }
};
```

---

## 3️⃣ Veřejné API — Cache + Fallback

### `functions/api/public/page-sections.js`

```javascript
// functions/api/public/page-sections.js
// GET /api/public/page-sections/:key
// (Veřejný endpoint s KV cache)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.split('/').pop();

    // Try KV cache first (60s TTL)
    const cacheKey = `cms:section:${key}`;
    const cached = await env.KV.get(cacheKey, 'json');
    if (cached) return new Response(JSON.stringify(cached), { status: 200 });

    // Fall back to D1
    try {
      const db = env.DB;
      const section = await db.prepare(
        'SELECT id, title, content FROM page_sections WHERE key = ? LIMIT 1'
      ).bind(key).first();

      if (!section) {
        return new Response('Not found', { status: 404 });
      }

      // Cache for 60s
      await env.KV.put(cacheKey, JSON.stringify(section), { expirationTtl: 60 });

      return new Response(JSON.stringify(section), { status: 200 });
    } catch (err) {
      // If DB fails, return hardcoded fallback
      const fallback = {
        id: 'fallback',
        content: '<p>Obsah není dostupný. Zkuste později.</p>'
      };
      return new Response(JSON.stringify(fallback), { status: 503 });
    }
  }
};
```

---

## 4️⃣ Admin UI — Vue komponenta

### `public/assets/js/admin/CmsPageSections.vue`

```vue
<template>
  <div class="cms-container">
    <h2>📝 Textové sekce webu</h2>

    <div class="sections-list">
      <div v-for="section in sections" :key="section.key" class="section-card">
        <div class="header">
          <span class="key-badge">{{ section.key }}</span>
          <span class="type-badge">{{ section.type }}</span>
        </div>

        <label>
          Nadpis:
          <input v-model="section.title" type="text" placeholder="Nadpis sekce" />
        </label>

        <label>
          Obsah (HTML):
          <textarea
            v-model="section.content"
            rows="6"
            placeholder="HTML obsah..."
          ></textarea>
        </label>

        <label>
          Popis pro operátora:
          <input
            v-model="section.description"
            type="text"
            placeholder="Např. 'Hero nadpis na homepage'"
          />
        </label>

        <div class="actions">
          <button @click="saveSection(section)" class="btn btn-primary">
            💾 Uložit
          </button>
          <button @click="deleteSection(section.id)" class="btn btn-danger">
            🗑️ Smazat
          </button>
        </div>
      </div>
    </div>

    <button @click="createNew" class="btn btn-success">
      ➕ Nová sekce
    </button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      sections: [],
      loading: false
    };
  },

  async mounted() {
    await this.loadSections();
  },

  methods: {
    async loadSections() {
      this.loading = true;
      try {
        const res = await fetch('/api/admin/page-sections');
        const data = await res.json();
        this.sections = data || [];
      } catch (err) {
        console.error('Load error:', err);
        alert('Chyba při načítání sekcí');
      } finally {
        this.loading = false;
      }
    },

    async saveSection(section) {
      try {
        const method = section.id ? 'PUT' : 'POST';
        const url = section.id
          ? `/api/admin/page-sections?key=${section.key}`
          : '/api/admin/page-sections';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(section)
        });

        if (res.ok) {
          alert('✅ Sekce uložena');
          await this.loadSections();
        } else {
          alert('❌ Chyba: ' + (await res.text()));
        }
      } catch (err) {
        console.error('Save error:', err);
        alert('Chyba při ukládání');
      }
    },

    async deleteSection(id) {
      if (!confirm('Opravdu smazat tuto sekci?')) return;

      try {
        const section = this.sections.find(s => s.id === id);
        const res = await fetch(`/api/admin/page-sections?key=${section.key}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          alert('✅ Sekce smazána');
          await this.loadSections();
        }
      } catch (err) {
        alert('Chyba při mazání');
      }
    },

    createNew() {
      const newKey = prompt('Zadejte klíč sekce (např. hero-title):');
      if (!newKey) return;

      this.sections.push({
        id: null,
        key: newKey,
        title: '',
        content: '',
        description: '',
        type: 'text'
      });
    }
  }
};
</script>

<style scoped>
.cms-container {
  max-width: 1000px;
  margin: 20px auto;
}

.sections-list {
  display: grid;
  gap: 20px;
  margin: 20px 0;
}

.section-card {
  border: 1px solid #ddd;
  padding: 20px;
  border-radius: 8px;
  background: #f9f9f9;
}

.header {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.key-badge {
  background: #007bff;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.type-badge {
  background: #6c757d;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

label {
  display: block;
  margin: 10px 0;
  font-weight: bold;
}

input,
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-success {
  background: #28a745;
  color: white;
  margin-top: 20px;
  width: 100%;
  padding: 15px;
  font-size: 16px;
}
</style>
```

---

## 5️⃣ Web Integration — dynamický obsah

### `public/assets/js/cms-client.js`

```javascript
// public/assets/js/cms-client.js
// Utilities pro dynamické renderování obsahu na webu

export async function renderSection(key, containerId) {
  try {
    const res = await fetch(`/api/public/page-sections/${key}`);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = data.content;
    }
  } catch (err) {
    console.warn(`CMS render failed for ${key}:`, err);
    // Fallback: keep original HTML (já v HTML je)
  }
}

export async function loadGallery(galleryKey, containerId, { limit = 20 } = {}) {
  try {
    const res = await fetch(`/api/public/gallery/${galleryKey}`);
    if (!res.ok) throw new Error(`API ${res.status}`);

    const items = await res.json();
    const container = document.getElementById(containerId);
    if (!container) return;

    // Render gallery (simple grid)
    const html = items
      .slice(0, limit)
      .map(
        item => `
        <div class="gallery-item">
          <img src="${item.image_url}" alt="${item.title || ''}" loading="lazy" />
          ${item.caption ? `<p class="caption">${item.caption}</p>` : ''}
        </div>
      `
      )
      .join('');

    container.innerHTML = html;
  } catch (err) {
    console.warn(`Gallery load failed for ${galleryKey}:`, err);
  }
}

export async function loadHero(pageKey) {
  try {
    const res = await fetch(`/api/public/hero/${pageKey}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`Hero load failed for ${pageKey}:`, err);
    return null;
  }
}
```

### Použití v HTML:

```html
<!-- public/ordinace.html (příklad) -->
<section id="ordinace-intro" class="intro-section">
  <!-- Default obsah, pokud API selže -->
  <p>Vítejte v ordinaci Bicom Písek...</p>
</section>

<script type="module">
  import { renderSection, loadGallery } from './assets/js/cms-client.js';
  
  // Nahradit hardcoded text za CMS
  renderSection('ordinace-intro', 'ordinace-intro');
  
  // Načíst galerii fotek
  loadGallery('ordinace', 'gallery-container');
</script>
```

---

## 6️⃣ Pomocné funkce

### `functions/lib/auth.js`

```javascript
// Extrahovat JWT, ověřit podpis
export async function verifyJWT(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Ověřit u Cloudflare Access (nebo vlastní JWT)
    const user = await env.ACCOUNT.verify(token); // Cloudflare API
    return user;
  } catch (err) {
    console.error('JWT verify error:', err);
    return null;
  }
}

export async function auditLog(db, entityType, entityId, action, oldValue, newValue, userId) {
  const id = require('uuid').v4();
  await db.prepare(`
    INSERT INTO content_audit_log (id, entity_type, entity_id, action, old_value, new_value, changed_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(id, entityType, entityId, action, oldValue, newValue, userId).run();
}
```

### `functions/lib/sanitize.js`

```javascript
// Sanitize HTML (prevent XSS)
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHTML(html) {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'ul', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'title', 'target']
  });
}
```

---

## 📝 Shrnutí souborů

| Soubor | Typ | Účel |
|--------|-----|------|
| `db/migrations/0013_cms_content_management.sql` | SQL | Nové tabulky + ALTER |
| `functions/api/admin/page-sections.js` | Worker | CRUD texty |
| `functions/api/admin/gallery.js` | Worker | CRUD galerie + R2 upload |
| `functions/api/public/page-sections.js` | Worker | Veřejné rozhraní + KV cache |
| `public/assets/js/admin/CmsPageSections.vue` | Vue | Admin UI sekce |
| `public/assets/js/cms-client.js` | JS | Client-side dynamický render |

---

*Toto jsou vzorové implementace; agent je bude adaptovat na konkrétní strukturu repozitáře a detaily projektu.*
