/**
 * BICOM PÍSEK — Blog & AI Copywriter Module
 */

import { renderMarkdown } from '/assets/js/markdown.js';

export async function render(container, ctx) {
  const { api, showToast } = ctx;
  container.innerHTML = renderSkeleton();

  let allPosts = [];
  let currentTab = 'all';

  // Načte články ze serveru nebo použije demo data
  async function loadPosts() {
    if (api) {
      const res = await api.getBlogPosts();
      if (res.ok && res.data?.posts) {
        allPosts = res.data.posts;
        return;
      }
    }
    // Fallback do demo dat
    allPosts = getDemoPosts();
  }

  await loadPosts();
  renderMainLayout();

  function renderMainLayout() {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">Blog & AI Copywriter</h1>
        <p class="canvas-subtitle">Generujte obsah pomocí AI, schvalujte, plánujte a spravujte články</p>
      </div>

      <div class="grid-2 gap-6" style="grid-template-columns: 1fr 1fr; align-items: start;">
        <!-- AI Generátor (Levá část) -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">🤖 Nový článek</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Téma nebo klíčová slova</label>
              <textarea class="form-textarea" id="ai-prompt" rows="3" placeholder="Např. 'Jak biorezonance pomáhá při jarních alergiích'"></textarea>
              <p class="form-hint">AI vytvoří strukturovaný článek v tónu Quiet Luxury s právním filtrem</p>
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
            <button class="btn btn-champagne" id="btn-generate" style="width: 100%;">✨ Generovat článek</button>
            
            <div id="ai-result" class="mt-6" style="display:none;">
              <div class="card" style="border-left: 3px solid var(--c-champagne); background: var(--c-alabaster);">
                <div class="card-body">
                  <h4 id="ai-result-title" style="font-family: var(--font-head); font-size: var(--text-md); color: var(--c-forest); margin-bottom: var(--sp-2);"></h4>
                  <p id="ai-result-excerpt" style="font-size: var(--text-sm); font-style: italic; color: var(--c-sage); margin-bottom: var(--sp-4);"></p>
                  <div id="ai-result-preview" class="blog-article-content" style="font-size: var(--text-sm); max-height: 250px; overflow-y: auto; border: 1px solid var(--c-mist); padding: var(--sp-4); background: var(--c-white); border-radius: var(--radius-md);"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Seznam článků (Pravá část) -->
        <div class="card">
          <div class="card-header flex justify-between items-center" style="border-bottom: none; padding-bottom: 0;">
            <h3 class="card-title">📝 Správa článků</h3>
            <span class="badge badge-ai" id="posts-count-badge">${allPosts.length} celkem</span>
          </div>
          <div class="card-body">
            <!-- Tabs -->
            <div style="display: flex; gap: 0.25rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--c-mist); padding-bottom: 0.25rem; overflow-x: auto;">
              <button class="tab-btn" data-tab="all" style="background:none; border:none; padding: 0.5rem 0.75rem; cursor:pointer; font-weight:500; font-family:var(--font-body); font-size:var(--text-sm); border-bottom: 2px solid transparent;">Všechny</button>
              <button class="tab-btn" data-tab="draft" style="background:none; border:none; padding: 0.5rem 0.75rem; cursor:pointer; font-weight:500; font-family:var(--font-body); font-size:var(--text-sm); border-bottom: 2px solid transparent;">Koncepty</button>
              <button class="tab-btn" data-tab="scheduled" style="background:none; border:none; padding: 0.5rem 0.75rem; cursor:pointer; font-weight:500; font-family:var(--font-body); font-size:var(--text-sm); border-bottom: 2px solid transparent;">Plánované</button>
              <button class="tab-btn" data-tab="published" style="background:none; border:none; padding: 0.5rem 0.75rem; cursor:pointer; font-weight:500; font-family:var(--font-body); font-size:var(--text-sm); border-bottom: 2px solid transparent;">Publikované</button>
              <button class="tab-btn" data-tab="archived" style="background:none; border:none; padding: 0.5rem 0.75rem; cursor:pointer; font-weight:500; font-family:var(--font-body); font-size:var(--text-sm); border-bottom: 2px solid transparent;">Archivované</button>
            </div>

            <!-- Table Container -->
            <div id="posts-table-container"></div>
          </div>
        </div>
      </div>
    `;

    setupEventListeners();
    renderTable();
  }

  function setupEventListeners() {
    // AI Generator click handler
    const genBtn = container.querySelector('#btn-generate');
    genBtn?.addEventListener('click', async () => {
      const prompt = container.querySelector('#ai-prompt')?.value;
      const type = container.querySelector('#ai-type')?.value;
      const service = container.querySelector('#ai-service')?.value;

      if (!prompt?.trim()) {
        showToast('Zadejte téma pro článek', 'warning');
        return;
      }

      genBtn.disabled = true;
      genBtn.textContent = '⏳ Generuji pomocí AI…';

      if (api) {
        try {
          const res = await api.generateContent({ prompt, type, service });
          if (res.ok && res.data) {
            // Zobrazit výsledek generování
            const resultEl = container.querySelector('#ai-result');
            const resultTitle = container.querySelector('#ai-result-title');
            const resultExcerpt = container.querySelector('#ai-result-excerpt');
            const resultPreview = container.querySelector('#ai-result-preview');

            if (resultEl && resultTitle && resultExcerpt && resultPreview) {
              resultTitle.textContent = res.data.title || 'Návrh článku';
              resultExcerpt.textContent = res.data.excerpt || '';
              resultPreview.innerHTML = renderMarkdown(res.data.content || '');
              resultEl.style.display = 'block';
            }

            showToast('Článek vygenerován a uložen jako koncept ✓', 'success');

            // Vyčistit prompt
            container.querySelector('#ai-prompt').value = '';

            // Znovu načíst články
            await loadPosts();
            updateBadge();
            renderTable();
          } else {
            showToast('Chyba generování: ' + (res.error || 'Neznámá chyba'), 'error');
          }
        } catch (err) {
          showToast('Chyba: ' + err.message, 'error');
        }
      } else {
        // Mock generování
        setTimeout(async () => {
          const mockPost = {
            id: String(Date.now()),
            slug: 'mock-post-' + Date.now(),
            title: prompt,
            excerpt: 'Vygenerovaný perex pro téma: ' + prompt,
            content: '## ' + prompt + '\nObsah vygenerovaný simulací AI pro testovací účely.',
            status: 'draft',
            source: 'ai_copywriter',
            created_at: new Date().toISOString()
          };
          allPosts.unshift(mockPost);
          
          const resultEl = container.querySelector('#ai-result');
          if (resultEl) {
            container.querySelector('#ai-result-title').textContent = mockPost.title;
            container.querySelector('#ai-result-excerpt').textContent = mockPost.excerpt;
            container.querySelector('#ai-result-preview').innerHTML = renderMarkdown(mockPost.content);
            resultEl.style.display = 'block';
          }
          
          showToast('Demo: Článek vygenerován (uložen lokálně) ✓', 'success');
          updateBadge();
          renderTable();
        }, 1500);
      }

      genBtn.disabled = false;
      genBtn.textContent = '✨ Generovat článek';
    });

    // Tab buttons event listeners
    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        currentTab = btn.dataset.tab;
        renderTable();
      });
    });
  }

  function updateBadge() {
    const badge = container.querySelector('#posts-count-badge');
    if (badge) {
      badge.textContent = `${allPosts.length} celkem`;
    }
  }

  function renderTable() {
    const tableContainer = container.querySelector('#posts-table-container');
    if (!tableContainer) return;

    // Update active tab visual status
    container.querySelectorAll('.tab-btn').forEach((btn) => {
      const isActive = btn.dataset.tab === currentTab;
      btn.style.color = isActive ? 'var(--c-forest)' : 'var(--c-sage)';
      btn.style.borderBottomColor = isActive ? 'var(--c-champagne)' : 'transparent';
    });

    const filtered = allPosts.filter((p) => {
      if (currentTab === 'all') return true;
      return p.status === currentTab;
    });

    if (filtered.length === 0) {
      tableContainer.innerHTML = `
        <div class="empty-state" style="padding: var(--sp-8) 0; text-align: center;">
          <h4 class="empty-state-title" style="color: var(--c-sage); font-family: var(--font-head); font-size: var(--text-md);">Žádné články v této kategorii</h4>
        </div>
      `;
      return;
    }

    const rows = filtered.map((p) => {
      return `
        <tr data-id="${p.id}">
          <td style="max-width: 200px;">
            <div style="font-weight: 600; color: var(--c-forest); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${esc(p.title)}</div>
            <div style="font-size: var(--text-xs); color: var(--c-sage); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${esc(p.excerpt)}</div>
          </td>
          <td>
            <span style="font-size: var(--text-xs); font-weight: 500;">${getSourceLabel(p.source)}</span>
          </td>
          <td>
            ${getStatusBadge(p.status, p.published_at)}
          </td>
          <td style="white-space: nowrap; font-size: var(--text-xs); color: var(--c-sage);">
            ${fmtDate(p.published_at || p.created_at)}
          </td>
          <td>
            <div class="flex gap-2 justify-end">
              <button class="btn btn-ghost btn-sm btn-edit" title="Upravit">✍️</button>
              ${renderActionButtons(p.status)}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tableContainer.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Název a perex</th>
              <th>Zdroj</th>
              <th>Stav</th>
              <th>Datum</th>
              <th style="text-align: right;">Akce</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;

    // Bind action listeners to table rows
    tableContainer.querySelectorAll('tr[data-id]').forEach((row) => {
      const id = row.dataset.id;
      
      row.querySelector('.btn-edit')?.addEventListener('click', () => handleEdit(id));
      row.querySelector('.btn-publish')?.addEventListener('click', () => handlePublish(id));
      row.querySelector('.btn-schedule')?.addEventListener('click', () => handleSchedule(id));
      row.querySelector('.btn-unpublish')?.addEventListener('click', () => handleUnpublish(id));
      row.querySelector('.btn-archive')?.addEventListener('click', () => handleArchive(id));
    });
  }

  function renderActionButtons(status) {
    if (status === 'draft') {
      return `
        <button class="btn btn-primary btn-sm btn-publish" title="Publikovat">Zveřejnit</button>
        <button class="btn btn-champagne btn-sm btn-schedule" title="Naplánovat">Plánovat</button>
        <button class="btn btn-outline btn-sm btn-archive" title="Archivovat" style="color: var(--c-error);">Archiv</button>
      `;
    } else if (status === 'scheduled') {
      return `
        <button class="btn btn-primary btn-sm btn-publish" title="Publikovat ihned">Zveřejnit</button>
        <button class="btn btn-secondary btn-sm btn-unpublish" title="Zpět do konceptů">Vrátit</button>
        <button class="btn btn-outline btn-sm btn-archive" title="Archivovat" style="color: var(--c-error);">Archiv</button>
      `;
    } else if (status === 'published') {
      return `
        <button class="btn btn-secondary btn-sm btn-unpublish" title="Stáhnout z webu">Do konceptů</button>
        <button class="btn btn-outline btn-sm btn-archive" title="Archivovat" style="color: var(--c-error);">Archiv</button>
      `;
    } else if (status === 'archived') {
      return `
        <button class="btn btn-secondary btn-sm btn-unpublish" title="Obnovit jako draft">Obnovit</button>
      `;
    }
    return '';
  }

  // --- ACTIONS HANDLERS ---

  async function handlePublish(id) {
    if (api) {
      const res = await api.updateBlogPost({ id, action: 'publish' });
      if (res.ok) {
        showToast('Článek byl úspěšně zveřejněn ✓', 'success');
        await loadPosts();
        renderTable();
      } else {
        showToast('Zveřejnění selhalo: ' + res.error, 'error');
      }
    } else {
      const post = allPosts.find((p) => p.id === id);
      if (post) {
        post.status = 'published';
        post.published_at = new Date().toISOString();
        showToast('Demo: Článek byl zveřejněn', 'success');
        renderTable();
      }
    }
  }

  async function handleUnpublish(id) {
    if (api) {
      const res = await api.updateBlogPost({ id, action: 'unpublish' });
      if (res.ok) {
        showToast('Článek byl vrácen do konceptů ✓', 'success');
        await loadPosts();
        renderTable();
      } else {
        showToast('Akce selhala: ' + res.error, 'error');
      }
    } else {
      const post = allPosts.find((p) => p.id === id);
      if (post) {
        post.status = 'draft';
        post.published_at = null;
        showToast('Demo: Článek vrácen do konceptů', 'success');
        renderTable();
      }
    }
  }

  async function handleArchive(id) {
    if (api) {
      const res = await api.updateBlogPost({ id, action: 'archive' });
      if (res.ok) {
        showToast('Článek byl archivován ✓', 'success');
        await loadPosts();
        renderTable();
      } else {
        showToast('Archivace selhala: ' + res.error, 'error');
      }
    } else {
      const post = allPosts.find((p) => p.id === id);
      if (post) {
        post.status = 'archived';
        showToast('Demo: Článek byl archivován', 'success');
        renderTable();
      }
    }
  }

  async function handleSchedule(id) {
    const post = allPosts.find((p) => p.id === id);
    if (!post) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setMinutes(0);
    tomorrow.setSeconds(0);
    const defaultDateStr = tomorrow.toISOString().substring(0, 16);

    const html = `
      <div class="modal" style="max-width: 420px; width: 90%;">
        <div class="modal-header">
          <h3 class="modal-title">Naplánovat článek</h3>
          <button class="btn-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: var(--text-sm); color: var(--c-sage); margin-bottom: 1.25rem;">
            Zvolte datum a čas automatického publikování článku na webu.
          </p>
          <div class="form-group">
            <label class="form-label">Datum a čas publikace (místní čas)</label>
            <input type="datetime-local" class="form-input" id="schedule-date" value="${defaultDateStr}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancel">Zrušit</button>
          <button class="btn btn-champagne" id="btn-schedule-confirm">📅 Naplánovat</button>
        </div>
      </div>
    `;

    showModal(html, (overlay, closeModal) => {
      overlay.querySelector('#btn-schedule-confirm').addEventListener('click', async () => {
        const dateVal = overlay.querySelector('#schedule-date').value;
        if (!dateVal) {
          showToast('Zadejte platné datum a čas', 'warning');
          return;
        }

        if (new Date(dateVal) <= new Date()) {
          showToast('Datum publikování musí být v budoucnosti', 'warning');
          return;
        }

        if (api) {
          const res = await api.updateBlogPost({
            id,
            action: 'schedule',
            payload: { publish_at: dateVal }
          });
          if (res.ok) {
            showToast('Článek byl naplánován ✓', 'success');
            closeModal();
            await loadPosts();
            renderTable();
          } else {
            showToast('Chyba plánování: ' + res.error, 'error');
          }
        } else {
          post.status = 'scheduled';
          post.published_at = new Date(dateVal).toISOString();
          showToast('Demo: Článek byl naplánován', 'success');
          closeModal();
          renderTable();
        }
      });
    });
  }

  async function handleEdit(id) {
    let post = null;
    if (api) {
      const res = await api.getBlogPost(id);
      if (res.ok && res.data) {
        post = res.data;
      } else {
        showToast('Nepodařilo se načíst obsah článku: ' + res.error, 'error');
        return;
      }
    } else {
      post = allPosts.find((p) => p.id === id);
    }

    if (!post) return;

    const html = `
      <div class="modal" style="max-width: 1000px; width: 95%; height: 90vh;">
        <div class="modal-header">
          <h3 class="modal-title">Upravit článek</h3>
          <button class="btn-close" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">&times;</button>
        </div>
        <div class="modal-body" style="overflow: hidden; padding: var(--sp-4) var(--sp-6);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; height: 100%; overflow: hidden;">
            <!-- Edit Form (Levý sloupec) -->
            <div style="overflow-y: auto; padding-right: 0.5rem; display: flex; flex-direction: column; gap: var(--sp-4); height: 100%;">
              <div class="form-group">
                <label class="form-label">Titulek</label>
                <input type="text" class="form-input" id="edit-title" value="${esc(post.title)}">
              </div>
              <div class="form-group">
                <label class="form-label">Perex (Výtah článku)</label>
                <textarea class="form-textarea" id="edit-excerpt" rows="3" style="resize: vertical;">${esc(post.excerpt)}</textarea>
              </div>
              <div class="form-group">
                <label class="form-label">URL úvodního obrázku</label>
                <input type="text" class="form-input" id="edit-image-url" value="${esc(post.image_url)}">
                <div id="image-preview-container" style="margin-top: 0.5rem; border: 1px solid var(--c-mist); border-radius: var(--radius-md); padding: 0.25rem; display: none; max-height: 100px; overflow: hidden; justify-content: center; align-items: center; background: var(--c-alabaster);">
                  <img id="edit-image-preview" src="" style="max-height: 90px; width: auto; object-fit: cover;">
                </div>
              </div>
              <div class="form-group" style="flex: 1; display: flex; flex-direction: column; margin-bottom: 0;">
                <label class="form-label">Obsah (Markdown)</label>
                <textarea class="form-textarea" id="edit-content" style="flex: 1; min-height: 200px; font-family: var(--font-mono); font-size: var(--text-sm); line-height: 1.5; resize: none;">${esc(post.content)}</textarea>
              </div>
            </div>
            <!-- Live Preview (Pravý sloupec) -->
            <div style="overflow-y: auto; border-left: 1px solid var(--c-mist); padding-left: 1.5rem; display: flex; flex-direction: column; height: 100%;">
              <label class="form-label" style="color: var(--c-forest); font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">👁️ Živý náhled</label>
              <div class="blog-article-content" id="edit-preview" style="flex: 1; border: 1px solid var(--c-mist); border-radius: var(--radius-md); padding: var(--sp-6); background: var(--c-white); line-height: 1.8; overflow-y: auto;">
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-cancel">Zrušit</button>
          <button class="btn btn-primary" id="btn-save-post">💾 Uložit změny</button>
        </div>
      </div>
    `;

    showModal(html, (overlay, closeModal) => {
      const titleInput = overlay.querySelector('#edit-title');
      const excerptInput = overlay.querySelector('#edit-excerpt');
      const imageUrlInput = overlay.querySelector('#edit-image-url');
      const contentTextarea = overlay.querySelector('#edit-content');
      const previewEl = overlay.querySelector('#edit-preview');
      const imagePreviewContainer = overlay.querySelector('#image-preview-container');
      const imagePreview = overlay.querySelector('#edit-image-preview');

      // Update image preview
      const updateImage = () => {
        const url = imageUrlInput.value.trim();
        if (url) {
          imagePreview.src = url;
          imagePreviewContainer.style.display = 'flex';
        } else {
          imagePreviewContainer.style.display = 'none';
        }
      };
      imageUrlInput.addEventListener('input', updateImage);
      updateImage();

      // Update live markdown preview
      const updatePreview = () => {
        if (previewEl && contentTextarea) {
          previewEl.innerHTML = renderMarkdown(contentTextarea.value);
        }
      };
      contentTextarea.addEventListener('input', updatePreview);
      updatePreview();

      // Save handler
      overlay.querySelector('#btn-save-post').addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const excerpt = excerptInput.value.trim();
        const image_url = imageUrlInput.value.trim();
        const content = contentTextarea.value;

        if (!title || !content.trim()) {
          showToast('Titulek a obsah jsou povinné', 'warning');
          return;
        }

        if (api) {
          const res = await api.updateBlogPost({
            id,
            action: 'update',
            payload: { title, excerpt, image_url, content }
          });
          if (res.ok) {
            showToast('Změny byly uloženy ✓', 'success');
            closeModal();
            await loadPosts();
            renderTable();
          } else {
            showToast('Uložení selhalo: ' + res.error, 'error');
          }
        } else {
          post.title = title;
          post.excerpt = excerpt;
          post.image_url = image_url;
          post.content = content;
          showToast('Demo: Změny byly uloženy', 'success');
          closeModal();
          renderTable();
        }
      });
    });
  }

  // Helper function to render a popup modal dynamically
  function showModal(html, onMount, onCleanup) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.btn-close') || overlay.querySelector('.btn-cancel');
    const closeModal = () => {
      if (onCleanup) onCleanup(overlay);
      overlay.remove();
    };

    closeBtn?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    if (onMount) onMount(overlay, closeModal);
  }
}

export function destroy() {}

function renderSkeleton() {
  return '<div class="canvas-header"><div class="skeleton" style="width:250px;height:32px;"></div></div><div class="grid-2 gap-6"><div class="card"><div class="skeleton" style="width:100%;height:350px;"></div></div><div class="card"><div class="skeleton" style="width:100%;height:350px;"></div></div></div>';
}

function getDemoPosts() {
  return [
    { id: '1', slug: 'jarni-alergie-biorezonance', title: 'Jarní alergie a biorezonance', excerpt: 'Pylová sezóna přichází — jak může biorezonanční metoda podpořit váš organismus…', status: 'draft', source: 'ai_copywriter', created_at: '2026-06-10T12:00:00Z', content: '## Jarní alergie\nBiorezonance pomáhá...' },
    { id: '2', slug: '5-tipu-pro-silnejsi-imunitu', title: '5 tipů pro silnější imunitu', excerpt: 'Jednoduchá opatření, která můžete kombinovat s biorezonanční terapií…', status: 'published', published_at: '2026-06-09T10:00:00Z', source: 'manual', created_at: '2026-06-09T10:00:00Z', content: '## Imunita\n1. Spánek...' },
    { id: '3', slug: 'unava-a-vitalita', title: 'Chronická únava a biorezonanční podpora', excerpt: 'Cítíte se neustále bez energie? Objevte příčiny a možnosti obnovy vitality.', status: 'scheduled', published_at: '2026-06-12T08:00:00Z', source: 'ai_copywriter', created_at: '2026-06-08T14:00:00Z', content: '## Únava\nÚnava může mít různé příčiny...' },
  ];
}

function getStatusBadge(status, publishedAt) {
  switch (status) {
    case 'published':
      return `<span class="badge badge-confirmed">Zveřejněn</span>`;
    case 'scheduled':
      const formattedDate = publishedAt ? new Date(publishedAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
      return `<span class="badge badge-pending" title="Naplánováno na ${formattedDate}">Plánováno (${formattedDate})</span>`;
    case 'archived':
      return `<span class="badge badge-cancelled">Archivován</span>`;
    case 'draft':
    default:
      return `<span class="badge badge-done">Koncept</span>`;
  }
}

function getSourceLabel(source) {
  switch (source) {
    case 'instagram': return '📸 Instagram';
    case 'ai_copywriter': return '🤖 AI Copywriter';
    case 'manual': return '✍️ Ručně';
    default: return source || '—';
  }
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }); }
