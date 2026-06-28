/**
 * BICOM PÍSEK — AI Studio
 * Vizuální generace, asset library a approval workflow.
 */

const KIND_LABELS = {
  article_cover: 'Article cover 16:9',
  social_post: 'Social post 1:1',
  social_story: 'Story 9:16',
  social_carousel: 'Carousel slide',
  web_banner: 'Web banner',
};

export async function render(container, ctx) {
  const { api, showToast, navigate } = ctx;
  container.innerHTML = renderSkeleton();

  let assets = [];
  let jobs = [];
  let filter = { status: 'draft', kind: '' };
  let jobStatusFilter = '';
  let settings = {};

  await Promise.all([
    loadAssets(),
    loadJobs(),
    loadSettings(),
  ]);

  renderMain();

  async function loadAssets() {
    if (!api?.getAiAssets) return;
    const res = await api.getAiAssets({ status: filter.status, kind: filter.kind, limit: 24 });
    if (res.ok && res.data?.assets) {
      assets = res.data.assets;
    } else {
      showToast('Nepodařilo se načíst AI assety: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  }

  async function loadSettings() {
    if (!api?.getSettings) return;
    const res = await api.getSettings();
    if (res.ok && res.data?.settings) {
      for (const [k, v] of Object.entries(res.data.settings)) {
        settings[k] = v.value;
      }
    }
  }

  async function loadJobs() {
    if (!api?.getAiJobs) return;
    const params = { limit: 15 };
    if (jobStatusFilter) params.status = jobStatusFilter;
    const res = await api.getAiJobs(params);
    if (res.ok && res.data?.jobs) {
      jobs = res.data.jobs;
    } else {
      showToast('Nepodařilo se načíst AI joby: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  }

  function renderMain() {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">AI Studio</h1>
        <p class="canvas-subtitle">Vizuály, texty a schvalování v jednom řízeném toku</p>
      </div>

      <div class="grid-2 gap-6" style="grid-template-columns: 1.1fr 0.9fr; align-items: start;">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🎨 Generování vizuálu</h3>
            <span class="badge badge-new">F3</span>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Typ výstupu</label>
              <select class="form-select" id="studio-kind">
                ${kindOption('article_cover')}
                ${kindOption('social_post')}
                ${kindOption('social_story')}
                ${kindOption('social_carousel')}
                ${kindOption('web_banner')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Creative brief</label>
              <textarea class="form-textarea" id="studio-brief" rows="6" placeholder="Popište výstup, vizuální styl, kontext služby, účel a tón brandu."></textarea>
              <p class="form-hint">Např. banner pro jarní regeneraci, elegantní wellness motiv, žádné klinické prvky.</p>
            </div>
            <div class="grid-2 gap-4" style="grid-template-columns: 1fr 1fr;">
              <div class="form-group">
                <label class="form-label">Text v obrázku</label>
                <input class="form-input" id="studio-overlay-text" placeholder="Hlavní claim / nadpis">
              </div>
              <div class="form-group">
                <label class="form-label">Podtitulek</label>
                <input class="form-input" id="studio-overlay-subline" placeholder="Volitelný doplňkový text">
              </div>
            </div>
            <div class="flex gap-3" style="flex-wrap: wrap;">
              <button class="btn btn-champagne" id="btn-generate-visual">✨ Generovat vizuál</button>
              <button class="btn btn-ghost" id="btn-open-settings">Nastavení promptů</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">⚙️ Prompt governance</h3>
          </div>
          <div class="card-body">
            <div class="system-grid" style="grid-template-columns: 1fr 1fr;">
              <div class="card" style="padding: var(--sp-4);">
                <div class="kpi-label">Prompt profil</div>
                <div class="kpi-value" style="font-size: 1.1rem;">${esc(settings.ai_studio_prompt_profile || 'default')}</div>
              </div>
              <div class="card" style="padding: var(--sp-4);">
                <div class="kpi-label">Prompty</div>
                <div class="kpi-value" style="font-size: 1.1rem;">${settings.ai_studio_prompts_enabled === '0' ? 'Vypnuto' : 'Zapnuto'}</div>
              </div>
              <div class="card" style="padding: var(--sp-4);">
                <div class="kpi-label">Chat budget</div>
                <div class="kpi-value" style="font-size: 1.1rem;">${esc(settings.ai_studio_chat_max_sentences || '4')} věty</div>
              </div>
              <div class="card" style="padding: var(--sp-4);">
                <div class="kpi-label">Denní cap obrázků</div>
                <div class="kpi-value" style="font-size: 1.1rem;">${esc(settings.ai_studio_daily_image_cap || '50')}</div>
              </div>
            </div>
            <div class="mt-4">
              <p class="form-hint" style="margin-bottom: var(--sp-3);">System prompty a limity se spravují centrálně v Nastavení, takže Studio drží koncepci i provozní přepínače pohromadě.</p>
              <button class="btn btn-ghost btn-sm" id="btn-go-settings">Otevřít Nastavení</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card mt-6">
        <div class="card-header flex justify-between items-center">
          <h3 class="card-title">🖼️ Asset knihovna</h3>
          <div class="flex gap-2" style="flex-wrap: wrap;">
            ${filterChip('draft', 'Koncepty')}
            ${filterChip('approved', 'Schválené')}
            ${filterChip('archived', 'Archiv')}
            ${filterChip('', 'Vše')}
          </div>
        </div>
        <div class="card-body">
          <div class="flex gap-2 mb-4" style="flex-wrap: wrap;">
            ${kindFilterChip('', 'Všechny typy')}
            ${kindFilterChip('article_cover', 'Cover')}
            ${kindFilterChip('social_post', 'Post')}
            ${kindFilterChip('social_story', 'Story')}
            ${kindFilterChip('social_carousel', 'Carousel')}
            ${kindFilterChip('web_banner', 'Banner')}
          </div>
          <div id="studio-assets-container"></div>
        </div>
      </div>

      <div class="card mt-6">
        <div class="card-header flex justify-between items-center">
          <h3 class="card-title">🧠 Job konzole</h3>
          <div class="flex gap-2" style="flex-wrap: wrap;">
            ${jobFilterChip('', 'Vše')}
            ${jobFilterChip('running', 'Běží')}
            ${jobFilterChip('succeeded', 'Dokončeno')}
            ${jobFilterChip('failed', 'Selhalo')}
          </div>
        </div>
        <div class="card-body" id="studio-jobs-container"></div>
      </div>
    `;

    bindEvents();
    renderAssets();
    renderJobs();
  }

  function bindEvents() {
    container.querySelector('#btn-generate-visual')?.addEventListener('click', onGenerate);
    container.querySelector('#btn-open-settings')?.addEventListener('click', () => navigate('/nastaveni'));
    container.querySelector('#btn-go-settings')?.addEventListener('click', () => navigate('/nastaveni'));

    container.querySelectorAll('[data-filter-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        filter.status = btn.dataset.filterStatus;
        await loadAssets();
        renderMain();
      });
    });

    container.querySelectorAll('[data-filter-kind]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        filter.kind = btn.dataset.filterKind;
        await loadAssets();
        renderMain();
      });
    });

    container.querySelectorAll('[data-job-filter-status]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        jobStatusFilter = btn.dataset.jobFilterStatus;
        await loadJobs();
        renderMain();
      });
    });
  }

  async function onGenerate() {
    if (!api?.generateAiVisual) {
      showToast('AI Studio API není dostupné.', 'error');
      return;
    }

    const kind = container.querySelector('#studio-kind')?.value;
    const brief = container.querySelector('#studio-brief')?.value || '';
    const overlay_text = container.querySelector('#studio-overlay-text')?.value || '';
    const overlay_subline = container.querySelector('#studio-overlay-subline')?.value || '';

    if (!brief.trim()) {
      showToast('Vyplňte creative brief.', 'warning');
      return;
    }

    const btn = container.querySelector('#btn-generate-visual');
    btn.disabled = true;
    btn.textContent = '⏳ Generuji...';

    try {
      const res = await api.generateAiVisual({
        kind,
        brief,
        overlay_text,
        overlay_subline,
      });

      if (res.ok && res.data) {
        showToast('Vizuál vygenerován ✓', 'success');
        container.querySelector('#studio-brief').value = '';
        container.querySelector('#studio-overlay-text').value = '';
        container.querySelector('#studio-overlay-subline').value = '';
        await Promise.all([loadAssets(), loadJobs()]);
        renderMain();
      } else {
        showToast('Generování selhalo: ' + (res.error || 'Neznámá chyba'), 'error');
      }
    } catch (err) {
      showToast('Chyba: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Generovat vizuál';
    }
  }

  function renderAssets() {
    const wrap = container.querySelector('#studio-assets-container');
    if (!wrap) return;
    if (!assets.length) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding: var(--sp-8) 0;">
          <h4 class="empty-state-title">Zatím žádné assety</h4>
          <p class="empty-state-text">Vygenerujte první vizuál — objeví se zde s náhledem, modelem a stavem.</p>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <div class="grid-2 gap-4" style="grid-template-columns: 1fr 1fr;">
        ${assets.map(renderAssetCard).join('')}
      </div>
    `;

    wrap.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const status = btn.dataset.action;
        if (!id || !status) return;
        const res = await api.updateAiAsset({ id, status });
        if (res.ok) {
          showToast('Asset aktualizován ✓', 'success');
          await Promise.all([loadAssets(), loadJobs()]);
          renderMain();
        } else {
          showToast('Aktualizace selhala: ' + (res.error || 'Neznámá chyba'), 'error');
        }
      });
    });
  }

  function renderJobs() {
    const wrap = container.querySelector('#studio-jobs-container');
    if (!wrap) return;
    if (!jobs.length) {
      wrap.innerHTML = `
        <div class="empty-state" style="padding: var(--sp-6) 0;">
          <h4 class="empty-state-title">Zatím žádné joby</h4>
          <p class="empty-state-text">Po prvním generování zde uvidíte historii běhů a případné chyby.</p>
        </div>`;
      return;
    }

    const rows = jobs.map((job) => {
      const payload = safeParse(job.payload_json);
      const result = safeParse(job.result_json);
      const kind = payload?.kind || result?.kind || '-';
      const brief = payload?.brief || '';
      const canRetry = job.status === 'failed';
      return `
        <tr>
          <td><span class="badge badge-ai">${esc(job.status || '-')}</span></td>
          <td>${esc(KIND_LABELS[kind] || kind)}</td>
          <td style="max-width: 360px;">
            <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escAttr(brief)}">${esc(brief)}</div>
          </td>
          <td>${esc(job.provider || '-')} · ${esc(job.model || '-')}</td>
          <td>${formatTime(job.created_at)}</td>
          <td>
            ${canRetry ? `<button class="btn btn-ghost btn-sm" data-retry-job-id="${escAttr(job.id)}">Retry</button>` : ''}
          </td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Typ</th>
              <th>Brief</th>
              <th>Provider</th>
              <th>Čas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;

    wrap.querySelectorAll('[data-retry-job-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!api?.retryAiJob) {
          showToast('Retry API není dostupné.', 'error');
          return;
        }
        const jobId = btn.dataset.retryJobId;
        if (!jobId) return;
        btn.disabled = true;
        const res = await api.retryAiJob(jobId);
        if (res.ok) {
          showToast('Retry spuštěn ✓', 'success');
          await Promise.all([loadAssets(), loadJobs()]);
          renderMain();
        } else {
          showToast('Retry selhal: ' + (res.error || 'Neznámá chyba'), 'error');
          btn.disabled = false;
        }
      });
    });
  }

  function renderAssetCard(asset) {
    const preview = asset.overlay_svg_url || asset.image_url;
    return `
      <div class="card" style="overflow:hidden;">
        <div style="aspect-ratio: ${asset.width}/${asset.height}; background: var(--c-sage-light);">
          <img src="${escAttr(preview)}" alt="${escAttr(asset.kind)}" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div class="card-body">
          <div class="flex justify-between items-start gap-3">
            <div>
              <div class="kpi-label">${esc(KIND_LABELS[asset.kind] || asset.kind)}</div>
              <div style="font-weight:600; color: var(--c-forest);">${statusLabel(asset.status)}</div>
            </div>
            <span class="badge badge-ai">${esc(asset.provider || 'provider')} · ${esc(asset.model || 'model')}</span>
          </div>
          <p class="form-hint mt-3" style="word-break: break-word;">${esc(asset.prompt || '')}</p>
          <div class="flex gap-2 mt-4" style="flex-wrap: wrap;">
            <button class="btn btn-ghost btn-sm" data-id="${escAttr(asset.id)}" data-action="approved">Schválit</button>
            <button class="btn btn-ghost btn-sm" data-id="${escAttr(asset.id)}" data-action="archived">Archivovat</button>
          </div>
        </div>
      </div>`;
  }

  function renderSkeleton() {
    return `
      <div class="canvas-header"><div class="skeleton" style="width:260px;height:34px;"></div></div>
      <div class="grid-2 gap-6">
        <div class="card"><div class="skeleton" style="width:100%;height:360px;"></div></div>
        <div class="card"><div class="skeleton" style="width:100%;height:360px;"></div></div>
      </div>`;
  }

  function kindOption(kind) {
    return `<option value="${kind}">${esc(KIND_LABELS[kind])}</option>`;
  }

  function filterChip(status, label) {
    const active = filter.status === status ? 'btn-champagne' : 'btn-ghost';
    return `<button class="btn btn-sm ${active}" data-filter-status="${escAttr(status)}">${esc(label)}</button>`;
  }

  function kindFilterChip(kind, label) {
    const active = filter.kind === kind ? 'btn-champagne' : 'btn-ghost';
    return `<button class="btn btn-sm ${active}" data-filter-kind="${escAttr(kind)}">${esc(label)}</button>`;
  }

  function jobFilterChip(status, label) {
    const active = jobStatusFilter === status ? 'btn-champagne' : 'btn-ghost';
    return `<button class="btn btn-sm ${active}" data-job-filter-status="${escAttr(status)}">${esc(label)}</button>`;
  }

  function statusLabel(status) {
    switch (status) {
      case 'approved': return 'Schváleno';
      case 'archived': return 'Archivováno';
      case 'failed': return 'Selhalo';
      default: return 'Koncept';
    }
  }

  function esc(value) {
    if (!value) return '';
    const el = document.createElement('span');
    el.textContent = String(value);
    return el.innerHTML;
  }

  function escAttr(value) {
    return String(value || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function safeParse(value) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function formatTime(value) {
    if (!value) return '-';
    const date = new Date(value.includes('T') ? value : `${value}Z`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

export function destroy() {}
