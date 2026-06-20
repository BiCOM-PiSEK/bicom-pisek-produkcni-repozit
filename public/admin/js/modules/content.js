/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Modul „Obsah webu" (CMS / F11)
 * ═══════════════════════════════════════════════════════════════
 * Vanilla ES6 modul (stejný kontrakt jako ostatní: render/destroy).
 * Čtyři záložky:
 *   • Texty    — sekce z content_blocks (CRUD)
 *   • Galerie  — obrázky z gallery_items (upload do R2, reorder, mazání)
 *   • Hero     — hero bannery z hero_config (upsert)
 *   • Historie — audit_log filtrovaný na CMS změny
 * ═══════════════════════════════════════════════════════════════
 */

let _ctx = null;

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str == null ? '' : String(str);
  return el.innerHTML;
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return esc(ts);
  return d.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export async function render(container, ctx) {
  _ctx = ctx;

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Obsah webu</h1>
      <p class="canvas-subtitle">Upravujte texty, fotky a bannery webu — změny se projeví bez nasazení vývojářem (do minuty díky cache).</p>
    </div>

    <div class="cms-tabs" style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.5rem; border-bottom:1px solid rgba(115,138,117,0.15); padding-bottom:.75rem;">
      <button class="btn btn-primary cms-tab" data-tab="texty">📝 Texty</button>
      <button class="btn btn-secondary cms-tab" data-tab="galerie">🖼️ Galerie</button>
      <button class="btn btn-secondary cms-tab" data-tab="hero">🎯 Hero bannery</button>
      <button class="btn btn-secondary cms-tab" data-tab="historie">🕓 Historie změn</button>
    </div>

    <div id="cms-tab-body"><div class="card"><div class="card-body">Načítám…</div></div></div>
  `;

  const tabs = container.querySelectorAll('.cms-tab');
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => {
        const active = x === t;
        x.classList.toggle('btn-primary', active);
        x.classList.toggle('btn-secondary', !active);
      });
      switchTab(container, t.dataset.tab);
    });
  });

  await switchTab(container, 'texty');
}

async function switchTab(container, tab) {
  const body = container.querySelector('#cms-tab-body');
  body.innerHTML = `<div class="card"><div class="card-body">Načítám…</div></div>`;
  try {
    if (tab === 'texty') return renderTexty(body);
    if (tab === 'galerie') return renderGalerie(body);
    if (tab === 'hero') return renderHero(body);
    if (tab === 'historie') return renderHistorie(body);
  } catch (err) {
    console.error('[cms] tab error:', err);
    body.innerHTML = `<div class="card"><div class="card-body">Chyba: ${esc(err.message)}</div></div>`;
  }
}

// ─── TEXTY (content_blocks) ───────────────────────────────────

async function renderTexty(body) {
  const { api, showToast } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getContentSections();
  const sections = res.ok ? (res.data?.sections || []) : [];

  body.innerHTML = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
      <button class="btn btn-primary" id="cms-new-section">➕ Nová sekce</button>
    </div>
    <div id="cms-sections">
      ${sections.length ? sections.map(sectionCard).join('') : emptyCard('Zatím žádné textové sekce.')}
    </div>
  `;

  body.querySelector('#cms-new-section').addEventListener('click', () => {
    const key = prompt('Klíč nové sekce (malá písmena, číslice, pomlčky):\nnapř. ordinace-intro');
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalized)) { showToast('Neplatný klíč — jen a–z, 0–9 a pomlčky.', 'error'); return; }
    const list = body.querySelector('#cms-sections');
    if (list.querySelector('.empty-state')) list.innerHTML = '';
    list.insertAdjacentHTML('afterbegin', sectionCard({ section_key: normalized, title: '', content_markdown: '', content_type: 'text', updated_at: null, _new: true }));
    wireSectionCard(body, list.firstElementChild);
  });

  body.querySelectorAll('.cms-section-card').forEach((card) => wireSectionCard(body, card));
}

function sectionCard(s) {
  return `
    <div class="card mb-6 cms-section-card" data-key="${esc(s.section_key)}" data-new="${s._new ? '1' : '0'}">
      <div class="card-header" style="display:flex; align-items:center; justify-content:space-between;">
        <h3 class="card-title">📝 ${esc(s.section_key)}</h3>
        <span class="form-hint" style="margin:0;">Upraveno: ${fmtDate(s.updated_at)}</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Nadpis</label>
          <input type="text" class="form-input" data-field="title" value="${esc(s.title)}" placeholder="Nadpis sekce">
        </div>
        <div class="form-group">
          <label class="form-label">Obsah</label>
          <textarea class="form-input" data-field="content_markdown" rows="5" placeholder="Text (lze i jednoduché HTML: &lt;p&gt;, &lt;strong&gt;, &lt;a&gt;…)">${esc(s.content_markdown)}</textarea>
          <p class="form-hint">Povolené značky: odstavce, tučné, kurzíva, nadpisy, seznamy, odkazy. Skripty se automaticky odstraní.</p>
        </div>
        <div class="form-group">
          <label class="form-label">Typ</label>
          <select class="form-select" data-field="content_type" style="width:200px;">
            ${['text', 'faq', 'config'].map((t) => `<option value="${t}" ${s.content_type === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; gap:.5rem;">
          <button class="btn btn-primary" data-action="save">💾 Uložit</button>
          <button class="btn btn-danger" data-action="delete">🗑️ Smazat</button>
        </div>
      </div>
    </div>`;
}

function wireSectionCard(body, card) {
  const { api, showToast } = _ctx;
  const key = card.dataset.key;
  const val = (f) => card.querySelector(`[data-field="${f}"]`).value;

  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const payload = { section_key: key, title: val('title'), content_markdown: val('content_markdown'), content_type: val('content_type') };
    if (!payload.title.trim() || !payload.content_markdown.trim()) { showToast('Vyplňte nadpis i obsah.', 'error'); return; }
    const isNew = card.dataset.new === '1';
    const res = isNew ? await api.createContentSection(payload) : await api.updateContentSection(payload);
    if (res.ok) { showToast('Sekce uložena ✓', 'success'); await renderTexty(body); }
    else showToast('Chyba: ' + res.error, 'error');
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (card.dataset.new === '1') { card.remove(); return; }
    if (!confirm(`Opravdu smazat sekci „${key}"?`)) return;
    const res = await api.deleteContentSection(key);
    if (res.ok) { showToast('Sekce smazána ✓', 'success'); await renderTexty(body); }
    else showToast('Chyba: ' + res.error, 'error');
  });
}

// ─── GALERIE (gallery_items) ──────────────────────────────────

async function renderGalerie(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getGalleries();
  const galleries = res.ok ? (res.data?.galleries || []) : [];

  body.innerHTML = `
    <div class="card mb-6">
      <div class="card-body" style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Galerie</label>
          <select class="form-select" id="cms-gallery-select" style="min-width:240px;">
            ${galleries.map((g) => `<option value="${esc(g.gallery_key)}">${esc(g.gallery_key)} (${g.count})</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">…nebo nová galerie</label>
          <input type="text" class="form-input" id="cms-gallery-new" placeholder="napr. service-energia" style="width:220px;">
        </div>
        <button class="btn btn-secondary" id="cms-gallery-load">Otevřít</button>
      </div>
    </div>
    <div id="cms-gallery-detail"></div>
  `;

  const sel = body.querySelector('#cms-gallery-select');
  const detail = body.querySelector('#cms-gallery-detail');
  const loadSelected = () => {
    const newKey = body.querySelector('#cms-gallery-new').value.trim().toLowerCase();
    const key = newKey || sel.value;
    if (key) renderGalleryDetail(detail, key);
  };
  body.querySelector('#cms-gallery-load').addEventListener('click', loadSelected);
  sel.addEventListener('change', () => renderGalleryDetail(detail, sel.value));

  if (galleries.length) renderGalleryDetail(detail, galleries[0].gallery_key);
  else detail.innerHTML = emptyCard('Žádné galerie. Vytvořte novou zadáním klíče a nahráním fotky.');
}

async function renderGalleryDetail(detail, galleryKey) {
  const { api, showToast } = _ctx;
  detail.innerHTML = `<div class="card"><div class="card-body">Načítám galerii „${esc(galleryKey)}"…</div></div>`;

  const res = await api.getGalleryItems(galleryKey);
  const items = res.ok ? (res.data?.items || []) : [];

  detail.innerHTML = `
    <div class="card mb-6">
      <div class="card-header"><h3 class="card-title">🖼️ Galerie „${esc(galleryKey)}"</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Nahrát obrázek</label>
          <input type="file" class="form-input" id="cms-upload" accept="image/jpeg,image/png,image/webp,image/gif" multiple>
          <p class="form-hint">Max 5 MB na soubor. Formáty: JPEG, PNG, WebP, GIF.</p>
          <div id="cms-upload-progress" class="form-hint" style="margin-top:.5rem;"></div>
        </div>
      </div>
    </div>
    <div id="cms-gallery-items" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1rem;">
      ${items.length ? items.map((it, i) => galleryItemCard(it, i, items.length)).join('') : emptyCard('Galerie je prázdná.')}
    </div>
  `;

  detail.querySelector('#cms-upload').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const prog = detail.querySelector('#cms-upload-progress');
    let done = 0;
    for (const f of files) {
      prog.textContent = `Nahrávám ${done + 1}/${files.length}: ${f.name}…`;
      const r = await api.uploadGalleryImage(galleryKey, f);
      if (!r.ok) { showToast(`Chyba u ${f.name}: ${r.error}`, 'error'); }
      done++;
    }
    prog.textContent = '';
    showToast(`Nahráno: ${done} obrázek/ů ✓`, 'success');
    renderGalleryDetail(detail, galleryKey);
  });

  detail.querySelectorAll('.cms-gallery-item').forEach((card) => wireGalleryItem(detail, galleryKey, card, items));
}

function galleryItemCard(it, index, total) {
  return `
    <div class="card cms-gallery-item" data-id="${esc(it.id)}" data-index="${index}">
      <div style="aspect-ratio:4/3; overflow:hidden; border-radius:8px 8px 0 0; background:#f3f1ec;">
        <img src="${esc(it.image_url)}" alt="${esc(it.caption)}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div class="card-body" style="padding:.75rem;">
        <input type="text" class="form-input" data-field="caption" value="${esc(it.caption)}" placeholder="Popisek" style="margin-bottom:.5rem; font-size:.85rem;">
        <div style="display:flex; gap:.25rem; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-secondary" data-action="up" title="Posunout výš" ${index === 0 ? 'disabled' : ''} style="padding:.25rem .5rem;">↑</button>
            <button class="btn btn-secondary" data-action="down" title="Posunout níž" ${index === total - 1 ? 'disabled' : ''} style="padding:.25rem .5rem;">↓</button>
          </div>
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-primary" data-action="save" style="padding:.25rem .5rem;">💾</button>
            <button class="btn btn-danger" data-action="delete" style="padding:.25rem .5rem;">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
}

function wireGalleryItem(detail, galleryKey, card, items) {
  const { api, showToast } = _ctx;
  const id = card.dataset.id;
  const index = Number(card.dataset.index);

  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const caption = card.querySelector('[data-field="caption"]').value;
    const r = await api.updateGalleryItem({ id, caption });
    showToast(r.ok ? 'Uloženo ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
  });

  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm('Opravdu smazat tento obrázek?')) return;
    const r = await api.deleteGalleryItem(id);
    if (r.ok) { showToast('Smazáno ✓', 'success'); renderGalleryDetail(detail, galleryKey); }
    else showToast('Chyba: ' + r.error, 'error');
  });

  const move = async (dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    // prohodit pořadí dvou sousedů
    const reordered = items.map((it, i) => ({ id: it.id, sort_order: i + 1 }));
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reordered.forEach((r, i) => (r.sort_order = i + 1));
    const r = await api.reorderGallery(galleryKey, reordered);
    if (r.ok) renderGalleryDetail(detail, galleryKey);
    else showToast('Chyba při řazení: ' + r.error, 'error');
  };
  card.querySelector('[data-action="up"]').addEventListener('click', () => move(-1));
  card.querySelector('[data-action="down"]').addEventListener('click', () => move(1));
}

// ─── HERO (hero_config) ───────────────────────────────────────

async function renderHero(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getHeroes();
  const heroes = res.ok ? (res.data?.heroes || []) : [];

  body.innerHTML = `
    <div class="card mb-6">
      <div class="card-body" style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Stránka</label>
          <select class="form-select" id="cms-hero-select" style="min-width:220px;">
            ${heroes.map((h) => `<option value="${esc(h.page_key)}">${esc(h.page_key)}</option>`).join('')}
            <option value="__new__">➕ Nová stránka…</option>
          </select>
        </div>
      </div>
    </div>
    <div id="cms-hero-detail"></div>
  `;

  const sel = body.querySelector('#cms-hero-select');
  const detail = body.querySelector('#cms-hero-detail');
  const show = () => {
    if (sel.value === '__new__') {
      const key = prompt('Klíč stránky (např. homepage):');
      if (!key) { sel.selectedIndex = 0; return; }
      renderHeroForm(detail, { page_key: key.trim().toLowerCase() });
    } else {
      renderHeroForm(detail, heroes.find((h) => h.page_key === sel.value) || { page_key: sel.value });
    }
  };
  sel.addEventListener('change', show);
  if (heroes.length) renderHeroForm(detail, heroes[0]);
  else renderHeroForm(detail, { page_key: 'homepage' });
}

function renderHeroForm(detail, h) {
  const { api, showToast } = _ctx;
  h = h || {};
  detail.innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🎯 Hero — ${esc(h.page_key)}</h3></div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Hlavní nadpis</label><input class="form-input" data-f="headline" value="${esc(h.headline)}"></div>
        <div class="form-group"><label class="form-label">Podnadpis</label><input class="form-input" data-f="subheadline" value="${esc(h.subheadline)}"></div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; min-width:200px;"><label class="form-label">Text tlačítka (CTA)</label><input class="form-input" data-f="cta_text" value="${esc(h.cta_text)}"></div>
          <div class="form-group" style="flex:1; min-width:200px;"><label class="form-label">Odkaz tlačítka</label><input class="form-input" data-f="cta_link" value="${esc(h.cta_link)}" placeholder="/book"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Obrázek pozadí</label>
          <div style="display:flex; gap:.5rem; align-items:center;">
            <input class="form-input" data-f="background_image_url" value="${esc(h.background_image_url)}" placeholder="/api/media/... nebo /assets/...">
            <input type="file" id="cms-hero-bg" accept="image/jpeg,image/png,image/webp" style="max-width:200px;">
          </div>
          <p class="form-hint">Můžete vložit cestu ručně, nebo nahrát soubor (uloží se do galerie „hero").</p>
        </div>
        <div class="form-group"><label class="form-label">Barva překryvu</label><input class="form-input" data-f="overlay_color" value="${esc(h.overlay_color || 'rgba(0,0,0,0.3)')}" style="width:220px;"></div>
        <button class="btn btn-primary" id="cms-hero-save">💾 Uložit hero</button>
      </div>
    </div>`;

  const getf = (f) => detail.querySelector(`[data-f="${f}"]`).value;

  detail.querySelector('#cms-hero-bg').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Nahrávám pozadí…', 'info');
    const r = await api.uploadGalleryImage('hero', file);
    if (r.ok) { detail.querySelector('[data-f="background_image_url"]').value = r.data.image_url; showToast('Pozadí nahráno ✓', 'success'); }
    else showToast('Chyba: ' + r.error, 'error');
  });

  detail.querySelector('#cms-hero-save').addEventListener('click', async () => {
    const payload = {
      page_key: h.page_key,
      headline: getf('headline'), subheadline: getf('subheadline'),
      cta_text: getf('cta_text'), cta_link: getf('cta_link'),
      background_image_url: getf('background_image_url'), overlay_color: getf('overlay_color'),
    };
    const r = await api.saveHero(payload);
    showToast(r.ok ? 'Hero uložen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
  });
}

// ─── HISTORIE (audit_log) ─────────────────────────────────────

async function renderHistorie(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getContentHistory();
  const rows = res.ok ? (res.data?.history || []) : [];
  const label = { content_blocks: 'Text', gallery_items: 'Galerie', hero_config: 'Hero' };
  const action = { create: 'vytvoření', update: 'úprava', delete: 'smazání' };

  body.innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🕓 Historie změn obsahu</h3></div>
      <div class="card-body" style="overflow-x:auto;">
        ${rows.length ? `
        <table style="width:100%; border-collapse:collapse; font-size:.9rem;">
          <thead><tr style="text-align:left; border-bottom:1px solid rgba(115,138,117,0.2);">
            <th style="padding:.5rem;">Kdy</th><th style="padding:.5rem;">Oblast</th><th style="padding:.5rem;">Akce</th><th style="padding:.5rem;">Popis</th><th style="padding:.5rem;">Kdo</th>
          </tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr style="border-bottom:1px solid rgba(115,138,117,0.1);">
                <td style="padding:.5rem; white-space:nowrap;">${fmtDate(r.created_at)}</td>
                <td style="padding:.5rem;">${esc(label[r.entity] || r.entity)}</td>
                <td style="padding:.5rem;">${esc(action[r.action] || r.action)}</td>
                <td style="padding:.5rem;">${esc(r.details)}</td>
                <td style="padding:.5rem;">${esc((r.actor || '').replace('operator:', ''))}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : emptyCard('Zatím žádné zaznamenané změny obsahu.')}
      </div>
    </div>`;
}

// ─── HELPERS ──────────────────────────────────────────────────

function emptyCard(text) {
  return `<div class="empty-state" style="padding:2rem; text-align:center; color:var(--c-sage,#738A75);">${esc(text)}</div>`;
}
function demoNote() {
  return `<div class="card"><div class="card-body">Demo režim — API není dostupné. Po přihlášení uvidíte reálný obsah.</div></div>`;
}

export function destroy() {
  _ctx = null;
}
