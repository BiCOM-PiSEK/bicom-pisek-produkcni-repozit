/**
 * BICOM PÍSEK — Blog & AI Copywriter Module
 */

import { renderMarkdown } from '/assets/js/markdown.js';

export async function render(container, ctx) {
  const { api, showToast } = ctx;
  container.innerHTML = renderSkeleton();

  let drafts = getDemoDrafts();
  if (api) {
    const res = await api.getBookings({ limit: 0 }); // placeholder
    // TODO: GET /admin/blog endpoint
  }

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Blog & AI Copywriter</h1>
      <p class="canvas-subtitle">Generujte obsah pomocí AI, schvalujte a publikujte</p>
    </div>

    <div class="grid-2 gap-6">
      <!-- AI Generátor -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">🤖 Nový článek</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Téma nebo klíčová slova</label>
            <textarea class="form-textarea" id="ai-prompt" rows="3" placeholder="Např. 'Jak biorezonance pomáhá při jarních alergiích'"></textarea>
            <p class="form-hint">AI vytvoří článek v tónu Quiet Luxury s právním filtrem</p>
          </div>
          <div class="form-group">
            <label class="form-label">Typ obsahu</label>
            <select class="form-select" id="ai-type">
              <option value="blog">Blog článek</option>
              <option value="social">Social media post</option>
              <option value="newsletter">Newsletter</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Služba (kontext)</label>
            <select class="form-select" id="ai-service">
              <option value="">Obecné</option>
              <option value="imunita-a-obranyschopnost">Imunita a obranyschopnost</option>
              <option value="energie-a-vitalita">Energie a vitalita</option>
              <option value="bolest-a-pohybovy-aparat">Bolest a pohybový aparát</option>
              <option value="psychika-a-emocni-rovnovaha">Psychika a emoční rovnováha</option>
              <option value="hormonalni-system">Hormonální systém</option>
              <option value="metabolismus">Metabolismus</option>
              <option value="organy-a-detoxikace">Orgány a detoxikace</option>
              <option value="patogeny">Patogeny</option>
              <option value="prostredi-a-zateze">Prostředí a zátěže</option>
              <option value="podpora-pri-onkologii">Podpora při onkologii</option>
              <option value="prevence-a-rekonvalescence">Prevence a rekonvalescence</option>
            </select>
          </div>
          <button class="btn btn-champagne" id="btn-generate">✨ Generovat</button>
          <div id="ai-result" class="mt-4" style="display:none;"></div>
        </div>
      </div>

      <!-- Drafty -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📝 Rozpracované články</h3>
          <span class="badge badge-ai">${drafts.length} drafts</span>
        </div>
        <div class="card-body">
          ${drafts.map((d) => `
            <div class="card mb-4" style="border: 1px solid var(--c-sage-light);">
              <h4 style="font-family: var(--font-head); font-size: var(--text-md); color: var(--c-forest); margin-bottom: var(--sp-2);">${esc(d.title)}</h4>
              <p style="font-size: var(--text-sm); color: var(--c-sage); margin-bottom: var(--sp-3);">${esc(d.excerpt)}</p>
              <div class="flex gap-4">
                <button class="btn btn-primary btn-sm">Publikovat</button>
                <button class="btn btn-ghost btn-sm">Upravit</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  // Generate button
  const genBtn = container.querySelector('#btn-generate');
  genBtn?.addEventListener('click', async () => {
    const prompt = container.querySelector('#ai-prompt')?.value;
    const type = container.querySelector('#ai-type')?.value;
    const service = container.querySelector('#ai-service')?.value;

    if (!prompt?.trim()) { showToast('Zadejte téma', 'warning'); return; }

    genBtn.disabled = true;
    genBtn.textContent = '⏳ Generuji…';
    const resultEl = container.querySelector('#ai-result');

    if (api) {
      const res = await api.generateContent({ prompt, type, service });
      if (res.ok && res.data) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `<div class="card" style="border-left: 3px solid var(--c-champagne);"><h4 style="font-family: var(--font-head); color: var(--c-forest); margin-bottom: var(--sp-2);">${esc(res.data.title || 'Návrh')}</h4><div style="font-size: var(--text-sm);">${renderMarkdown(res.data.content)}</div></div>`;
        showToast('Článek vygenerován ✓', 'success');
      } else {
        showToast('Chyba: ' + (res.error || 'Nepodařilo se'), 'error');
      }
    } else {
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<div class="card" style="border-left: 3px solid var(--c-champagne);"><h4 style="font-family: var(--font-head); color: var(--c-forest);">Demo: Jak biorezonance podporuje imunitu</h4><p style="font-size: var(--text-sm);">Biorezonanční metoda BICOM pomáhá posilovat přirozenou obranyschopnost organismu...</p></div>';
      showToast('Demo režim — ukázkový obsah', 'info');
    }
    genBtn.disabled = false;
    genBtn.textContent = '✨ Generovat';
  });
}

export function destroy() {}

function renderSkeleton() {
  return '<div class="canvas-header"><div class="skeleton" style="width:250px;height:32px;"></div></div><div class="grid-2 gap-6"><div class="card"><div class="skeleton" style="width:100%;height:350px;"></div></div><div class="card"><div class="skeleton" style="width:100%;height:350px;"></div></div></div>';
}

function getDemoDrafts() {
  return [
    { id: '1', title: 'Jarní alergie a biorezonance', excerpt: 'Pylová sezóna přichází — jak může biorezonanční metoda podpořit váš organismus…', status: 'draft' },
    { id: '2', title: '5 tipů pro silnější imunitu', excerpt: 'Jednoduchá opatření, která můžete kombinovat s biorezonanční terapií…', status: 'draft' },
  ];
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
