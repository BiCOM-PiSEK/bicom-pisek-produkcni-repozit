/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Modul „Obsah webu" (CMS / F11 + F12)
 * ═══════════════════════════════════════════════════════════════
 * Vanilla ES6 modul (kontrakt render/destroy). Workflow koncept →
 * náhled → publikovat: úpravy se ukládají jako KONCEPT (nejde živě),
 * v pravém panelu je náhled (iframe /admin/preview/) a tlačítky
 * Zveřejnit / Zahodit se koncept publikuje nebo zruší.
 *
 * Podzáložky: Stránky · Footer & Kontakt · Galerie · Hero · Historie.
 * ═══════════════════════════════════════════════════════════════
 */

let _ctx = null;
const EDIT_HISTORY_LIMIT = 10;
const _editHistory = new Map();

/** Escapuje text pro bezpečné vložení do HTML. @param {*} str @returns {string} */
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str == null ? '' : String(str);
  return el.innerHTML;
}

/** Vrátí štítek stavu builder bloku. @param {Object} block @returns {string} */
function visualBlockStatusBadge(block) {
  const status = String(block?.status || (block?.editable === false ? 'locked' : 'editable'));
  if (status === 'dynamic') return '<span class="badge badge-pending" title="Generováno z dat nebo funkční logiky">Dynamické</span>';
  if (status === 'locked') return '<span class="badge" style="background:#F4ECE0;color:#7A5520;" title="Součást šablony">Zamčeno</span>';
  if (block?.mediaKind) return '<span class="badge badge-confirmed" title="Napojený mediální blok">Média</span>';
  return '<span class="badge badge-confirmed" title="Napojeno na CMS editor">Editovatelné</span>';
}

/** Popisuje primární akce dostupné pro blok. @param {Object} block @returns {string} */
function visualBlockActionText(block) {
  const actions = Array.isArray(block?.actions) ? block.actions : [];
  if (actions.includes('replaceMedia')) return 'Výměna média';
  if (actions.includes('openEditor')) return 'Upravit v editoru';
  if (block?.status === 'dynamic') return 'Spravuje specializovaný modul';
  return block?.lockedReason || 'Orientační blok šablony';
}

/** Escapuje text pro bezpečné vložení do HTML atributu. @param {*} str @returns {string} */
function escAttr(str) {
  return esc(str).replace(/"/g, '&quot;');
}

/** Naformátuje timestamp (cs-CZ). @param {string} ts @returns {string} */
function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  if (isNaN(d)) return esc(ts);
  return d.toLocaleString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Štítek stavu konceptu. @param {boolean} hasDraft @returns {string} */
function draftBadge(hasDraft) {
  return hasDraft
    ? '<span class="badge badge-pending" title="Čeká na zveřejnění">Koncept</span>'
    : '<span class="badge badge-confirmed" title="Beze změn">Zveřejněno</span>';
}

/**
 * HTML pravého náhledového panelu (iframe veřejné stránky s koncepty).
 * @param {string} [page=''] — soubor pod /admin/preview/ (prázdné = homepage)
 * @returns {string}
 */
function previewPaneHtml(page) {
  const src = '/admin/preview/' + (page || '');
  const live = page ? '/' + page : '/';
  return `
    <div class="cms-preview" style="position:sticky; top:1rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:.5rem;">
        <h3 class="card-title" style="margin:0;">👁️ Náhled (s koncepty)</h3>
        <div style="display:flex; gap:.25rem;">
          <button class="btn btn-secondary btn-sm" id="cms-preview-visual" title="Otevřít interaktivní Visual Builder">🧩</button>
          <button class="btn btn-secondary btn-sm" id="cms-preview-refresh" title="Obnovit náhled">↻</button>
          <a class="btn btn-ghost btn-sm" href="${live}" target="_blank" rel="noopener" title="Zobrazit živý web">web ↗</a>
        </div>
      </div>
      <div style="border:1px solid rgba(115,138,117,0.2); border-radius:12px; overflow:hidden; background:#fff;">
        <iframe id="cms-preview-frame" src="${src}" data-preview-page="${escAttr(page || '')}" title="Náhled webu"
          style="width:100%; height:70vh; border:0; display:block;"></iframe>
      </div>
      <p class="form-hint" style="margin-top:.5rem;">Náhled ukazuje i neuložené koncepty. Po „Uložit koncept" klikněte na ↻ nebo otevřete 🧩 Visual Builder.</p>
    </div>`;
}

/** Obnoví náhledový iframe. @param {HTMLElement} root */
function refreshPreview(root) {
  const f = root.querySelector('#cms-preview-frame');
  if (f) f.contentWindow.location.reload();
}

/**
 * Popis bloku z Visual Builder mapy pro boční seznam.
 * @param {Object} block
 * @returns {string}
 */
function visualBlockLabel(block) {
  if (block?.label) return String(block.label);
  const t = String(block?.type || '');
  const key = block?.key || block?.sectionKey || '';
  const field = block?.field || '';
  if (t === 'structure') return `Kosterní blok · ${key}`;
  if (t === 'dynamic') return `Dynamický blok · ${key}`;
  if (t === 'media') return `Média · ${key}`;
  if (t === 'section') return `Text · ${key}`;
  if (t === 'list') return `Karty · ${key}`;
  if (t === 'gallery') return `Galerie · ${key}`;
  if (t === 'hero') return `Hero · ${key}`;
  if (t === 'heroField') return `Hero pole · ${field}`;
  if (t === 'nap') return `Kontakt/NAP · ${field}`;
  if (t === 'faq') return `FAQ · ${key}`;
  if (t === 'programs') return 'Programy (služby)';
  if (t === 'seo') return `SEO · ${key}`;
  if (t === 'landing') return `Landing · ${key}`;
  if (t === 'landingField') return `Landing pole · ${field}`;
  return key || field || 'CMS blok';
}

/**
 * Najde odpovídající element editoru pro vybraný blok.
 * @param {HTMLElement} root
 * @param {Object} block
 * @returns {HTMLElement|null}
 */
function findEditorTarget(root, block) {
  const key = String(block?.key || '');
  const sectionKey = String(block?.sectionKey || '');
  const field = String(block?.field || '');
  const type = String(block?.type || '');

  if (type === 'section' && key) {
    return root.querySelector(`.cms-section-card[data-key="${CSS.escape(key)}"]`);
  }
  if (type === 'list' && key) {
    return root.querySelector(`.cms-cardgroup-card[data-key="${CSS.escape(key)}"]`);
  }
  if (type === 'gallery' && key) {
    return root.querySelector('#cms-gallery-detail');
  }
  if (type === 'nap' && field) {
    return root.querySelector(`[data-nap="${CSS.escape(field)}"]`);
  }
  if (type === 'heroField' && field) {
    return root.querySelector(`[data-f="${CSS.escape(field)}"]`);
  }
  if ((type === 'landingField' || type === 'seo') && field) {
    return root.querySelector(`[data-cfg="${CSS.escape(field)}"]`);
  }
  if (type === 'faq') {
    return root.querySelector('.faq-rows') || root.querySelector('[data-config-key="faq-main"]');
  }
  if (type === 'programs') {
    return root.querySelector('.cms-tab[data-tab="sluzby"]');
  }
  if (type === 'media' && block?.key === 'ordinace') {
    return root.querySelector('#cms-gallery-detail') || root.querySelector('.cms-tab[data-tab="galerie"]');
  }
  if (type === 'media' && block?.key === 'hero-media') {
    return root.querySelector('.cms-tab[data-tab="hero"]');
  }
  if (sectionKey) {
    return root.querySelector(`[data-config-key="${CSS.escape(sectionKey)}"]`);
  }
  return null;
}

/**
 * Posune editor na odpovídající element a vizuálně ho zvýrazní.
 * @param {HTMLElement} root
 * @param {Object} block
 * @returns {boolean}
 */
function focusEditorTarget(root, block) {
  const target = findEditorTarget(root, block);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const prevShadow = target.style.boxShadow;
  target.style.boxShadow = '0 0 0 3px rgba(58,74,60,0.35)';
  if (typeof target.focus === 'function') {
    try { target.focus({ preventScroll: true }); } catch { target.focus(); }
  }
  setTimeout(() => { target.style.boxShadow = prevShadow; }, 1400);
  return true;
}

/** @param {Array<[string,string,string]>} fields @param {string} field @returns {[string,string,string]|null} */
function fieldMeta(fields, field) {
  return (fields || []).find(([k]) => k === field) || null;
}

/** @param {Object} row @returns {Object} */
function effectiveConfig(row) {
  try {
    return JSON.parse(row?.has_draft ? (row.draft_content_markdown ?? row.content_markdown) : row?.content_markdown) || {};
  } catch {
    return {};
  }
}

/** @param {Object} row @returns {Object} */
function effectiveHeroConfig(row) {
  const draft = (() => {
    try { return row?.has_draft && row.draft_json ? JSON.parse(row.draft_json) : {}; } catch { return {}; }
  })();
  return {
    headline: draft.headline ?? row?.headline ?? '',
    subheadline: draft.subheadline ?? row?.subheadline ?? '',
    cta_text: draft.cta_text ?? row?.cta_text ?? '',
    cta_link: draft.cta_link ?? row?.cta_link ?? '',
    background_image_url: draft.background_image_url ?? row?.background_image_url ?? '',
    overlay_color: draft.overlay_color ?? row?.overlay_color ?? 'rgba(0,0,0,0.3)',
  };
}

/** @param {Object} row @param {string} field @returns {string} */
function currentContentValue(row, field) {
  if (field === 'title') return row?.has_draft ? (row.draft_title ?? row.title ?? '') : (row?.title ?? '');
  return row?.has_draft ? (row.draft_content_markdown ?? row.content_markdown ?? '') : (row?.content_markdown ?? '');
}

/** @param {string} field @returns {[string,string,string]|null} */
function heroFieldMeta(field) {
  const fields = [
    ['headline', 'Hlavní nadpis', 'text'],
    ['subheadline', 'Podnadpis', 'textarea'],
    ['cta_text', 'Text tlačítka', 'text'],
    ['cta_link', 'Odkaz tlačítka', 'text'],
    ['background_image_url', 'Obrázek pozadí', 'text'],
    ['overlay_color', 'Barva překryvu', 'text'],
  ];
  return fieldMeta(fields, field);
}

/** Otevře interaktivní Visual Builder modal. @param {HTMLElement} root */
function openVisualBuilder(root) {
  const { api, showToast } = _ctx;
  const sourceFrame = root.querySelector('#cms-preview-frame');
  if (!sourceFrame) return;
  const src = sourceFrame.getAttribute('src') || '/admin/preview/';
  const liveHref = root.querySelector('.cms-preview a[title="Zobrazit živý web"]')?.getAttribute('href') || '/';

  showModal(`
    <div class="modal" style="width:min(96vw,1480px); max-width:min(96vw,1480px);">
      <div class="modal-header" style="display:flex; align-items:center; justify-content:space-between;">
        <h3 class="card-title" style="margin:0;">🧩 Visual Builder</h3>
        <button class="btn-icon" data-m="close">✕</button>
      </div>
      <div class="modal-body" style="display:grid; grid-template-columns:minmax(0,1fr) 390px; gap:1rem; max-height:82vh;">
        <div style="display:flex; flex-direction:column; gap:.5rem; min-height:0;">
          <div style="display:flex; gap:.5rem; align-items:center; justify-content:space-between;">
            <div class="form-hint" id="cms-vb-status">Načítám mapu bloků…</div>
            <div style="display:flex; gap:.25rem; align-items:center;">
              <button class="btn btn-ghost btn-sm" data-vb-size="mobile" title="Mobilní náhled">Mobil</button>
              <button class="btn btn-ghost btn-sm" data-vb-size="tablet" title="Tablet náhled">Tablet</button>
              <button class="btn btn-secondary btn-sm" data-vb-size="desktop" title="Desktop náhled">Desktop</button>
              <button class="btn btn-primary btn-sm" id="cms-vb-mode-toggle" title="Přepnout mezi editací a volnou navigací" style="min-width:8rem;">✏️ Editovat</button>
              <button class="btn btn-secondary btn-sm" id="cms-vb-refresh">↻</button>
              <a class="btn btn-ghost btn-sm" href="${escAttr(liveHref)}" target="_blank" rel="noopener">živý web ↗</a>
            </div>
          </div>
          <div id="cms-vb-frame-shell" style="border:1px solid rgba(115,138,117,0.2); border-radius:12px; overflow:hidden; background:#fff; min-height:0; flex:1; margin-inline:auto; width:100%;">
            <iframe id="cms-vb-frame" src="${escAttr(src)}" title="Visual Builder náhled" style="width:100%; height:100%; min-height:62vh; border:0; display:block;"></iframe>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:.6rem; min-height:0;">
          <div style="background:#FAF8F4; border:1px solid rgba(115,138,117,.16); border-radius:10px; padding:.65rem;">
            <strong style="display:block; margin-bottom:.25rem;">Pracovní režim</strong>
            <span class="form-hint">Klik v náhledu vybírá blok. Zamčené bloky se zobrazují záměrně, aby bylo jasné, že je načtená celá stránka.</span>
          </div>
          <div id="cms-vb-drafts" style="background:#fff; border:1px solid rgba(115,138,117,.16); border-radius:10px; padding:.65rem;">
            <div class="form-hint">Načítám nezveřejněné změny…</div>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">Vyhledat blok</label>
            <input type="text" class="form-input" id="cms-vb-filter" placeholder="např. galerie, faq, home-...">
          </div>
          <div style="display:flex; gap:.35rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" data-vb-filter-state="all">Vše</button>
            <button class="btn btn-ghost btn-sm" data-vb-filter-state="editable">Editovatelné</button>
            <button class="btn btn-ghost btn-sm" data-vb-filter-state="media">Média</button>
            <button class="btn btn-ghost btn-sm" data-vb-filter-state="locked">Zamčené</button>
            <button class="btn btn-ghost btn-sm" data-vb-filter-state="dynamic">Dynamické</button>
          </div>
          <div id="cms-vb-list" style="border:1px solid rgba(115,138,117,0.15); border-radius:10px; overflow:auto; padding:.35rem; min-height:220px; max-height:52vh;"></div>
          <div id="cms-vb-selected" class="form-hint" style="min-height:2.2rem; border:1px solid rgba(115,138,117,.15); border-radius:10px; padding:.65rem;">Vyberte blok kliknutím v náhledu nebo v seznamu.</div>
          <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="cms-vb-focus" disabled>🎯 Najít v editoru</button>
            <button class="btn btn-secondary btn-sm" id="cms-vb-media" disabled>🖼️ Média</button>
            <button class="btn btn-secondary btn-sm" id="cms-vb-clear">Vyčistit výběr</button>
          </div>
        </div>
      </div>
    </div>`, (overlay, close) => {
    const vbFrame = overlay.querySelector('#cms-vb-frame');
    const statusEl = overlay.querySelector('#cms-vb-status');
    const listEl = overlay.querySelector('#cms-vb-list');
    const draftsEl = overlay.querySelector('#cms-vb-drafts');
    const filterEl = overlay.querySelector('#cms-vb-filter');
    const selectedEl = overlay.querySelector('#cms-vb-selected');
    const focusBtn = overlay.querySelector('#cms-vb-focus');
    const mediaBtn = overlay.querySelector('#cms-vb-media');
    const modeToggleBtn = overlay.querySelector('#cms-vb-mode-toggle');
    const frameShell = overlay.querySelector('#cms-vb-frame-shell');
    let blocks = [];
    let selectedId = '';
    let stateFilter = 'all';
    let mapLoaded = false;
    let pingAttempts = 0;
    let pingTimer = null;
    let editMode = true; // true = editovat bloky, false = volná navigace
    let inlineEditorSeq = 0;

    const setStatus = (text) => { statusEl.textContent = text; };
    const updateModeButton = () => {
      if (!modeToggleBtn) return;
      if (editMode) {
        modeToggleBtn.textContent = '✏️ Editovat';
        modeToggleBtn.className = 'btn btn-primary btn-sm';
        modeToggleBtn.title = 'Aktivní: klik vybírá blok. Přepnout na volnou navigaci.';
      } else {
        modeToggleBtn.textContent = '🖱 Navigovat';
        modeToggleBtn.className = 'btn btn-secondary btn-sm';
        modeToggleBtn.title = 'Aktivní: volná navigace. Přepnout zpět na editaci.';
      }
    };
    const selectedBlock = () => blocks.find((b) => b.id === selectedId) || null;
    const post = (payload) => {
      if (!vbFrame?.contentWindow) return;
      vbFrame.contentWindow.postMessage(payload, window.location.origin);
    };
    const selectDraftTarget = (item) => {
      const match = blocks.find((b) =>
        b.sectionKey === item.key || b.key === item.key || (item.type === 'hero' && b.type === 'heroField' && b.sectionKey === item.key)
      );
      if (match) {
        selectBlock(match.id, true);
        return;
      }
      filterEl.value = item.key;
      renderList();
      showToast('Změna je v jiném nebo složeném bloku. Seznam je vyfiltrovaný podle klíče.', 'info');
    };
    const renderDraftSummary = (items) => {
      if (!draftsEl) return;
      const shown = items.slice(0, 5);
      draftsEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.35rem;">
          <strong>Nezveřejněné změny</strong>
          <button class="btn btn-ghost btn-sm" data-vb-drafts-refresh title="Obnovit souhrn">↻</button>
        </div>
        ${items.length
          ? `<div class="form-hint" style="margin-bottom:.35rem;">${items.length} konceptů čeká na zveřejnění. Vybraný podporovaný blok lze publikovat přímo v inspektoru.</div>
             <div style="display:flex; flex-direction:column; gap:.25rem;">
               ${shown.map((it, i) => `
                 <button class="btn btn-ghost btn-sm" data-vb-draft-index="${i}" style="justify-content:flex-start; text-align:left;">
                   <span style="overflow:hidden; text-overflow:ellipsis;">${esc(it.label)}</span>
                 </button>`).join('')}
             </div>
             ${items.length > shown.length ? `<div class="form-hint" style="margin-top:.25rem;">+ ${items.length - shown.length} dalších konceptů ve specializovaných editorech.</div>` : ''}`
          : '<div class="form-hint">Žádné koncepty nečekají na zveřejnění.</div>'}`;
      draftsEl.querySelector('[data-vb-drafts-refresh]')?.addEventListener('click', loadDraftSummary);
      draftsEl.querySelectorAll('[data-vb-draft-index]').forEach((btn) => {
        btn.addEventListener('click', () => selectDraftTarget(shown[Number(btn.dataset.vbDraftIndex)]));
      });
    };
    const loadDraftSummary = async () => {
      if (!api || !draftsEl) return;
      draftsEl.innerHTML = '<div class="form-hint">Načítám nezveřejněné změny…</div>';
      const results = await Promise.allSettled([
        api.getContentSections?.(),
        api.getHeroes?.(),
        api.getGalleries?.(),
        api.getServicesAdmin?.(),
      ]);
      const okData = (idx) => results[idx].status === 'fulfilled' && results[idx].value?.ok ? results[idx].value.data : null;
      const items = [];
      (okData(0)?.sections || []).filter((s) => s.has_draft).forEach((s) => items.push({
        type: 'content',
        key: s.section_key,
        label: `Text/config · ${s.title || s.section_key}`,
      }));
      (okData(1)?.heroes || []).filter((h) => h.has_draft).forEach((h) => items.push({
        type: 'hero',
        key: h.page_key,
        label: `Hero · ${h.page_key}`,
      }));
      (okData(2)?.galleries || []).filter((g) => g.has_draft).forEach((g) => items.push({
        type: 'gallery',
        key: g.gallery_key,
        label: `Galerie · ${g.gallery_key}`,
      }));
      (okData(3)?.services || []).filter((s) => s.has_draft).forEach((s) => items.push({
        type: 'service',
        key: s.slug,
        label: `Služba · ${s.name || s.slug}`,
      }));
      renderDraftSummary(items);
    };
    const reloadPreviews = () => {
      setStatus('Obnovuji náhled s konceptem…');
      try { sourceFrame.contentWindow.location.reload(); } catch { /* iframe nemusí být dostupný při zavírání modalu */ }
      try { vbFrame.contentWindow.location.reload(); } catch { /* iframe nemusí být dostupný při zavírání modalu */ }
      loadDraftSummary();
    };
    const editableInlineType = (block) => {
      const type = String(block?.type || '');
      if (type === 'section') return !!(block?.sectionKey || block?.key);
      if (type === 'nap' || type === 'landingField' || type === 'seo') return !!block?.field;
      if (type === 'heroField') return !!(block?.sectionKey || block?.key) && !!block?.field;
      return false;
    };
    const inlineUnavailableHtml = (block) => {
      if (!block) return '';
      if (Array.isArray(block.actions) && block.actions.includes('replaceMedia')) {
        return `<div style="margin-top:.6rem; padding-top:.6rem; border-top:1px solid rgba(115,138,117,.15);">
          <strong>Výměna média</strong>
          <p style="margin:.25rem 0 0;">Mediální asset se spravuje přes Mediatéku/Galerii/Hero, aby se zachoval audit, alt text a publikační workflow.</p>
        </div>`;
      }
      if (Array.isArray(block.actions) && block.actions.includes('openEditor')) {
        return `<div style="margin-top:.6rem; padding-top:.6rem; border-top:1px solid rgba(115,138,117,.15);">
          <strong>Specializovaný editor</strong>
          <p style="margin:.25rem 0 0;">Tento blok je složený nebo opakovatelný. Klikněte na „Najít v editoru" a upravte ho v plném formuláři.</p>
        </div>`;
      }
      return '';
    };
    const inlineInputHtml = (id, label, type, value) => `
      <div class="form-group" style="margin-top:.65rem;">
        <label class="form-label" for="${id}">${esc(label)}</label>
        ${type === 'textarea'
          ? `<textarea class="form-input" id="${id}" rows="5">${esc(value)}</textarea>`
          : `<input class="form-input" id="${id}" type="text" value="${esc(value)}">`}
      </div>`;
    const renderInlineEditor = async (block) => {
      const host = selectedEl.querySelector('[data-vb-inline-editor]');
      if (!host) return;
      const seq = ++inlineEditorSeq;
      if (!api || !editableInlineType(block)) {
        host.innerHTML = inlineUnavailableHtml(block);
        return;
      }
      host.innerHTML = '<div style="margin-top:.6rem; padding-top:.6rem; border-top:1px solid rgba(115,138,117,.15);">Načítám editor bloku…</div>';
      try {
        const type = String(block.type || '');
        const key = String(block.sectionKey || block.key || '');
        const field = String(block.field || '');
        const id = `cms-vb-inline-${block.id.replace(/[^a-z0-9_-]/gi, '-')}`;
        let editor = null;

        if (type === 'section') {
          const res = await api.getContentSection(key);
          if (seq !== inlineEditorSeq) return;
          if (!res.ok) { host.innerHTML = `<div class="empty-state">Chyba: ${esc(res.error || 'Sekci se nepodařilo načíst.')}</div>`; return; }
          const row = res.data;
          const isText = row.content_type === 'text';
          editor = {
            title: row.title || key,
            stateLabel: draftBadge(!!row.has_draft),
            hasDraft: !!row.has_draft,
            input: isText
              ? inlineInputHtml(id, 'Obsah bloku', 'textarea', currentContentValue(row, 'content'))
              : `<p class="form-hint" style="margin-top:.65rem;">Strukturovaný blok typu <code>${esc(row.content_type)}</code> otevřete v plném editoru, aby se bezpečně upravovalo pořadí a opakovatelné položky.</p>`,
            save: isText ? async () => api.updateContentSection({
              section_key: key,
              title: row.has_draft ? (row.draft_title ?? row.title) : row.title,
              content_markdown: host.querySelector(`#${CSS.escape(id)}`).value,
              content_type: row.content_type,
            }) : null,
            publish: () => api.publishContentSection(key),
            discard: () => api.discardContentSection(key),
            reload: () => renderInlineEditor(block),
          };
        } else if (type === 'nap' || type === 'landingField' || type === 'seo') {
          const sectionKey = type === 'nap' ? 'site-nap' : key;
          const meta = type === 'nap'
            ? fieldMeta(NAP_FIELDS, field)
            : fieldMeta(type === 'seo' ? SEO_FIELDS : LANDING_FIELDS, field);
          const res = await api.getContentSection(sectionKey);
          if (seq !== inlineEditorSeq) return;
          if (!res.ok) { host.innerHTML = `<div class="empty-state">Chyba: ${esc(res.error || 'Konfiguraci se nepodařilo načíst.')}</div>`; return; }
          const row = res.data;
          const cfg = effectiveConfig(row);
          const label = meta?.[1] || field;
          const inputType = meta?.[2] || 'text';
          const title = type === 'nap' ? 'Kontakt & patička' : (type === 'seo' ? 'SEO nastavení' : 'Landing stránka');
          editor = {
            title,
            stateLabel: draftBadge(!!row.has_draft),
            hasDraft: !!row.has_draft,
            input: inlineInputHtml(id, label, inputType, cfg[field] || ''),
            save: async () => {
              cfg[field] = host.querySelector(`#${CSS.escape(id)}`).value;
              return api.updateContentSection({
                section_key: sectionKey,
                title: row.title || title,
                content_markdown: JSON.stringify(cfg),
                content_type: 'config',
              });
            },
            publish: () => api.publishContentSection(sectionKey),
            discard: () => api.discardContentSection(sectionKey),
            reload: () => renderInlineEditor(block),
          };
        } else if (type === 'heroField') {
          const pageKey = key;
          const meta = heroFieldMeta(field);
          const res = await api.getHero(pageKey);
          if (seq !== inlineEditorSeq) return;
          if (!res.ok) { host.innerHTML = `<div class="empty-state">Chyba: ${esc(res.error || 'Hero se nepodařilo načíst.')}</div>`; return; }
          const row = res.data || { page_key: pageKey };
          const cfg = effectiveHeroConfig(row);
          editor = {
            title: `Hero — ${pageKey}`,
            stateLabel: draftBadge(!!row.has_draft),
            hasDraft: !!row.has_draft,
            input: inlineInputHtml(id, meta?.[1] || field, meta?.[2] || 'text', cfg[field] || ''),
            save: async () => {
              cfg[field] = host.querySelector(`#${CSS.escape(id)}`).value;
              return api.saveHero({ page_key: pageKey, ...cfg });
            },
            publish: () => api.publishHero(pageKey),
            discard: () => api.discardHero(pageKey),
            reload: () => renderInlineEditor(block),
          };
        }

        if (!editor) {
          host.innerHTML = inlineUnavailableHtml(block);
          return;
        }
        host.innerHTML = `
          <div style="margin-top:.6rem; padding-top:.6rem; border-top:1px solid rgba(115,138,117,.15);">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
              <strong>${esc(editor.title)}</strong>
              <span data-vb-inline-state>${editor.stateLabel}</span>
            </div>
            ${editor.input}
            <div style="display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.5rem;">
              <button class="btn btn-secondary btn-sm" data-vb-inline="save" ${editor.save ? '' : 'disabled'}>💾 Uložit koncept</button>
              <button class="btn btn-primary btn-sm" data-vb-inline="publish" ${editor.hasDraft ? '' : 'disabled'}>✅ Zveřejnit blok</button>
              <button class="btn btn-ghost btn-sm" data-vb-inline="discard" ${editor.hasDraft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
            </div>
            <p class="form-hint" style="margin:.45rem 0 0;">Uložení vytvoří jen koncept. Na web se dostane až po zveřejnění.</p>
          </div>`;
        host.querySelector('[data-vb-inline="save"]')?.addEventListener('click', async () => {
          const r = await editor.save();
          showToast(r.ok ? 'Koncept bloku uložen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
          if (r.ok) {
            block.status = 'editable';
            reloadPreviews();
            await editor.reload();
          }
        });
        host.querySelector('[data-vb-inline="publish"]')?.addEventListener('click', async () => {
          const r = await editor.publish();
          showToast(r.ok ? 'Blok zveřejněn ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
          if (r.ok) { reloadPreviews(); await editor.reload(); }
        });
        host.querySelector('[data-vb-inline="discard"]')?.addEventListener('click', async () => {
          if (!confirm('Zahodit koncept tohoto bloku?')) return;
          const r = await editor.discard();
          showToast(r.ok ? 'Koncept bloku zahozen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
          if (r.ok) { reloadPreviews(); await editor.reload(); }
        });
      } catch (err) {
        if (seq === inlineEditorSeq) host.innerHTML = `<div class="empty-state">Chyba editoru: ${esc(err.message || err)}</div>`;
      }
    };
    const matchesFilter = (block, q) => {
      if (stateFilter === 'editable' && block?.editable === false) return false;
      if (stateFilter === 'media' && !block?.mediaKind && block?.group !== 'media') return false;
      if (stateFilter === 'locked' && block?.status !== 'locked') return false;
      if (stateFilter === 'dynamic' && block?.status !== 'dynamic' && block?.type !== 'dynamic') return false;
      if (!q) return true;
      const hay = `${visualBlockLabel(block)} ${block.key || ''} ${block.sectionKey || ''} ${block.field || ''}`.toLowerCase();
      return hay.includes(q);
    };
    const renderSelected = () => {
      const block = selectedBlock();
      if (!block) {
        selectedEl.textContent = 'Vyberte blok kliknutím v náhledu nebo v seznamu.';
        focusBtn.disabled = true;
        mediaBtn.disabled = true;
        return;
      }
      selectedEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom:.35rem;">
          <strong>${esc(visualBlockLabel(block))}</strong>
          ${visualBlockStatusBadge(block)}
        </div>
        <div><code>${esc(block.sectionKey || block.key || block.field || block.id)}</code></div>
        <div style="margin-top:.35rem;">${esc(visualBlockActionText(block))}</div>
        ${block.mediaUrl ? `<div style="margin-top:.35rem; overflow:hidden; text-overflow:ellipsis;"><strong>Asset:</strong> ${esc(block.mediaUrl)}</div>` : ''}
        <div data-vb-inline-editor></div>`;
      focusBtn.disabled = !findEditorTarget(root, block);
      mediaBtn.disabled = !(Array.isArray(block.actions) && block.actions.includes('replaceMedia'));
      renderInlineEditor(block);
    };
    const renderList = () => {
      const q = (filterEl.value || '').trim().toLowerCase();
      const visible = blocks.filter((b) => matchesFilter(b, q));
      listEl.innerHTML = visible.length
        ? visible.map((b) => `
            <button class="btn btn-ghost btn-sm" data-vb-id="${escAttr(b.id)}" style="width:100%; text-align:left; justify-content:flex-start; margin:.15rem 0; ${b.id === selectedId ? 'border-color:var(--c-forest,#3A4A3C); background:rgba(58,74,60,0.08);' : ''}">
              <span style="display:flex; align-items:center; justify-content:space-between; gap:.5rem; width:100%;">
                <span>${esc(visualBlockLabel(b))}</span>
                ${visualBlockStatusBadge(b)}
              </span>
            </button>`).join('')
        : `<div class="empty-state" style="padding:1rem; text-align:center;">Žádný blok neodpovídá filtru.</div>`;
    };
    const selectBlock = (id, shouldScrollPreview) => {
      selectedId = id || '';
      renderList();
      renderSelected();
      if (selectedId) post({ type: 'cms-vb-highlight', id: selectedId, scroll: !!shouldScrollPreview });
    };
    const clearPingTimer = () => {
      if (!pingTimer) return;
      clearInterval(pingTimer);
      pingTimer = null;
    };
    const requestMapSync = () => {
      pingAttempts += 1;
      post({ type: 'cms-vb-ping' });
      if (mapLoaded) {
        clearPingTimer();
        return;
      }
      if (pingAttempts >= 8) {
        clearPingTimer();
        setStatus('Mapa bloků se nenačetla. Klikněte na ↻ nebo zavřete a otevřete Visual Builder znovu.');
      }
    };

    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vb-id]');
      if (!btn) return;
      selectBlock(btn.dataset.vbId, true);
    });
    filterEl.addEventListener('input', renderList);
    overlay.querySelectorAll('[data-vb-filter-state]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stateFilter = btn.dataset.vbFilterState || 'all';
        overlay.querySelectorAll('[data-vb-filter-state]').forEach((x) => {
          const active = x === btn;
          x.classList.toggle('btn-secondary', active);
          x.classList.toggle('btn-ghost', !active);
        });
        renderList();
      });
    });
    overlay.querySelectorAll('[data-vb-size]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.vbSize || 'desktop';
        const widths = { mobile: '390px', tablet: '820px', desktop: '100%' };
        frameShell.style.width = widths[size] || '100%';
        overlay.querySelectorAll('[data-vb-size]').forEach((x) => {
          const active = x === btn;
          x.classList.toggle('btn-secondary', active);
          x.classList.toggle('btn-ghost', !active);
        });
      });
    });
    overlay.querySelector('#cms-vb-refresh')?.addEventListener('click', () => {
      setStatus('Obnovuji mapu bloků…');
      post({ type: 'cms-vb-ping' });
    });
    overlay.querySelector('#cms-vb-clear')?.addEventListener('click', () => {
      selectedId = '';
      renderList();
      renderSelected();
      post({ type: 'cms-vb-clear' });
    });
    focusBtn.addEventListener('click', () => {
      const block = selectedBlock();
      if (!block) return;
      const ok = focusEditorTarget(root, block);
      if (ok) {
        showToast('Blok zvýrazněn v editoru.', 'success');
        close();
      } else {
        showToast('Tento blok v aktuální záložce editoru nevidím.', 'warning');
      }
    });
    mediaBtn.addEventListener('click', () => {
      const block = selectedBlock();
      if (!block) return;
      const mediaTab = document.querySelector('.cms-tab[data-tab="media"]');
      if (mediaTab) {
        mediaTab.click();
        showToast('Otevřena Mediatéka. Výměnu média proveďte přes příslušnou galerii nebo hero koncept.', 'success');
        close();
        return;
      }
      showToast('Mediální blok otevřete v záložce Galerie/Hero.', 'warning');
      if (focusEditorTarget(root, block)) close();
    });
    modeToggleBtn?.addEventListener('click', () => {
      editMode = !editMode;
      updateModeButton();
      post({ type: 'cms-vb-mode', mode: editMode ? 'edit' : 'navigate' });
    });
    updateModeButton();
    loadDraftSummary();
    overlay.querySelector('[data-m="close"]')?.addEventListener('click', close);

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== vbFrame.contentWindow) return;
      const msg = event.data || {};
      if (msg.type === 'cms-vb-map') {
        mapLoaded = true;
        clearPingTimer();
        blocks = Array.isArray(msg.blocks) ? msg.blocks : [];
        if (!blocks.length) {
          setStatus('Na stránce nebyly nalezeny mapované bloky. Zkontrolujte, zda se v náhledu načetl cms-client.js.');
          selectedId = '';
        } else {
          const editable = blocks.filter((b) => b.editable !== false).length;
          const media = blocks.filter((b) => b.mediaKind || b.group === 'media').length;
          const locked = blocks.length - editable;
          setStatus(`Nalezeno bloků: ${blocks.length} · editovatelných ${editable} · médií ${media} · orientačních ${locked}`);
          if (!selectedId || !blocks.some((b) => b.id === selectedId)) selectedId = blocks[0].id;
        }
        renderList();
        renderSelected();
        return;
      }
      if (msg.type === 'cms-vb-select' && msg.block?.id) {
        if (!blocks.some((b) => b.id === msg.block.id)) blocks.push(msg.block);
        selectedId = msg.block.id;
        renderList();
        renderSelected();
        return;
      }
      // Iframe navigoval na novou stránku → aktualizovat mapu bloků
      if (msg.type === 'cms-vb-navigate') {
        mapLoaded = false;
        pingAttempts = 0;
        setStatus(`Stránka: ${msg.path || '/'} — načítám bloky…`);
        clearPingTimer();
        setTimeout(requestMapSync, 300);
        pingTimer = setInterval(requestMapSync, 800);
      }
    };
    window.addEventListener('message', onMessage);

    const observer = new MutationObserver(() => {
      if (!document.body.contains(overlay)) {
        window.removeEventListener('message', onMessage);
        clearPingTimer();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    vbFrame.addEventListener('load', () => {
      mapLoaded = false;
      pingAttempts = 0;
      setStatus('Načítám mapu bloků…');
      clearPingTimer();
      // Po načtení pošleme aktuální mode (editMode), aby iframe věděl v jakém režimu je
      setTimeout(() => post({ type: 'cms-vb-mode', mode: editMode ? 'edit' : 'navigate' }), 100);
      setTimeout(requestMapSync, 220);
      pingTimer = setInterval(requestMapSync, 800);
    });
  });
}

/** Naváže akce náhledu (refresh + visual builder). @param {HTMLElement} root */
function initPreviewPane(root) {
  const refreshBtn = root.querySelector('#cms-preview-refresh');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = '1';
    refreshBtn.addEventListener('click', () => refreshPreview(root));
  }
  const visualBtn = root.querySelector('#cms-preview-visual');
  if (visualBtn && !visualBtn.dataset.bound) {
    visualBtn.dataset.bound = '1';
    visualBtn.addEventListener('click', () => openVisualBuilder(root));
  }
}

/** HTML tlačítek pro undo/redo/reset na zveřejněný stav. @returns {string} */
function historyControlsHtml() {
  return `
    <button class="btn btn-ghost btn-sm" data-history="undo" disabled title="Krok zpět (max 10)">↶ Zpět</button>
    <button class="btn btn-ghost btn-sm" data-history="redo" disabled title="Krok vpřed">↷ Vpřed</button>
    <button class="btn btn-ghost btn-sm" data-history="reset" title="Vrátit formulář na aktuálně zveřejněný stav">⟲ Reset na zveřejněný stav</button>`;
}

/**
 * Naváže session-level undo/redo historii na editor.
 * @param {HTMLElement} scope
 * @param {Object} options
 * @param {string} options.contextKey
 * @param {Function} options.getState
 * @param {Function} options.applyState
 * @param {*} options.publishedState
 * @param {string} [options.inputSelector]
 * @param {string} [options.resetConfirmText]
 * @returns {{capture: Function, clear: Function}}
 */
function wireEditHistory(scope, options) {
  const {
    contextKey,
    getState,
    applyState,
    publishedState,
    inputSelector = 'input, textarea, select',
    resetConfirmText = 'Vrátit formulář na právě zveřejněný stav?',
  } = options;
  const undoBtn = scope.querySelector('[data-history="undo"]');
  const redoBtn = scope.querySelector('[data-history="redo"]');
  const resetBtn = scope.querySelector('[data-history="reset"]');
  if (!undoBtn || !redoBtn || !resetBtn) {
    return { capture: () => {}, clear: () => {} };
  }

  const toJson = (v) => JSON.stringify(v ?? null);
  const fromJson = (v) => {
    try { return JSON.parse(v); } catch { return null; }
  };
  const getRecord = () => {
    if (!_editHistory.has(contextKey)) {
      _editHistory.set(contextKey, { undo: [], redo: [], current: toJson(getState()), published: toJson(publishedState) });
    }
    return _editHistory.get(contextKey);
  };
  const updateButtons = () => {
    const rec = getRecord();
    undoBtn.disabled = rec.undo.length === 0;
    redoBtn.disabled = rec.redo.length === 0;
    resetBtn.disabled = rec.current === rec.published;
  };
  const capture = () => {
    const rec = getRecord();
    const next = toJson(getState());
    if (next === rec.current) {
      updateButtons();
      return;
    }
    rec.undo.push(rec.current);
    if (rec.undo.length > EDIT_HISTORY_LIMIT) rec.undo.shift();
    rec.redo = [];
    rec.current = next;
    updateButtons();
  };
  const clear = () => {
    const rec = getRecord();
    rec.undo = [];
    rec.redo = [];
    rec.current = toJson(getState());
    rec.published = toJson(publishedState);
    updateButtons();
  };
  const applyJson = (nextJson) => {
    applyState(fromJson(nextJson));
    const rec = getRecord();
    rec.current = nextJson;
    updateButtons();
  };

  const rec = getRecord();
  rec.published = toJson(publishedState);
  rec.current = toJson(getState());
  updateButtons();

  const onFieldChange = (event) => {
    const target = event.target;
    if (target && typeof target.matches === 'function' && target.matches(inputSelector)) {
      capture();
    }
  };
  scope.addEventListener('input', onFieldChange);
  scope.addEventListener('change', onFieldChange);

  undoBtn.addEventListener('click', () => {
    const r = getRecord();
    if (!r.undo.length) return;
    r.redo.push(r.current);
    applyJson(r.undo.pop());
  });
  redoBtn.addEventListener('click', () => {
    const r = getRecord();
    if (!r.redo.length) return;
    r.undo.push(r.current);
    if (r.undo.length > EDIT_HISTORY_LIMIT) r.undo.shift();
    applyJson(r.redo.pop());
  });
  resetBtn.addEventListener('click', () => {
    const r = getRecord();
    if (r.current === r.published) return;
    if (!confirm(resetConfirmText)) return;
    r.undo.push(r.current);
    if (r.undo.length > EDIT_HISTORY_LIMIT) r.undo.shift();
    r.redo = [];
    applyJson(r.published);
    _ctx.showToast('Formulář vrácen na zveřejněný stav.', 'success');
  });

  return { capture, clear };
}

// ─── POJMENOVANÉ KONCEPTY / VERZE (F12-D) ─────────────────────

/** HTML tlačítek pro práci s pojmenovanými verzemi konceptu. @returns {string} */
function versionControlsHtml() {
  return `
    <button class="btn btn-ghost btn-sm" data-action="save-version" title="Uložit aktuální koncept jako pojmenovanou verzi">🏷️ Uložit jako verzi…</button>
    <button class="btn btn-ghost btn-sm" data-action="versions" title="Spravovat uložené verze konceptu">🗂️ Verze konceptu</button>`;
}

/**
 * Naváže tlačítka verzí (uložit jako verzi / spravovat verze) v rámci scope.
 * @param {HTMLElement} scope — element obsahující tlačítka [data-action]
 * @param {string} entity — 'content_blocks' | 'hero_config' | 'services'
 * @param {string} entityId — section_key | page_key | slug
 * @param {Function} getPayload — () => Object (payload pro uložení verze)
 * @param {Function} afterLoad — () => void (re-render editoru po načtení verze)
 */
function wireVersionControls(scope, entity, entityId, getPayload, afterLoad) {
  const { api, showToast } = _ctx;
  if (!api?.saveDraftVersion) return;
  scope.querySelector('[data-action="save-version"]')?.addEventListener('click', async () => {
    const name = (prompt('Název verze (např. „Vánoční nabídka"):') || '').trim();
    if (!name) return;
    const r = await api.saveDraftVersion(entity, entityId, name, getPayload());
    showToast(r.ok ? `Verze „${name}" uložena ✓` : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
  });
  scope.querySelector('[data-action="versions"]')?.addEventListener('click', () => openVersionsModal(entity, entityId, afterLoad));
}

/** Modal se seznamem verzí + akce načíst/přejmenovat/smazat. */
async function openVersionsModal(entity, entityId, afterLoad) {
  const { api, showToast } = _ctx;
  const res = await api.listDraftVersions(entity, entityId);
  if (!res.ok) { showToast('Chyba: ' + (res.error || 'Nepodařilo se načíst verze konceptu.'), 'error'); return; }
  const versions = res.data?.versions || [];
  const rowsHtml = versions.length
    ? versions.map((v) => `
        <tr data-id="${esc(v.id)}">
          <td>${esc(v.name)}</td>
          <td style="white-space:nowrap; color:var(--c-sage,#738A75); font-size:.85rem;">${fmtDate(v.updated_at)}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn btn-primary btn-sm" data-v="load">Načíst</button>
            <button class="btn btn-secondary btn-sm" data-v="rename">Přejmenovat</button>
            <button class="btn btn-danger btn-sm" data-v="del" title="Smazat verzi">✕</button>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="3">${emptyCard('Zatím žádné uložené verze. Uložte aktuální koncept tlačítkem „Uložit jako verzi…".')}</td></tr>`;
  showModal(`
    <div class="modal" style="max-width:640px; width:95%;">
      <div class="modal-header"><h3 class="card-title">🗂️ Verze konceptu</h3><button class="btn-icon" data-m="close">✕</button></div>
      <div class="modal-body">
        <table class="table" style="width:100%;"><tbody>${rowsHtml}</tbody></table>
        <p class="form-hint">„Načíst" přepíše aktuální pracovní koncept zvolenou verzí (samo o sobě nic nezveřejní).</p>
      </div>
    </div>`, (overlay, close) => {
    overlay.querySelector('[data-m="close"]').addEventListener('click', close);
    overlay.querySelectorAll('tr[data-id]').forEach((tr) => {
      const id = tr.dataset.id;
      tr.querySelector('[data-v="load"]')?.addEventListener('click', async () => {
        if (!confirm('Načíst tuto verzi do pracovního konceptu? Přepíše aktuální (i neuložené) změny konceptu.')) return;
        const r = await api.loadDraftVersion(id);
        if (r.ok) { showToast('Verze načtena do konceptu ✓', 'success'); close(); afterLoad?.(); }
        else showToast('Chyba: ' + r.error, 'error');
      });
      tr.querySelector('[data-v="rename"]')?.addEventListener('click', async () => {
        const name = (prompt('Nový název verze:') || '').trim();
        if (!name) return;
        const r = await api.renameDraftVersion(id, name);
        showToast(r.ok ? 'Přejmenováno ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
        if (r.ok) { close(); openVersionsModal(entity, entityId, afterLoad); }
      });
      tr.querySelector('[data-v="del"]')?.addEventListener('click', async () => {
        if (!confirm('Smazat tuto verzi konceptu?')) return;
        const r = await api.deleteDraftVersion(id);
        showToast(r.ok ? 'Verze smazána ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
        if (r.ok) { close(); openVersionsModal(entity, entityId, afterLoad); }
      });
    });
  });
}

/**
 * Vstupní bod modulu — vykreslí záložky a načte výchozí (Stránky).
 * @param {HTMLElement} container
 * @param {{api:Object, showToast:Function}} ctx
 */
export async function render(container, ctx) {
  _ctx = ctx;
  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Obsah webu</h1>
      <p class="canvas-subtitle">Úpravy se ukládají jako koncept a v náhledu vpravo vidíte, jak budou vypadat. Teprve „Zveřejnit" je pustí na web.</p>
    </div>
    <div class="cms-tabs" style="display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:1.5rem; border-bottom:1px solid rgba(115,138,117,0.15); padding-bottom:.75rem;">
      <button class="btn btn-primary cms-tab" data-tab="stranky">📄 Stránky</button>
      <button class="btn btn-secondary cms-tab" data-tab="sluzby">⚙️ Služby</button>
      <button class="btn btn-secondary cms-tab" data-tab="faq">❓ FAQ</button>
      <button class="btn btn-secondary cms-tab" data-tab="footer">📇 Footer &amp; Kontakt</button>
      <button class="btn btn-secondary cms-tab" data-tab="seo">🔍 SEO</button>
      <button class="btn btn-secondary cms-tab" data-tab="landing">📍 Landing</button>
      <button class="btn btn-secondary cms-tab" data-tab="galerie">🖼️ Galerie</button>
      <button class="btn btn-secondary cms-tab" data-tab="media">🗂️ Mediatéka</button>
      <button class="btn btn-secondary cms-tab" data-tab="hero">🎯 Hero bannery</button>
      <button class="btn btn-secondary cms-tab" data-tab="historie">🕓 Historie</button>
    </div>
    <div id="cms-tab-body"><div class="card"><div class="card-body">Načítám…</div></div></div>
  `;
  const tabs = container.querySelectorAll('.cms-tab');
  tabs.forEach((t) => t.addEventListener('click', () => {
    tabs.forEach((x) => {
      const active = x === t;
      x.classList.toggle('btn-primary', active);
      x.classList.toggle('btn-secondary', !active);
    });
    switchTab(container, t.dataset.tab);
  }));
  await switchTab(container, 'stranky');
}

/**
 * Přepne aktivní záložku a vykreslí její obsah.
 * @param {HTMLElement} container
 * @param {string} tab
 */
async function switchTab(container, tab) {
  const body = container.querySelector('#cms-tab-body');
  body.innerHTML = `<div class="card"><div class="card-body">Načítám…</div></div>`;
  try {
    if (tab === 'stranky') return renderStranky(body);
    if (tab === 'sluzby') return renderSluzby(body);
    if (tab === 'faq') return renderFaq(body);
    if (tab === 'footer') return renderFooter(body);
    if (tab === 'seo') return renderSeo(body);
    if (tab === 'landing') return renderLanding(body);
    if (tab === 'galerie') return renderGalerie(body);
    if (tab === 'media') return renderMediaLibrary(body);
    if (tab === 'hero') return renderHero(body);
    if (tab === 'historie') return renderHistorie(body);
  } catch (err) {
    console.error('[cms] tab error:', err);
    body.innerHTML = `<div class="card"><div class="card-body">Chyba: ${esc(err.message)}</div></div>`;
  }
}

// ─── STRÁNKY (textové sekce homepage) ─────────────────────────

/** Vykreslí záložku Stránky (editovatelné texty homepage + náhled). @param {HTMLElement} body */
async function renderStranky(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getContentSections();
  const all = res.ok ? (res.data?.sections || []) : [];
  const textKeys = all.filter((s) => s.content_type === 'text' &&
    (s.section_key.startsWith('home-') || s.section_key === 'homepage-galerie-intro'))
    .map((s) => s.section_key);
  const cardKeys = all.filter((s) => s.content_type === 'config' &&
    (s.section_key === 'home-jakfunguje-cards' || s.section_key === 'home-cert-cards'))
    .map((s) => s.section_key);

  const [textDetails, cardDetails] = await Promise.all([
    Promise.all(textKeys.map((k) => api.getContentSection(k))),
    Promise.all(cardKeys.map((k) => api.getContentSection(k))),
  ]);
  const sections = textDetails.filter((r) => r.ok).map((r) => r.data);
  const cards = cardDetails.filter((r) => r.ok).map((r) => r.data);

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,460px); gap:1.5rem; align-items:start;">
      <div id="cms-sections">
        ${sections.length ? sections.map(sectionCard).join('') : emptyCard('Žádné textové sekce.')}
        ${cards.map(cardGroupCard).join('')}
      </div>
      ${previewPaneHtml()}
    </div>
  `;
  initPreviewPane(body);
  sections.forEach((s) => wireSectionCard(body, s.section_key, s));
  cards.forEach((c) => wireCardGroup(body, c.section_key, c));
}

/** Vrátí HTML editoru skupiny karet (config JSON [{title,text}]). @param {Object} s @returns {string} */
function cardGroupCard(s) {
  let items = [];
  try { items = JSON.parse(s.has_draft ? (s.draft_content_markdown ?? s.content_markdown) : s.content_markdown) || []; } catch { items = []; }
  const rows = items.map((it, i) => cardRow(it, i)).join('');
  return `
    <div class="card mb-6 cms-cardgroup-card" data-key="${esc(s.section_key)}">
      <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
        <h3 class="card-title" style="margin:0; font-size:1rem;">${esc(s.title || s.section_key)} (karty)</h3>
        <span class="cms-state">${draftBadge(!!s.has_draft)}</span>
      </div>
      <div class="card-body">
        <div class="cms-card-rows">${rows}</div>
        <button class="btn btn-ghost btn-sm" data-action="add-row" style="margin:.25rem 0 1rem;">➕ Přidat kartu</button>
        <p class="form-hint">Ikony karet zůstávají dané designem; editují se nadpisy a texty. Pořadí = pořadí na webu.</p>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" data-action="save">💾 Uložit koncept</button>
          <button class="btn btn-primary btn-sm" data-action="publish" ${s.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
          <button class="btn btn-ghost btn-sm" data-action="discard" ${s.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
          ${historyControlsHtml()}
          ${versionControlsHtml()}
        </div>
      </div>
    </div>`;
}

/** Vrátí HTML jednoho řádku karty. @param {Object} it @param {number} i @returns {string} */
function cardRow(it, i) {
  return `
    <div class="cms-card-row" style="border:1px solid rgba(115,138,117,0.15); border-radius:8px; padding:.6rem; margin-bottom:.5rem;">
      <div style="display:flex; gap:.5rem; align-items:center; margin-bottom:.4rem;">
        <strong style="font-size:.8rem; color:var(--c-sage,#738A75);">Karta ${i + 1}</strong>
        <button class="btn btn-danger btn-sm" data-action="del-row" style="margin-left:auto; padding:.1rem .45rem;">✕</button>
      </div>
      <input type="text" class="form-input" data-card="title" value="${esc(it.title || '')}" placeholder="Nadpis karty" style="margin-bottom:.4rem;">
      <textarea class="form-input" data-card="text" rows="2" placeholder="Text karty">${esc(it.text || '')}</textarea>
    </div>`;
}

/** Naváže akce editoru skupiny karet. @param {HTMLElement} root @param {string} key */
function wireCardGroup(root, key, row) {
  const { api, showToast } = _ctx;
  const card = root.querySelector(`.cms-cardgroup-card[data-key="${CSS.escape(key)}"]`);
  if (!card) return;
  const rowsWrap = card.querySelector('.cms-card-rows');
  const setBadge = (hasDraft) => {
    card.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    card.querySelector('[data-action="publish"]').disabled = !hasDraft;
    card.querySelector('[data-action="discard"]').disabled = !hasDraft;
  };
  const collect = () => Array.from(rowsWrap.querySelectorAll('.cms-card-row')).map((r) => ({
    title: r.querySelector('[data-card="title"]').value,
    text: r.querySelector('[data-card="text"]').value,
  }));
  const renumber = () => {
    rowsWrap.querySelectorAll('.cms-card-row strong').forEach((el, i) => { el.textContent = `Karta ${i + 1}`; });
  };
  let publishedItems = [];
  try { publishedItems = JSON.parse(row?.content_markdown || '[]') || []; } catch { publishedItems = []; }
  const applyItems = (nextItems) => {
    const arr = Array.isArray(nextItems) ? nextItems : [];
    rowsWrap.innerHTML = arr.map((it, i) => cardRow(it || { title: '', text: '' }, i)).join('');
  };
  const history = wireEditHistory(card, {
    contextKey: `content_blocks:${key}:cards`,
    inputSelector: '.cms-card-row [data-card]',
    getState: collect,
    applyState: applyItems,
    publishedState: publishedItems,
    resetConfirmText: 'Vrátit karty na zveřejněný stav?',
  });
  rowsWrap.addEventListener('click', (e) => {
    const del = e.target.closest('[data-action="del-row"]');
    if (del) {
      del.closest('.cms-card-row').remove();
      renumber();
      history.capture();
    }
  });
  card.querySelector('[data-action="add-row"]').addEventListener('click', () => {
    rowsWrap.insertAdjacentHTML('beforeend', cardRow({ title: '', text: '' }, rowsWrap.children.length));
    history.capture();
  });
  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    // title NEposíláme — PUT zachová původní (DOM h3 má suffix „(karty)", řetězil by se)
    const r = await api.updateContentSection({ section_key: key, content_markdown: JSON.stringify(collect()), content_type: 'config' });
    if (r.ok) { showToast('Koncept uložen ✓ — obnovte náhled (↻)', 'success'); setBadge(true); refreshPreview(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  card.querySelector('[data-action="publish"]').addEventListener('click', async () => {
    const r = await api.publishContentSection(key);
    if (r.ok) { showToast('Zveřejněno ✓', 'success'); setBadge(false); refreshPreview(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  card.querySelector('[data-action="discard"]').addEventListener('click', async () => {
    if (!confirm('Zahodit koncept karet?')) return;
    const r = await api.discardContentSection(key);
    if (r.ok) { showToast('Koncept zahozen ✓', 'success'); await renderStranky(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  history.clear();
  wireVersionControls(card, 'content_blocks', key, () => ({ content_markdown: JSON.stringify(collect()) }), () => renderStranky(root));
}

/** Vrátí HTML karty jedné textové sekce. @param {Object} s @returns {string} */
function sectionCard(s) {
  const editTitle = s.has_draft ? (s.draft_title ?? s.title) : s.title;
  const editContent = s.has_draft ? (s.draft_content_markdown ?? s.content_markdown) : s.content_markdown;
  return `
    <div class="card mb-6 cms-section-card" data-key="${esc(s.section_key)}">
      <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; gap:.5rem;">
        <h3 class="card-title" style="margin:0; font-size:1rem;">${esc(s.title || s.section_key)}</h3>
        <span class="cms-state">${draftBadge(!!s.has_draft)}</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Nadpis (interní název)</label>
          <input type="text" class="form-input" data-field="title" value="${esc(editTitle)}">
        </div>
        <div class="form-group">
          <label class="form-label">Obsah</label>
          <textarea class="form-input" data-field="content_markdown" rows="4">${esc(editContent)}</textarea>
          <p class="form-hint">Klíč: <code>${esc(s.section_key)}</code> · Povolené značky: odstavce, tučné, kurzíva, odkazy. Skripty se odstraní.</p>
        </div>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" data-action="save">💾 Uložit koncept</button>
          <button class="btn btn-primary btn-sm" data-action="publish" ${s.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
          <button class="btn btn-ghost btn-sm" data-action="discard" ${s.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
          ${historyControlsHtml()}
          ${versionControlsHtml()}
        </div>
      </div>
    </div>`;
}

/** Naváže akce (uložit koncept / zveřejnit / zahodit) na kartu sekce. @param {HTMLElement} root @param {string} key @param {Object} row */
function wireSectionCard(root, key, row) {
  const { api, showToast } = _ctx;
  const card = root.querySelector(`.cms-section-card[data-key="${CSS.escape(key)}"]`);
  if (!card) return;
  const val = (f) => card.querySelector(`[data-field="${f}"]`).value;
  const setBadge = (hasDraft) => {
    card.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    card.querySelector('[data-action="publish"]').disabled = !hasDraft;
    card.querySelector('[data-action="discard"]').disabled = !hasDraft;
  };
  const setVal = (f, v) => {
    const el = card.querySelector(`[data-field="${f}"]`);
    if (el) el.value = v == null ? '' : String(v);
  };
  const history = wireEditHistory(card, {
    contextKey: `content_blocks:${key}:text`,
    inputSelector: '[data-field]',
    getState: () => ({ title: val('title'), content_markdown: val('content_markdown') }),
    applyState: (state) => {
      setVal('title', state?.title || '');
      setVal('content_markdown', state?.content_markdown || '');
    },
    publishedState: { title: row?.title || '', content_markdown: row?.content_markdown || '' },
    resetConfirmText: 'Vrátit text sekce na zveřejněný stav?',
  });

  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: key, title: val('title'), content_markdown: val('content_markdown'), content_type: 'text' });
    if (r.ok) { showToast('Koncept uložen ✓ — obnovte náhled (↻)', 'success'); setBadge(true); refreshPreview(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  card.querySelector('[data-action="publish"]').addEventListener('click', async () => {
    const r = await api.publishContentSection(key);
    if (r.ok) { showToast('Zveřejněno ✓', 'success'); setBadge(false); refreshPreview(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  card.querySelector('[data-action="discard"]').addEventListener('click', async () => {
    if (!confirm('Zahodit neuložené změny (koncept) této sekce?')) return;
    const r = await api.discardContentSection(key);
    if (r.ok) { showToast('Koncept zahozen ✓', 'success'); await renderStranky(root); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  history.clear();
  wireVersionControls(card, 'content_blocks', key, () => ({ title: val('title'), content_markdown: val('content_markdown') }), () => renderStranky(root));
}

// ─── FOOTER & KONTAKT (NAP config) ────────────────────────────

const NAP_FIELDS = [
  ['company', 'Název', 'text'], ['legal', 'Právní forma', 'text'], ['ico', 'IČO', 'text'],
  ['street', 'Ulice', 'text'], ['city', 'Město', 'text'], ['zip', 'PSČ', 'text'],
  ['phone', 'Telefon (zobrazený)', 'text'], ['phoneHref', 'Telefon (pro volání, bez mezer)', 'text'],
  ['email', 'E-mail', 'text'], ['hoursWeek', 'Otevírací doba (pracovní dny)', 'text'],
  ['hoursWeekend', 'Otevírací doba (víkend)', 'text'], ['areas', 'Dojezdová spádovost', 'textarea'],
  ['brandDesc', 'Popis v patičce', 'textarea'], ['disclaimer', 'Právní doložka', 'textarea'],
  ['copyright', 'Copyright', 'text'],
];

/** Vykreslí záložku Footer & Kontakt (NAP config + náhled). @param {HTMLElement} body */
async function renderFooter(body) {
  const { api, showToast } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }

  const res = await api.getContentSection('site-nap');
  if (!res.ok) { body.innerHTML = emptyCard('Konfigurace „site-nap" zatím neexistuje (spusťte migraci 0017).'); return; }
  const row = res.data;
  let nap = {};
  try { nap = JSON.parse(row.has_draft ? (row.draft_content_markdown ?? row.content_markdown) : row.content_markdown); } catch { nap = {}; }

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,460px); gap:1.5rem; align-items:start;">
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="margin:0;">📇 Kontakt &amp; patička</h3>
          <span class="cms-state">${draftBadge(!!row.has_draft)}</span>
        </div>
        <div class="card-body">
          ${NAP_FIELDS.map(([k, label, type]) => `
            <div class="form-group">
              <label class="form-label">${esc(label)}</label>
              ${type === 'textarea'
                ? `<textarea class="form-input" data-nap="${k}" rows="2">${esc(nap[k] || '')}</textarea>`
                : `<input type="text" class="form-input" data-nap="${k}" value="${esc(nap[k] || '')}">`}
            </div>`).join('')}
          <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="nap-save">💾 Uložit koncept</button>
            <button class="btn btn-primary btn-sm" id="nap-publish" ${row.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
            <button class="btn btn-ghost btn-sm" id="nap-discard" ${row.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
            ${historyControlsHtml()}
            ${versionControlsHtml()}
          </div>
        </div>
      </div>
      ${previewPaneHtml()}
    </div>`;

  initPreviewPane(body);
  const setBadge = (hasDraft) => {
    body.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    body.querySelector('#nap-publish').disabled = !hasDraft;
    body.querySelector('#nap-discard').disabled = !hasDraft;
  };
  const collect = () => {
    const out = {};
    body.querySelectorAll('[data-nap]').forEach((el) => { out[el.getAttribute('data-nap')] = el.value; });
    return out;
  };
  let publishedNap = {};
  try { publishedNap = JSON.parse(row.content_markdown || '{}') || {}; } catch { publishedNap = {}; }
  const applyNap = (state) => {
    body.querySelectorAll('[data-nap]').forEach((el) => {
      const k = el.getAttribute('data-nap');
      el.value = state?.[k] == null ? '' : String(state[k]);
    });
  };
  const history = wireEditHistory(body.querySelector('.card'), {
    contextKey: 'content_blocks:site-nap',
    inputSelector: '[data-nap]',
    getState: collect,
    applyState: applyNap,
    publishedState: publishedNap,
    resetConfirmText: 'Vrátit kontakt a patičku na zveřejněný stav?',
  });
  body.querySelector('#nap-save').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: 'site-nap', title: 'Kontaktní údaje a patička (NAP)', content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) { setBadge(true); refreshPreview(body); }
  });
  body.querySelector('#nap-publish').addEventListener('click', async () => {
    const r = await api.publishContentSection('site-nap');
    showToast(r.ok ? 'Zveřejněno ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) renderFooter(body);
  });
  body.querySelector('#nap-discard').addEventListener('click', async () => {
    if (!confirm('Zahodit neuložené změny patičky?')) return;
    const r = await api.discardContentSection('site-nap');
    showToast(r.ok ? 'Koncept zahozen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) renderFooter(body);
  });
  history.clear();
  wireVersionControls(body, 'content_blocks', 'site-nap', () => ({ content_markdown: JSON.stringify(collect()), title: 'Kontaktní údaje a patička (NAP)' }), () => renderFooter(body));
}

// ─── FAQ (sdílené, config [{q,a}]) ────────────────────────────

/** Vykreslí záložku FAQ (opakovatelné Q/A + náhled landing). @param {HTMLElement} body */
async function renderFaq(body) {
  const { api, showToast } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }
  const res = await api.getContentSection('faq-main');
  if (!res.ok) { body.innerHTML = emptyCard('Blok „faq-main" neexistuje (spusťte migraci 0019).'); return; }
  const row = res.data;
  let items = [];
  try { items = JSON.parse(row.has_draft ? (row.draft_content_markdown ?? row.content_markdown) : row.content_markdown) || []; } catch { items = []; }

  body.innerHTML = `
    <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,460px); gap:1.5rem; align-items:start;">
      <div class="card">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="margin:0;">❓ Časté otázky (sdílené na landing stránkách)</h3>
          <span class="cms-state">${draftBadge(!!row.has_draft)}</span>
        </div>
        <div class="card-body">
          <div class="faq-rows">${items.map(faqRow).join('')}</div>
          <button class="btn btn-ghost btn-sm" data-action="add-row" style="margin:.25rem 0 1rem;">➕ Přidat otázku</button>
          <p class="form-hint">V odpovědi lze použít odkaz na program: &lt;a href="#energie-a-vitalita"&gt;…&lt;/a&gt;.</p>
          <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" data-action="save">💾 Uložit koncept</button>
            <button class="btn btn-primary btn-sm" data-action="publish" ${row.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
            <button class="btn btn-ghost btn-sm" data-action="discard" ${row.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
            ${historyControlsHtml()}
            ${versionControlsHtml()}
          </div>
        </div>
      </div>
      ${previewPaneHtml('biorezonance-pisek.html')}
    </div>`;

  const rowsWrap = body.querySelector('.faq-rows');
  initPreviewPane(body);
  const setBadge = (hasDraft) => {
    body.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    body.querySelector('[data-action="publish"]').disabled = !hasDraft;
    body.querySelector('[data-action="discard"]').disabled = !hasDraft;
  };
  const collect = () => Array.from(rowsWrap.querySelectorAll('.faq-row')).map((r) => ({
    q: r.querySelector('[data-faq="q"]').value, a: r.querySelector('[data-faq="a"]').value,
  }));
  let publishedFaq = [];
  try { publishedFaq = JSON.parse(row.content_markdown || '[]') || []; } catch { publishedFaq = []; }
  const applyFaq = (state) => {
    const arr = Array.isArray(state) ? state : [];
    rowsWrap.innerHTML = arr.map((it) => faqRow(it || { q: '', a: '' })).join('');
  };
  const history = wireEditHistory(body.querySelector('.card'), {
    contextKey: 'content_blocks:faq-main',
    inputSelector: '[data-faq]',
    getState: collect,
    applyState: applyFaq,
    publishedState: publishedFaq,
    resetConfirmText: 'Vrátit FAQ na zveřejněný stav?',
  });
  rowsWrap.addEventListener('click', (e) => {
    const del = e.target.closest('[data-action="del-row"]');
    if (del) {
      del.closest('.faq-row').remove();
      history.capture();
    }
  });
  body.querySelector('[data-action="add-row"]').addEventListener('click', () => {
    rowsWrap.insertAdjacentHTML('beforeend', faqRow({ q: '', a: '' }));
    history.capture();
  });
  body.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: 'faq-main', title: 'FAQ (sdílené)', content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) { setBadge(true); refreshPreview(body); }
  });
  body.querySelector('[data-action="publish"]').addEventListener('click', async () => {
    const r = await api.publishContentSection('faq-main');
    showToast(r.ok ? 'Zveřejněno ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) renderFaq(body);
  });
  body.querySelector('[data-action="discard"]').addEventListener('click', async () => {
    if (!confirm('Zahodit koncept FAQ?')) return;
    const r = await api.discardContentSection('faq-main');
    showToast(r.ok ? 'Koncept zahozen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) renderFaq(body);
  });
  history.clear();
  wireVersionControls(body, 'content_blocks', 'faq-main', () => ({ content_markdown: JSON.stringify(collect()), title: 'FAQ (sdílené)' }), () => renderFaq(body));
}

/** Řádek FAQ (otázka + odpověď). @param {Object} it @returns {string} */
function faqRow(it) {
  return `
    <div class="faq-row" style="border:1px solid rgba(115,138,117,0.15); border-radius:8px; padding:.6rem; margin-bottom:.5rem;">
      <div style="display:flex; gap:.5rem; margin-bottom:.4rem;">
        <input type="text" class="form-input" data-faq="q" value="${esc(it.q || '')}" placeholder="Otázka">
        <button class="btn btn-danger btn-sm" data-action="del-row" style="padding:.1rem .5rem;">✕</button>
      </div>
      <textarea class="form-input" data-faq="a" rows="3" placeholder="Odpověď (lze odkaz na program)">${esc(it.a || '')}</textarea>
    </div>`;
}

// ─── SEO + LANDING (sdílený config editor) ────────────────────

const SEO_PAGES = [
  ['seo-homepage', 'Homepage', ''],
  ['seo-pisek', 'Písek', 'biorezonance-pisek.html'],
  ['seo-strakonice', 'Strakonice', 'biorezonance-strakonice.html'],
  ['seo-vodnany', 'Vodňany', 'biorezonance-vodnany.html'],
  ['seo-milevsko', 'Milevsko', 'biorezonance-milevsko.html'],
  ['seo-protivin', 'Protivín', 'biorezonance-protivin.html'],
];
const SEO_FIELDS = [
  ['title', 'Titulek (title)', 'text'], ['description', 'Popis (meta description)', 'textarea'],
  ['ogTitle', 'OG titulek', 'text'], ['ogDescription', 'OG popis', 'textarea'],
  ['ogImage', 'OG obrázek (URL)', 'text'], ['canonical', 'Canonical URL', 'text'],
];
const LANDING_PAGES = [
  ['pisek', 'Písek'], ['strakonice', 'Strakonice'], ['vodnany', 'Vodňany'], ['milevsko', 'Milevsko'], ['protivin', 'Protivín'],
];
const LANDING_FIELDS = [
  ['tagline', 'Štítek (tagline)', 'text'], ['h1City', 'Město v nadpisu (H1)', 'text'],
  ['heroDesc', 'Hero popis', 'textarea'], ['availTitle', 'Nadpis „dostupná z…"', 'text'],
  ['availIntro', 'Text „dostupná z…"', 'textarea'], ['faqTitle', 'Nadpis FAQ', 'text'],
  ['ctaIntro', 'Text výzvy (CTA)', 'textarea'], ['footerBrandDesc', 'Popis v patičce', 'textarea'],
];

/** Vykreslí záložku SEO (výběr stránky + meta formulář). @param {HTMLElement} body */
async function renderSeo(body) {
  if (!_ctx.api) { body.innerHTML = demoNote(); return; }
  body.innerHTML = `
    <div class="card mb-6"><div class="card-body">
      <label class="form-label">Stránka</label>
      <select class="form-select" id="seo-page" style="min-width:240px;">
        ${SEO_PAGES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}
      </select>
    </div></div>
    <div id="seo-detail"></div>`;
  const sel = body.querySelector('#seo-page');
  const detail = body.querySelector('#seo-detail');
  const open = () => {
    const page = SEO_PAGES.find((p) => p[0] === sel.value);
    configEditor(detail, page[0], 'SEO – ' + page[1], SEO_FIELDS, page[2]);
  };
  sel.addEventListener('change', open);
  open();
}

/** Vykreslí záložku Landing (výběr města + per-město texty). @param {HTMLElement} body */
async function renderLanding(body) {
  if (!_ctx.api) { body.innerHTML = demoNote(); return; }
  body.innerHTML = `
    <div class="card mb-6"><div class="card-body">
      <label class="form-label">Lokalita</label>
      <select class="form-select" id="landing-city" style="min-width:240px;">
        ${LANDING_PAGES.map(([c, l]) => `<option value="${c}">${esc(l)}</option>`).join('')}
      </select>
    </div></div>
    <div id="landing-detail"></div>`;
  const sel = body.querySelector('#landing-city');
  const detail = body.querySelector('#landing-detail');
  const open = () => {
    const city = sel.value;
    const label = LANDING_PAGES.find((p) => p[0] === city)[1];
    configEditor(detail, 'landing-' + city, 'Landing – ' + label, LANDING_FIELDS, 'biorezonance-' + city + '.html');
  };
  sel.addEventListener('change', open);
  open();
}

/**
 * Obecný editor config bloku (JSON pole) s draft/publish + náhledem.
 * @param {HTMLElement} host @param {string} sectionKey @param {string} titleLabel
 * @param {Array<[string,string,string]>} fields @param {string} previewPage
 */
async function configEditor(host, sectionKey, titleLabel, fields, previewPage) {
  const { api, showToast } = _ctx;
  host.innerHTML = `<div class="card"><div class="card-body">Načítám…</div></div>`;
  const res = await api.getContentSection(sectionKey);
  if (!res.ok) { host.innerHTML = emptyCard(`Blok „${esc(sectionKey)}" neexistuje (spusťte migraci 0019).`); return; }
  const row = res.data;
  let cfg = {};
  try { cfg = JSON.parse(row.has_draft ? (row.draft_content_markdown ?? row.content_markdown) : row.content_markdown) || {}; } catch { cfg = {}; }

  host.innerHTML = `
    <div style="display:grid; grid-template-columns: minmax(0,1fr) minmax(0,460px); gap:1.5rem; align-items:start;">
      <div class="card cms-config-card" data-config-key="${escAttr(sectionKey)}">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title" style="margin:0;">${esc(titleLabel)}</h3>
          <span class="cms-state">${draftBadge(!!row.has_draft)}</span>
        </div>
        <div class="card-body">
          ${fields.map(([k, label, type]) => `
            <div class="form-group">
              <label class="form-label">${esc(label)}</label>
              ${type === 'textarea'
                ? `<textarea class="form-input" data-cfg="${k}" rows="2">${esc(cfg[k] || '')}</textarea>`
                : `<input type="text" class="form-input" data-cfg="${k}" value="${esc(cfg[k] || '')}">`}
            </div>`).join('')}
          <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" data-action="save">💾 Uložit koncept</button>
            <button class="btn btn-primary btn-sm" data-action="publish" ${row.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
            <button class="btn btn-ghost btn-sm" data-action="discard" ${row.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
            ${historyControlsHtml()}
            ${versionControlsHtml()}
          </div>
        </div>
      </div>
      ${previewPaneHtml(previewPage)}
    </div>`;
  initPreviewPane(host);
  const setBadge = (hasDraft) => {
    host.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    host.querySelector('[data-action="publish"]').disabled = !hasDraft;
    host.querySelector('[data-action="discard"]').disabled = !hasDraft;
  };
  const collect = () => {
    const out = {};
    host.querySelectorAll('[data-cfg]').forEach((el) => { out[el.getAttribute('data-cfg')] = el.value; });
    return out;
  };
  let publishedCfg = {};
  try { publishedCfg = JSON.parse(row.content_markdown || '{}') || {}; } catch { publishedCfg = {}; }
  const applyCfg = (state) => {
    host.querySelectorAll('[data-cfg]').forEach((el) => {
      const k = el.getAttribute('data-cfg');
      el.value = state?.[k] == null ? '' : String(state[k]);
    });
  };
  const history = wireEditHistory(host.querySelector('.cms-config-card'), {
    contextKey: `content_blocks:${sectionKey}:config`,
    inputSelector: '[data-cfg]',
    getState: collect,
    applyState: applyCfg,
    publishedState: publishedCfg,
    resetConfirmText: 'Vrátit nastavení na zveřejněný stav?',
  });
  host.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: sectionKey, title: titleLabel, content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) { setBadge(true); refreshPreview(host); }
  });
  host.querySelector('[data-action="publish"]').addEventListener('click', async () => {
    const r = await api.publishContentSection(sectionKey);
    showToast(r.ok ? 'Zveřejněno ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) configEditor(host, sectionKey, titleLabel, fields, previewPage);
  });
  host.querySelector('[data-action="discard"]').addEventListener('click', async () => {
    if (!confirm('Zahodit koncept?')) return;
    const r = await api.discardContentSection(sectionKey);
    showToast(r.ok ? 'Koncept zahozen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) configEditor(host, sectionKey, titleLabel, fields, previewPage);
  });
  history.clear();
  wireVersionControls(host, 'content_blocks', sectionKey, () => ({ content_markdown: JSON.stringify(collect()), title: titleLabel }), () => configEditor(host, sectionKey, titleLabel, fields, previewPage));
}

// ─── GALERIE (draft/publish) ──────────────────────────────────

/** Vykreslí záložku Galerie. @param {HTMLElement} body */
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
            ${galleries.map((g) => `<option value="${esc(g.gallery_key)}">${esc(g.gallery_key)} (${g.count})${g.has_draft ? ' • koncept' : ''}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label">…nebo nová galerie</label>
          <input type="text" class="form-input" id="cms-gallery-new" placeholder="napr. service-energia" style="width:220px;">
        </div>
        <button class="btn btn-secondary" id="cms-gallery-load">Otevřít</button>
      </div>
    </div>
    <div id="cms-gallery-detail"></div>`;
  const sel = body.querySelector('#cms-gallery-select');
  const detail = body.querySelector('#cms-gallery-detail');
  body.querySelector('#cms-gallery-load').addEventListener('click', () => {
    const newKey = body.querySelector('#cms-gallery-new').value.trim().toLowerCase();
    const key = newKey || sel.value;
    if (key) renderGalleryDetail(detail, key);
  });
  sel.addEventListener('change', () => renderGalleryDetail(detail, sel.value));
  if (galleries.length) renderGalleryDetail(detail, galleries[0].gallery_key);
  else detail.innerHTML = emptyCard('Žádné galerie. Vytvořte novou zadáním klíče a nahráním fotky.');
}

/** Vykreslí detail galerie (upload + mřížka). @param {HTMLElement} detail @param {string} galleryKey */
async function renderGalleryDetail(detail, galleryKey) {
  const { api, showToast } = _ctx;
  detail.innerHTML = `<div class="card"><div class="card-body">Načítám galerii „${esc(galleryKey)}"…</div></div>`;
  const res = await api.getGalleryItems(galleryKey);
  const items = res.ok ? (res.data?.items || []) : [];
  const hasDraft = !!res.data?.has_draft;
  detail.innerHTML = `
    <div class="card mb-6">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; gap:.5rem; flex-wrap:wrap;">
        <h3 class="card-title" style="margin:0;">🖼️ Galerie „${esc(galleryKey)}"</h3>
        <span class="cms-state">${draftBadge(hasDraft)}</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Nahrát obrázek</label>
          <input type="file" class="form-input" id="cms-upload" accept="image/jpeg,image/png,image/webp,image/gif" multiple>
          <p class="form-hint">Max 5 MB na soubor. Nahrání ukládá koncept — na web se změny dostanou až po zveřejnění.</p>
          <div id="cms-upload-progress" class="form-hint" style="margin-top:.5rem;"></div>
        </div>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="cms-gallery-publish" ${hasDraft ? '' : 'disabled'}>✅ Zveřejnit</button>
          <button class="btn btn-ghost btn-sm" id="cms-gallery-discard" ${hasDraft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
        </div>
      </div>
    </div>
    <div id="cms-gallery-items" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:1rem;">
      ${items.length ? items.map((it, i) => galleryItemCard(it, i, items.length)).join('') : emptyCard('Galerie je prázdná.')}
    </div>`;
  detail.querySelector('#cms-upload').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    const prog = detail.querySelector('#cms-upload-progress');
    let ok = 0, failed = 0;
    for (let i = 0; i < files.length; i++) {
      prog.textContent = `Nahrávám ${i + 1}/${files.length}: ${files[i].name}…`;
      const r = await api.uploadGalleryImage(galleryKey, files[i]);
      if (r.ok) ok++; else { failed++; showToast(`Chyba u ${files[i].name}: ${r.error}`, 'error'); }
    }
    prog.textContent = '';
    showToast(
      failed === 0 ? `Nahráno do konceptu: ${ok} ✓` : `Nahráno do konceptu ${ok}, selhalo ${failed}`,
      failed === 0 ? 'success' : 'warning'
    );
    renderGalleryDetail(detail, galleryKey);
  });
  detail.querySelector('#cms-gallery-publish')?.addEventListener('click', async () => {
    const r = await api.publishGallery(galleryKey);
    if (r.ok) {
      showToast('Galerie zveřejněna ✓', 'success');
      const host = detail.closest('#cms-tab-body');
      if (host) renderGalerie(host); else renderGalleryDetail(detail, galleryKey);
    }
    else showToast('Chyba: ' + r.error, 'error');
  });
  detail.querySelector('#cms-gallery-discard')?.addEventListener('click', async () => {
    if (!confirm('Zahodit koncept galerie a vrátit se na zveřejněný stav?')) return;
    const r = await api.discardGallery(galleryKey);
    if (r.ok) {
      showToast('Koncept galerie zahozen ✓', 'success');
      const host = detail.closest('#cms-tab-body');
      if (host) renderGalerie(host); else renderGalleryDetail(detail, galleryKey);
    }
    else showToast('Chyba: ' + r.error, 'error');
  });
  detail.querySelectorAll('.cms-gallery-item').forEach((card) => wireGalleryItem(detail, galleryKey, card, items));
}

/** Vrátí HTML karty obrázku galerie. @param {Object} it @param {number} index @param {number} total @returns {string} */
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
            <button class="btn btn-secondary" data-action="up" ${index === 0 ? 'disabled' : ''} style="padding:.25rem .5rem;">↑</button>
            <button class="btn btn-secondary" data-action="down" ${index === total - 1 ? 'disabled' : ''} style="padding:.25rem .5rem;">↓</button>
          </div>
          <div style="display:flex; gap:.25rem;">
            <button class="btn btn-primary" data-action="save" style="padding:.25rem .5rem;">💾</button>
            <button class="btn btn-danger" data-action="delete" style="padding:.25rem .5rem;">🗑️</button>
          </div>
        </div>
      </div>
    </div>`;
}

/** Naváže akce na kartu obrázku. @param {HTMLElement} detail @param {string} galleryKey @param {HTMLElement} card @param {Array} items */
function wireGalleryItem(detail, galleryKey, card, items) {
  const { api, showToast } = _ctx;
  const id = card.dataset.id;
  const index = Number(card.dataset.index);
  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateGalleryItem({ id, gallery_key: galleryKey, caption: card.querySelector('[data-field="caption"]').value });
    if (r.ok) { showToast('Uloženo do konceptu ✓', 'success'); renderGalleryDetail(detail, galleryKey); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  card.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    if (!confirm('Opravdu smazat tento obrázek?')) return;
    const r = await api.deleteGalleryItem(id, galleryKey);
    if (r.ok) { showToast('Smazáno v konceptu ✓', 'success'); renderGalleryDetail(detail, galleryKey); }
    else showToast('Chyba: ' + r.error, 'error');
  });
  const move = async (dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const reordered = items.map((it) => ({ id: it.id, sort_order: 0 }));
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reordered.forEach((r, i) => (r.sort_order = i + 1));
    const r = await api.reorderGallery(galleryKey, reordered);
    if (r.ok) renderGalleryDetail(detail, galleryKey);
    else showToast('Chyba při řazení: ' + r.error, 'error');
  };
  card.querySelector('[data-action="up"]').addEventListener('click', () => move(-1));
  card.querySelector('[data-action="down"]').addEventListener('click', () => move(1));
}

// ─── MEDIATÉKA (centrální přehled assetů nad galeriemi) ─────────

/** Vrátí jednoduchý typ assetu podle URL. @param {string} url @returns {string} */
function mediaAssetKind(url) {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return 'video';
  if (/\.(jpe?g|png|webp|gif|avif|svg)$/.test(clean)) return 'image';
  return 'asset';
}

/** Sestaví agregovaný seznam assetů ze všech galerií. @returns {Promise<Array<Object>>} */
async function loadMediaAssets() {
  const { api } = _ctx;
  const res = await api.getGalleries();
  const galleries = res.ok ? (res.data?.galleries || []) : [];
  const details = await Promise.all(galleries.map(async (gallery) => {
    const detail = await api.getGalleryItems(gallery.gallery_key);
    return {
      gallery,
      items: detail.ok ? (detail.data?.items || []) : [],
      hasDraft: !!detail.data?.has_draft,
    };
  }));
  const seen = new Set();
  const assets = [];
  details.forEach(({ gallery, items, hasDraft }) => {
    items.forEach((item) => {
      const url = item.image_url || '';
      if (!url) return;
      const key = `${gallery.gallery_key}|${url}`;
      if (seen.has(key)) return;
      seen.add(key);
      assets.push({
        id: item.id,
        gallery_key: gallery.gallery_key,
        title: item.title || '',
        caption: item.caption || '',
        url,
        filename: item.image_filename || url.split('/').pop() || '',
        kind: mediaAssetKind(url),
        hasDraft,
        updated_at: item.updated_at || item.created_at || '',
      });
    });
  });
  return assets.sort((a, b) => a.gallery_key.localeCompare(b.gallery_key) || a.filename.localeCompare(b.filename));
}

/** Vykreslí záložku Mediatéka. @param {HTMLElement} body */
async function renderMediaLibrary(body) {
  const { showToast } = _ctx;
  body.innerHTML = `<div class="card"><div class="card-body">Načítám mediatéku…</div></div>`;
  const assets = await loadMediaAssets();
  body.innerHTML = `
    <div class="card mb-6">
      <div class="card-body">
        <div style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:flex-start;">
          <div>
            <h3 class="card-title" style="margin:0 0 .35rem;">🗂️ Mediatéka</h3>
            <p class="form-hint" style="margin:0;">Centrální přehled assetů používaných v galeriích a hero workflow. Výměny probíhají bezpečně přes koncept galerie/hero a teprve potom přes zveřejnění.</p>
          </div>
          <div style="display:flex; gap:.35rem; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" data-media-filter="all">Vše</button>
            <button class="btn btn-ghost btn-sm" data-media-filter="image">Obrázky</button>
            <button class="btn btn-ghost btn-sm" data-media-filter="video">Video-ready</button>
          </div>
        </div>
      </div>
    </div>
    <div id="cms-media-grid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1rem;">
      ${assets.length ? assets.map(mediaAssetCard).join('') : emptyCard('Zatím tu nejsou žádné assety. Nahrajte obrázky v záložce Galerie nebo Hero.')}
    </div>`;

  const grid = body.querySelector('#cms-media-grid');
  const applyFilter = (kind) => {
    grid.querySelectorAll('[data-media-kind]').forEach((card) => {
      card.hidden = kind !== 'all' && card.dataset.mediaKind !== kind;
    });
  };
  body.querySelectorAll('[data-media-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.mediaFilter || 'all';
      body.querySelectorAll('[data-media-filter]').forEach((x) => {
        const active = x === btn;
        x.classList.toggle('btn-secondary', active);
        x.classList.toggle('btn-ghost', !active);
      });
      applyFilter(kind);
    });
  });
  body.querySelectorAll('[data-media-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.getAttribute('data-media-copy') || '';
      try {
        await navigator.clipboard.writeText(url);
        showToast('URL assetu zkopírována ✓', 'success');
      } catch {
        showToast('URL: ' + url, 'info');
      }
    });
  });
  body.querySelectorAll('[data-open-gallery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = document.querySelector('.cms-tab[data-tab="galerie"]');
      tab?.click();
    });
  });
}

/** Vrátí HTML karty media assetu. @param {Object} asset @returns {string} */
function mediaAssetCard(asset) {
  const isImage = asset.kind === 'image';
  return `
    <div class="card cms-media-asset" data-media-kind="${escAttr(asset.kind)}">
      <div style="aspect-ratio:4/3; overflow:hidden; border-radius:8px 8px 0 0; background:#f3f1ec; display:grid; place-items:center;">
        ${isImage
          ? `<img src="${escAttr(asset.url)}" alt="${escAttr(asset.caption || asset.title || asset.filename)}" loading="lazy" style="width:100%; height:100%; object-fit:cover;">`
          : `<div style="font-size:2rem;">🎬</div>`}
      </div>
      <div class="card-body" style="padding:.75rem;">
        <div style="display:flex; justify-content:space-between; gap:.5rem; align-items:center; margin-bottom:.35rem;">
          <strong style="font-size:.9rem; overflow:hidden; text-overflow:ellipsis;">${esc(asset.caption || asset.title || asset.filename || asset.url)}</strong>
          <span class="badge ${asset.hasDraft ? 'badge-pending' : 'badge-confirmed'}">${asset.hasDraft ? 'Koncept' : 'Live'}</span>
        </div>
        <p class="form-hint" style="margin:.2rem 0;">Galerie: <code>${esc(asset.gallery_key)}</code> · typ: ${esc(asset.kind)}</p>
        <p class="form-hint" style="margin:.2rem 0; overflow:hidden; text-overflow:ellipsis;">${esc(asset.url)}</p>
        <div style="display:flex; gap:.35rem; flex-wrap:wrap; margin-top:.6rem;">
          <button class="btn btn-secondary btn-sm" data-media-copy="${escAttr(asset.url)}">Kopírovat URL</button>
          <button class="btn btn-ghost btn-sm" data-open-gallery="${escAttr(asset.gallery_key)}">Otevřít galerii</button>
        </div>
      </div>
    </div>`;
}

// ─── HERO (draft/publish) ─────────────────────────────────────

/** Vykreslí záložku Hero (výběr stránky + formulář). @param {HTMLElement} body */
async function renderHero(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }
  const res = await api.getHeroes();
  const heroes = res.ok ? (res.data?.heroes || []) : [];
  body.innerHTML = `
    <div class="card mb-6">
      <div class="card-body" style="display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label">Stránka (hero banner)</label>
          <select class="form-select" id="cms-hero-select" style="min-width:220px;">
            ${heroes.map((h) => `<option value="${esc(h.page_key)}">${esc(h.page_key)}${h.has_draft ? ' • koncept' : ''}</option>`).join('')}
            <option value="__new__">➕ Nová stránka…</option>
          </select>
        </div>
      </div>
    </div>
    <div id="cms-hero-detail"></div>`;
  const sel = body.querySelector('#cms-hero-select');
  const detail = body.querySelector('#cms-hero-detail');
  const show = async () => {
    if (sel.value === '__new__') {
      const key = prompt('Klíč stránky (např. homepage):');
      if (!key) { sel.selectedIndex = 0; return; }
      renderHeroForm(detail, { page_key: key.trim().toLowerCase() });
    } else {
      const r = await api.getHero(sel.value);
      renderHeroForm(detail, r.ok && r.data ? r.data : { page_key: sel.value });
    }
  };
  sel.addEventListener('change', show);
  if (heroes.length) { const r = await api.getHero(heroes[0].page_key); renderHeroForm(detail, r.ok && r.data ? r.data : { page_key: heroes[0].page_key }); }
  else renderHeroForm(detail, { page_key: 'homepage' });
}

/** Vykreslí a naváže formulář hero banneru. @param {HTMLElement} detail @param {Object} row */
function renderHeroForm(detail, row) {
  const { api, showToast } = _ctx;
  row = row || {};
  // Verze lze ukládat až když hero záznam v DB existuje (po prvním uložení konceptu);
  // jinak by /admin/drafts vrátilo 404. Nová (neuložená) stránka → bez tlačítek verzí.
  const heroExists = !!(row.id || row.has_draft);
  let d = {};
  if (row.has_draft && row.draft_json) { try { d = JSON.parse(row.draft_json); } catch { d = {}; } }
  const v = (f) => (d[f] != null ? d[f] : (row[f] != null ? row[f] : ''));
  detail.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 class="card-title">🎯 Hero — ${esc(row.page_key)}</h3>
        <span class="cms-state">${draftBadge(!!row.has_draft)}</span>
      </div>
      <div class="card-body">
        <div class="form-group"><label class="form-label">Hlavní nadpis</label><input class="form-input" data-f="headline" value="${esc(v('headline'))}"></div>
        <div class="form-group"><label class="form-label">Podnadpis</label><input class="form-input" data-f="subheadline" value="${esc(v('subheadline'))}"></div>
        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <div class="form-group" style="flex:1; min-width:200px;"><label class="form-label">Text tlačítka</label><input class="form-input" data-f="cta_text" value="${esc(v('cta_text'))}"></div>
          <div class="form-group" style="flex:1; min-width:200px;"><label class="form-label">Odkaz tlačítka</label><input class="form-input" data-f="cta_link" value="${esc(v('cta_link'))}" placeholder="/book"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Obrázek pozadí</label>
          <div style="display:flex; gap:.5rem; align-items:center;">
            <input class="form-input" data-f="background_image_url" value="${esc(v('background_image_url'))}" placeholder="/api/media/... nebo /assets/...">
            <input type="file" id="cms-hero-bg" accept="image/jpeg,image/png,image/webp" style="max-width:200px;">
          </div>
        </div>
        <div class="form-group"><label class="form-label">Barva překryvu</label><input class="form-input" data-f="overlay_color" value="${esc(v('overlay_color') || 'rgba(0,0,0,0.3)')}" style="width:220px;"></div>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" id="cms-hero-save">💾 Uložit koncept</button>
          <button class="btn btn-primary btn-sm" id="cms-hero-publish" ${row.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
          <button class="btn btn-ghost btn-sm" id="cms-hero-discard" ${row.has_draft ? '' : 'disabled'}>↩︎ Zahodit koncept</button>
          ${historyControlsHtml()}
          ${heroExists ? versionControlsHtml() : ''}
        </div>
      </div>
    </div>`;
  const getf = (f) => detail.querySelector(`[data-f="${f}"]`).value;
  const setf = (f, value) => {
    const el = detail.querySelector(`[data-f="${f}"]`);
    if (el) el.value = value == null ? '' : String(value);
  };
  const collectState = () => ({
    headline: getf('headline'),
    subheadline: getf('subheadline'),
    cta_text: getf('cta_text'),
    cta_link: getf('cta_link'),
    background_image_url: getf('background_image_url'),
    overlay_color: getf('overlay_color'),
  });
  const applyState = (state) => {
    setf('headline', state?.headline || '');
    setf('subheadline', state?.subheadline || '');
    setf('cta_text', state?.cta_text || '');
    setf('cta_link', state?.cta_link || '');
    setf('background_image_url', state?.background_image_url || '');
    setf('overlay_color', state?.overlay_color || '');
  };
  const history = wireEditHistory(detail.querySelector('.card'), {
    contextKey: `hero_config:${row.page_key}`,
    inputSelector: '[data-f]',
    getState: collectState,
    applyState,
    publishedState: {
      headline: row.headline || '',
      subheadline: row.subheadline || '',
      cta_text: row.cta_text || '',
      cta_link: row.cta_link || '',
      background_image_url: row.background_image_url || '',
      overlay_color: row.overlay_color || '',
    },
    resetConfirmText: 'Vrátit hero banner na zveřejněný stav?',
  });
  detail.querySelector('#cms-hero-bg').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Nahrávám pozadí…', 'info');
    const r = await api.uploadGalleryImage('hero', file);
    if (r.ok) {
      detail.querySelector('[data-f="background_image_url"]').value = r.data.image_url;
      history.capture();
      showToast('Pozadí nahráno ✓', 'success');
    }
    else showToast('Chyba: ' + r.error, 'error');
  });
  detail.querySelector('#cms-hero-save').addEventListener('click', async () => {
    const payload = { page_key: row.page_key, ...collectState() };
    const r = await api.saveHero(payload);
    showToast(r.ok ? 'Koncept uložen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) renderHeroForm(detail, { page_key: row.page_key, has_draft: 1, draft_json: JSON.stringify(payload) });
  });
  detail.querySelector('#cms-hero-publish').addEventListener('click', async () => {
    const r = await api.publishHero(row.page_key);
    showToast(r.ok ? 'Zveřejněno ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) { const x = await api.getHero(row.page_key); renderHeroForm(detail, x.ok && x.data ? x.data : { page_key: row.page_key }); }
  });
  detail.querySelector('#cms-hero-discard').addEventListener('click', async () => {
    if (!confirm('Zahodit koncept hero banneru?')) return;
    const r = await api.discardHero(row.page_key);
    showToast(r.ok ? 'Koncept zahozen ✓' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) { const x = await api.getHero(row.page_key); renderHeroForm(detail, x.ok && x.data ? x.data : { page_key: row.page_key }); }
  });
  history.clear();
  if (heroExists) {
    wireVersionControls(detail, 'hero_config', row.page_key,
      () => collectState(),
      async () => { const x = await api.getHero(row.page_key); renderHeroForm(detail, x.ok && x.data ? x.data : { page_key: row.page_key }); });
  }
}

// ─── HISTORIE ─────────────────────────────────────────────────

/** Vykreslí záložku Historie změn (audit_log CMS entit). @param {HTMLElement} body */
async function renderHistorie(body) {
  const { api } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }
  const res = await api.getContentHistory();
  const rows = res.ok ? (res.data?.history || []) : [];
  const label = { content_blocks: 'Text', gallery_items: 'Galerie', hero_config: 'Hero', services: 'Služba' };
  body.innerHTML = `
    <div class="card">
      <div class="card-header"><h3 class="card-title">🕓 Historie změn obsahu</h3></div>
      <div class="card-body" style="overflow-x:auto;">
        ${rows.length ? `
        <table class="table" style="width:100%;">
          <thead><tr><th>Kdy</th><th>Oblast</th><th>Akce</th><th>Popis</th><th>Kdo</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td style="white-space:nowrap;">${fmtDate(r.created_at)}</td>
                <td>${esc(label[r.entity] || r.entity)}</td>
                <td>${esc(r.action)}</td>
                <td>${esc(r.details)}</td>
                <td>${esc((r.actor || '').replace('operator:', ''))}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : emptyCard('Zatím žádné zaznamenané změny.')}
      </div>
    </div>`;
}

// ─── SLUŽBY (services, draft/publish) ─────────────────────────

const SVC_CATEGORIES = ['imunita', 'energie', 'bolest', 'psychika', 'hormony', 'metabolismus', 'organy', 'patogeny', 'prostredi', 'onkologie', 'prevence'];
const SVC_SEGMENTS = ['vsichni', 'zeny', 'deti', 'profesionalove', 'biohackeri'];

/** Vykreslí záložku Služby (tabulka + tlačítko nová). @param {HTMLElement} body */
async function renderSluzby(body) {
  const { api, showToast } = _ctx;
  if (!api) { body.innerHTML = demoNote(); return; }
  const res = await api.getServicesAdmin();
  const rows = res.ok ? (res.data?.services || []) : [];
  body.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 class="card-title" style="margin:0;">⚙️ Služby / programy</h3>
        <button class="btn btn-primary btn-sm" id="svc-new">➕ Nová služba</button>
      </div>
      <div class="card-body" style="overflow-x:auto;">
        ${rows.length ? `
        <table class="table" style="width:100%;">
          <thead><tr><th>Název</th><th>Kategorie</th><th>Cena</th><th>Stav</th><th></th></tr></thead>
          <tbody>
            ${rows.map((s) => `
              <tr data-slug="${esc(s.slug)}">
                <td>${esc(s.name)}${s.active ? '' : ' <span class="badge badge-cancelled">skrytá</span>'}</td>
                <td>${esc(s.category || '—')}</td>
                <td>${s.price_avg != null ? esc(s.price_avg) + ' Kč' : '—'}</td>
                <td>${draftBadge(!!s.has_draft)}</td>
                <td><button class="btn btn-secondary btn-sm" data-action="edit">✍️ Upravit</button></td>
              </tr>`).join('')}
          </tbody>
        </table>` : emptyCard('Žádné služby.')}
      </div>
    </div>`;
  body.querySelector('#svc-new')?.addEventListener('click', () => openServiceModal(body, null));
  body.querySelectorAll('tr[data-slug] [data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => openServiceModal(body, btn.closest('tr').dataset.slug));
  });
}

/** Otevře modal editor služby. @param {HTMLElement} body @param {string|null} slug */
async function openServiceModal(body, slug) {
  const { api, showToast } = _ctx;
  let row = {};
  const isNew = !slug;
  if (!isNew) {
    const r = await api.getServiceAdmin(slug);
    if (!r.ok) { showToast('Nepodařilo se načíst službu.', 'error'); return; }
    row = r.data;
  }
  let d = {};
  if (row.has_draft && row.draft_json) { try { d = JSON.parse(row.draft_json); } catch { d = {}; } }
  const v = (f) => (d[f] != null ? d[f] : (row[f] != null ? row[f] : ''));

  const formHtml = `
    <div class="modal-body" style="display:grid; gap:.75rem;">
      ${isNew ? `<div class="form-group"><label class="form-label">Slug (URL identifikátor)</label><input class="form-input" data-f="slug" placeholder="napr. nova-sluzba"></div>` : ''}
      <div class="form-group"><label class="form-label">Název *</label><input class="form-input" data-f="name" value="${esc(v('name'))}"></div>
      <div style="display:flex; gap:.75rem; flex-wrap:wrap;">
        <div class="form-group" style="flex:1; min-width:160px;"><label class="form-label">Kategorie</label>
          <select class="form-select" data-f="category">${SVC_CATEGORIES.map((c) => `<option value="${c}" ${v('category') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="form-group" style="flex:1; min-width:160px;"><label class="form-label">Segment</label>
          <select class="form-select" data-f="segment">${SVC_SEGMENTS.map((c) => `<option value="${c}" ${v('segment') === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label class="form-label">Krátký popis</label><textarea class="form-input" data-f="short_desc" rows="2">${esc(v('short_desc'))}</textarea></div>
      <div class="form-group"><label class="form-label">Dlouhý popis</label><textarea class="form-input" data-f="long_desc" rows="4">${esc(v('long_desc'))}</textarea></div>
      <div style="display:flex; gap:.75rem; flex-wrap:wrap;">
        <div class="form-group" style="flex:1; min-width:120px;"><label class="form-label">Cena (Kč)</label><input type="number" class="form-input" data-f="price_avg" value="${esc(v('price_avg'))}"></div>
        <div class="form-group" style="flex:1; min-width:120px;"><label class="form-label">Počet sezení</label><input class="form-input" data-f="sessions_typ" value="${esc(v('sessions_typ'))}"></div>
        <div class="form-group" style="flex:1; min-width:120px;"><label class="form-label">Pořadí</label><input type="number" class="form-input" data-f="sort_order" value="${esc(v('sort_order') || 0)}"></div>
      </div>
      <div class="form-group"><label class="form-label">Poznámka k ceně</label><input class="form-input" data-f="price_note" value="${esc(v('price_note'))}"></div>
      <div class="form-group"><label class="form-label">Ikona (cesta)</label><input class="form-input" data-f="icon_url" value="${esc(v('icon_url'))}" placeholder="/assets/img/icons/icon-...webp"></div>
      <div class="form-group flex items-center" style="gap:.5rem;"><label class="toggle"><input type="checkbox" data-f="active" ${(v('active') ?? 1) ? 'checked' : ''}><span class="toggle-slider"></span></label><span>Zobrazit na webu</span></div>
    </div>`;

  const footer = isNew
    ? `<button class="btn btn-primary" data-m="create">Vytvořit</button>`
    : `<button class="btn btn-secondary" data-m="save">💾 Uložit koncept</button>
       <button class="btn btn-primary" data-m="publish" ${row.has_draft ? '' : 'disabled'}>✅ Zveřejnit</button>
       <button class="btn btn-ghost" data-m="discard" ${row.has_draft ? '' : 'disabled'}>↩︎ Zahodit</button>
       <button class="btn btn-ghost" data-m="save-version" title="Uložit jako verzi">🏷️ Uložit verzi</button>
       <button class="btn btn-ghost" data-m="versions" title="Verze konceptu">🗂️ Verze</button>
       <button class="btn btn-danger" data-m="delete" style="margin-left:auto;">🗑️ Smazat</button>`;

  showModal(`
    <div class="modal" style="max-width:680px; width:95%;">
      <div class="modal-header"><h3 class="card-title">${isNew ? 'Nová služba' : 'Služba — ' + esc(slug)} ${row.has_draft ? draftBadge(true) : ''}</h3>
        <button class="btn-icon" data-m="close">✕</button></div>
      ${formHtml}
      <div class="modal-footer" style="display:flex; gap:.5rem; flex-wrap:wrap;">${footer}</div>
    </div>`, (overlay, close) => {
    const gf = (f) => { const el = overlay.querySelector(`[data-f="${f}"]`); return el ? (el.type === 'checkbox' ? (el.checked ? 1 : 0) : el.value) : undefined; };
    const payload = () => ({ slug: isNew ? (gf('slug') || '').trim().toLowerCase() : slug, name: gf('name'), category: gf('category'), segment: gf('segment'), short_desc: gf('short_desc'), long_desc: gf('long_desc'), price_avg: gf('price_avg'), price_note: gf('price_note'), sessions_typ: gf('sessions_typ'), icon_url: gf('icon_url'), sort_order: gf('sort_order'), active: gf('active') });
    const after = (r, msg) => { if (r.ok) { showToast(msg, 'success'); close(); renderSluzby(body); } else showToast('Chyba: ' + r.error, 'error'); };
    overlay.querySelector('[data-m="close"]').addEventListener('click', close);
    overlay.querySelector('[data-m="create"]')?.addEventListener('click', async () => after(await api.createService(payload()), 'Služba vytvořena ✓'));
    overlay.querySelector('[data-m="save"]')?.addEventListener('click', async () => after(await api.saveServiceDraft(payload()), 'Koncept uložen ✓'));
    overlay.querySelector('[data-m="publish"]')?.addEventListener('click', async () => after(await api.publishService(slug), 'Zveřejněno ✓'));
    overlay.querySelector('[data-m="discard"]')?.addEventListener('click', async () => after(await api.discardService(slug), 'Koncept zahozen ✓'));
    overlay.querySelector('[data-m="delete"]')?.addEventListener('click', async () => { if (confirm('Opravdu smazat tuto službu?')) after(await api.deleteService(slug), 'Smazáno ✓'); });
    overlay.querySelector('[data-m="save-version"]')?.addEventListener('click', async () => {
      const name = (prompt('Název verze (např. „Vánoční nabídka"):') || '').trim();
      if (!name) return;
      const r = await api.saveDraftVersion('services', slug, name, payload());
      showToast(r.ok ? `Verze „${name}" uložena ✓` : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    });
    overlay.querySelector('[data-m="versions"]')?.addEventListener('click', () => { close(); openVersionsModal('services', slug, () => openServiceModal(body, slug)); });
  });
}

/** Jednoduchý modal helper (vzor blog.js). @param {string} html @param {Function} onMount */
function showModal(html, onMount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  if (onMount) onMount(overlay, close);
}

// ─── HELPERS ──────────────────────────────────────────────────

/** Prázdný stav. @param {string} text @returns {string} */
function emptyCard(text) {
  return `<div class="empty-state" style="padding:2rem; text-align:center; color:var(--c-sage,#738A75);">${esc(text)}</div>`;
}
/** Demo režim. @returns {string} */
function demoNote() {
  return `<div class="card"><div class="card-body">Demo režim — API není dostupné. Po přihlášení uvidíte reálný obsah.</div></div>`;
}

/** Lifecycle cleanup. */
export function destroy() { _ctx = null; }
