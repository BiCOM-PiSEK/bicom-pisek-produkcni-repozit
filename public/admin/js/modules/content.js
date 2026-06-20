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

/** Escapuje text pro bezpečné vložení do HTML. @param {*} str @returns {string} */
function esc(str) {
  const el = document.createElement('span');
  el.textContent = str == null ? '' : String(str);
  return el.innerHTML;
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
          <button class="btn btn-secondary btn-sm" id="cms-preview-refresh" title="Obnovit náhled">↻</button>
          <a class="btn btn-ghost btn-sm" href="${live}" target="_blank" rel="noopener" title="Zobrazit živý web">web ↗</a>
        </div>
      </div>
      <div style="border:1px solid rgba(115,138,117,0.2); border-radius:12px; overflow:hidden; background:#fff;">
        <iframe id="cms-preview-frame" src="${src}" title="Náhled webu"
          style="width:100%; height:70vh; border:0; display:block;"></iframe>
      </div>
      <p class="form-hint" style="margin-top:.5rem;">Náhled ukazuje i neuložené koncepty. Po „Uložit koncept" klikněte na ↻.</p>
    </div>`;
}

/** Obnoví náhledový iframe. @param {HTMLElement} root */
function refreshPreview(root) {
  const f = root.querySelector('#cms-preview-frame');
  if (f) f.contentWindow.location.reload();
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
  body.querySelector('#cms-preview-refresh')?.addEventListener('click', () => refreshPreview(body));
  sections.forEach((s) => wireSectionCard(body, s.section_key));
  cards.forEach((c) => wireCardGroup(body, c.section_key));
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
function wireCardGroup(root, key) {
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
  rowsWrap.addEventListener('click', (e) => {
    const del = e.target.closest('[data-action="del-row"]');
    if (del) { del.closest('.cms-card-row').remove(); renumber(); }
  });
  card.querySelector('[data-action="add-row"]').addEventListener('click', () => {
    rowsWrap.insertAdjacentHTML('beforeend', cardRow({ title: '', text: '' }, rowsWrap.children.length));
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
        </div>
      </div>
    </div>`;
}

/** Naváže akce (uložit koncept / zveřejnit / zahodit) na kartu sekce. @param {HTMLElement} root @param {string} key */
function wireSectionCard(root, key) {
  const { api, showToast } = _ctx;
  const card = root.querySelector(`.cms-section-card[data-key="${CSS.escape(key)}"]`);
  if (!card) return;
  const val = (f) => card.querySelector(`[data-field="${f}"]`).value;
  const setBadge = (hasDraft) => {
    card.querySelector('.cms-state').innerHTML = draftBadge(hasDraft);
    card.querySelector('[data-action="publish"]').disabled = !hasDraft;
    card.querySelector('[data-action="discard"]').disabled = !hasDraft;
  };

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
          </div>
        </div>
      </div>
      ${previewPaneHtml()}
    </div>`;

  body.querySelector('#cms-preview-refresh')?.addEventListener('click', () => refreshPreview(body));
  const collect = () => {
    const out = {};
    body.querySelectorAll('[data-nap]').forEach((el) => { out[el.getAttribute('data-nap')] = el.value; });
    return out;
  };
  body.querySelector('#nap-save').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: 'site-nap', title: 'Kontaktní údaje a patička (NAP)', content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) refreshPreview(body);
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
          </div>
        </div>
      </div>
      ${previewPaneHtml('biorezonance-pisek.html')}
    </div>`;

  const rowsWrap = body.querySelector('.faq-rows');
  body.querySelector('#cms-preview-refresh')?.addEventListener('click', () => refreshPreview(body));
  const collect = () => Array.from(rowsWrap.querySelectorAll('.faq-row')).map((r) => ({
    q: r.querySelector('[data-faq="q"]').value, a: r.querySelector('[data-faq="a"]').value,
  }));
  rowsWrap.addEventListener('click', (e) => {
    const del = e.target.closest('[data-action="del-row"]');
    if (del) del.closest('.faq-row').remove();
  });
  body.querySelector('[data-action="add-row"]').addEventListener('click', () => {
    rowsWrap.insertAdjacentHTML('beforeend', faqRow({ q: '', a: '' }));
  });
  body.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: 'faq-main', title: 'FAQ (sdílené)', content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) refreshPreview(body);
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
      <div class="card">
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
          </div>
        </div>
      </div>
      ${previewPaneHtml(previewPage)}
    </div>`;
  host.querySelector('#cms-preview-refresh')?.addEventListener('click', () => refreshPreview(host));
  const collect = () => {
    const out = {};
    host.querySelectorAll('[data-cfg]').forEach((el) => { out[el.getAttribute('data-cfg')] = el.value; });
    return out;
  };
  host.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const r = await api.updateContentSection({ section_key: sectionKey, title: titleLabel, content_markdown: JSON.stringify(collect()), content_type: 'config' });
    showToast(r.ok ? 'Koncept uložen ✓ — obnovte náhled (↻)' : 'Chyba: ' + r.error, r.ok ? 'success' : 'error');
    if (r.ok) refreshPreview(host);
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
}

// ─── GALERIE (okamžitá publikace) ─────────────────────────────

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
  detail.innerHTML = `
    <div class="card mb-6">
      <div class="card-header"><h3 class="card-title">🖼️ Galerie „${esc(galleryKey)}"</h3></div>
      <div class="card-body">
        <div class="form-group">
          <label class="form-label">Nahrát obrázek</label>
          <input type="file" class="form-input" id="cms-upload" accept="image/jpeg,image/png,image/webp,image/gif" multiple>
          <p class="form-hint">Max 5 MB na soubor. Galerie se publikují okamžitě (bez konceptu).</p>
          <div id="cms-upload-progress" class="form-hint" style="margin-top:.5rem;"></div>
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
    showToast(failed === 0 ? `Nahráno: ${ok} ✓` : `Nahráno ${ok}, selhalo ${failed}`, failed === 0 ? 'success' : 'warning');
    renderGalleryDetail(detail, galleryKey);
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
    const r = await api.updateGalleryItem({ id, caption: card.querySelector('[data-field="caption"]').value });
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
        </div>
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
    const payload = { page_key: row.page_key, headline: getf('headline'), subheadline: getf('subheadline'), cta_text: getf('cta_text'), cta_link: getf('cta_link'), background_image_url: getf('background_image_url'), overlay_color: getf('overlay_color') };
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
