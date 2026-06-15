/**
 * BICOM PÍSEK — GEO-Marketing Module
 * Zobrazuje POUZE reálná data z /admin/geo (geo_leads). Žádná demo/mock data —
 * dokud nejsou poptávky, ukazuje poctivý prázdný stav.
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;

  container.innerHTML = renderShell(renderLoading());

  let geoData = null;
  let hasError = false;

  if (api) {
    const res = await api.getGeoAnalytics();
    if (res.ok && res.data) {
      geoData = res.data;
    } else {
      hasError = true;
      if (showToast) showToast('Nepodařilo se načíst GEO data: ' + (res.error || 'neznámá chyba'), 'error');
    }
  }

  if (hasError) {
    container.innerHTML = renderShell(renderEmpty('⚠️', 'Data se nepodařilo načíst', 'Zkuste to prosím znovu.'));
    attachRefresh(container, ctx);
    return;
  }

  const cities = geoData?.cities || [];
  const topServices = geoData?.topServices || [];
  const insights = geoData?.insights || [];
  const totalLeads = geoData?.totalLeads || 0;

  const badge = totalLeads > 0
    ? `<span class="badge badge-confirmed">${totalLeads} poptávek</span>`
    : `<span class="badge badge-pending">Zatím bez dat</span>`;

  const maxCount = Math.max(...cities.map((c) => c.count), 1);

  const citiesHtml = cities.length > 0
    ? cities.map((c) => {
        const pct = Math.round((c.count / maxCount) * 100);
        return `<div class="geo-bar-item">
          <div class="flex justify-between items-center mb-2">
            <span style="font-size:var(--text-sm);font-weight:500;">${esc(c.name)}</span>
            <span style="font-size:var(--text-xs);color:var(--c-sage);">${c.count} poptávek</span>
          </div>
          <div class="geo-bar"><div class="geo-bar-fill" style="width:${pct}%;"></div></div>
        </div>`;
      }).join('')
    : renderEmpty('📍', 'Zatím žádné poptávky', 'Data se začnou zobrazovat, jakmile web naběhne a přijdou první poptávky.');

  const servicesHtml = topServices.length > 0
    ? `<div style="margin-top:var(--sp-4);">
        <p style="font-size:var(--text-xs);text-transform:uppercase;color:var(--c-sage);font-weight:600;margin-bottom:var(--sp-2);">Nejžádanější služby</p>
        ${topServices.map((s) => `<div class="flex justify-between items-center" style="padding:var(--sp-1) 0;">
          <span style="font-size:var(--text-sm);">${esc(s.service)}</span>
          <span style="font-size:var(--text-xs);color:var(--c-sage);">${s.count}×</span>
        </div>`).join('')}
      </div>`
    : '';

  const insightsHtml = insights.length > 0
    ? insights.map((r) => `
        <div class="card mb-4" style="border-left: 3px solid var(--c-champagne); padding: var(--sp-3) var(--sp-4);">
          <p style="font-size:var(--text-sm);font-weight:500;margin-bottom:var(--sp-1);">${esc(r.title)}</p>
          <p style="font-size:var(--text-xs);color:var(--c-sage);">${esc(r.description)}</p>
        </div>`).join('')
    : renderEmpty('💡', 'Žádné postřehy', 'Souhrn se vytvoří, jakmile budou k dispozici poptávky.');

  container.innerHTML = renderShell(`
    <div class="grid-2 gap-6">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📍 Rozložení poptávek</h3>
          ${badge}
        </div>
        <div class="card-body">
          ${citiesHtml}
          ${servicesHtml}
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">💡 Postřehy z dat</h3>
        </div>
        <div class="card-body">
          ${insightsHtml}
          <button class="btn btn-secondary btn-sm mt-4" data-action="geo-refresh">🔄 Obnovit</button>
        </div>
      </div>
    </div>
  `);

  attachRefresh(container, ctx);
}

export function destroy() {}

/**
 * Wraps module content with the canvas header.
 * @param {string} inner - Inner HTML
 * @returns {string}
 */
function renderShell(inner) {
  return `
    <div class="canvas-header">
      <h1 class="canvas-title">GEO-Marketing</h1>
      <p class="canvas-subtitle">Odkud přicházejí poptávky — analytika z reálných dat</p>
    </div>
    ${inner}
  `;
}

function renderLoading() {
  return '<div class="card"><div class="skeleton" style="width:100%;height:240px;"></div></div>';
}

/**
 * Renders a centered empty/placeholder state.
 * @param {string} icon
 * @param {string} title
 * @param {string} text
 * @returns {string}
 */
function renderEmpty(icon, title, text) {
  return `<div class="empty-state" style="padding: var(--sp-6) var(--sp-4); text-align:center;">
    <div style="font-size:2rem;margin-bottom:var(--sp-2);">${icon}</div>
    <h4 class="empty-state-title">${esc(title)}</h4>
    <p class="empty-state-text">${esc(text)}</p>
  </div>`;
}

/**
 * Attaches the real "Obnovit" handler — re-fetches and re-renders the module.
 * @param {Element} container
 * @param {Object} ctx
 */
function attachRefresh(container, ctx) {
  const btn = container.querySelector('[data-action="geo-refresh"]');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Načítám…';
      render(container, ctx);
    });
  }
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
