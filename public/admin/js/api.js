/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin API Client
 * ═══════════════════════════════════════════════════════════════
 * HTTP klient pro komunikaci s admin Worker endpointy.
 * Automaticky:
 *   - přidává Cf-Access-Jwt-Assertion (pokud existuje)
 *   - parsuje JSON odpovědi
 *   - loguje chyby do audit stream (activity feed)
 *   - implementuje retry s exponenciálním backoff
 * ═══════════════════════════════════════════════════════════════
 */

const API_BASE = '/admin';

/**
 * Vykreslí statickou obrazovku "Váš účet nemá přístup — kontaktujte správce"
 * a zastaví pollery na pozadí.
 * @param {string} [reason]
 */
function showAccessDenied(reason = 'Váš účet nemá přístup — kontaktujte správce.') {
  // Zastaví pollery (funkce z app.js)
  if (typeof window.stopPollers === 'function') {
    window.stopPollers();
  }

  // Vykreslí statickou obrazovku bez reloadu/redirectu
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: 100vw;
      background-color: #FAF8F5;
      color: #2B2B2B;
      font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
      text-align: center;
      padding: 2rem;
      box-sizing: border-box;
    ">
      <div style="font-size: 4rem; margin-bottom: 1.5rem; filter: drop-shadow(0 4px 12px rgba(58, 74, 60, 0.08));">🔒</div>
      <h1 style="
        font-family: 'Cormorant Garamond', Georgia, serif;
        font-size: 2.5rem;
        color: #3A4A3C;
        margin-bottom: 1rem;
        font-weight: 600;
      ">Přístup odepřen</h1>
      <p style="
        font-size: 1rem;
        color: #738A75;
        max-width: 480px;
        margin-bottom: 2rem;
        line-height: 1.6;
      ">${reason}</p>
      <a href="/cdn-cgi/access/logout" style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        padding: 0 1.25rem;
        border-radius: 10px;
        background-color: #3A4A3C;
        color: #FFFFFF;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        box-shadow: 0 4px 12px rgba(58, 74, 60, 0.08);
        transition: background-color 150ms ease;
      " onmouseover="this.style.backgroundColor='#2D3A2F'" onmouseout="this.style.backgroundColor='#3A4A3C'">
        Odhlásit se
      </a>
    </div>
  `;
}

// Zpřístupníme na window pro ostatní moduly a skripty
window.showAccessDenied = showAccessDenied;

/**
 * Centrální ošetření chyb přihlášení (401 a 403).
 * @param {number} status
 */
function handleAuthError(status) {
  if (status === 403) {
    console.warn('[api] 403 Forbidden - Access Denied.');
    showAccessDenied('Váš účet nemá přístup — kontaktujte správce.');
    return;
  }

  if (status === 401) {
    const now = Date.now();
    const lastRedirect = sessionStorage.getItem('admin_auth_redirect_at');

    if (lastRedirect) {
      const diff = now - parseInt(lastRedirect, 10);
      if (diff < 10000) {
        console.error('[api] Auth redirect loop detected (<10s). Breaking loop.');
        showAccessDenied('Smyčka přesměrování detekována. Přihlášení selhalo opakovaně.');
        return;
      }
    }

    // Uložíme čas redirectu do sessionStorage a přesměrujeme
    sessionStorage.setItem('admin_auth_redirect_at', now.toString());
    console.warn('[api] 401 Unauthenticated - Redirecting to Cloudflare Access login.');
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    window.location.href = '/cdn-cgi/access/login?redirect_url=' + encodeURIComponent(returnUrl);
  }
}

/**

 * @typedef {Object} ApiResponse
 * @property {boolean} ok
 * @property {Object|null} data
 * @property {string|null} error
 * @property {number} status
 */

/**
 * Odešle HTTP request na admin API.
 * @param {string} path   — cesta relativní k /admin (např. '/dashboard')
 * @param {Object} [options]
 * @param {'GET'|'POST'|'PUT'|'DELETE'} [options.method='GET']
 * @param {Object} [options.body]    — JSON body (automaticky serializováno)
 * @param {Object} [options.headers] — extra headers
 * @param {number} [options.retries=2] — počet pokusů při selhání
 * @param {number} [options.timeout=15000] — timeout v ms
 * @returns {Promise<ApiResponse>}
 */
async function request(path, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    retries = 2,
    timeout = 15000,
  } = options;

  const url = `${API_BASE}${path}`;

  const fetchHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  // Cloudflare Access JWT se přidává automaticky prohlížečem
  // (cookie CF_Authorization), nemusíme ho explicitně nastavovat.

  const fetchOptions = {
    method,
    headers: fetchHeaders,
    credentials: 'same-origin',
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Parse response
      let body = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          body = await response.json();
        } catch {
          body = null;
        }
      }

      if (!response.ok) {
        const errorMsg = body?.error || `HTTP ${response.status}`;

        // 401/403 → centrální ošetření autentizačních chyb (Access Denied / Redirect)
        if (response.status === 401 || response.status === 403) {
          handleAuthError(response.status);
          return { ok: false, data: null, error: 'Neoprávněný přístup', status: response.status };
        }

        // 429 → rate limit, retry s delším čekáním
        if (response.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt + 2) * 1000; // 4s, 8s
          console.warn(`[api] Rate limited, retry in ${delay}ms`);
          await sleep(delay);
          continue;
        }

        return { ok: false, data: body?.data || null, error: errorMsg, status: response.status };
      }

      let ok = response.ok;
      let data = body;
      let error = null;

      if (body && typeof body === 'object') {
        if (typeof body.ok === 'boolean') {
          ok = body.ok;
        }
        if (body.data !== undefined) {
          data = body.data;
        } else if (body.ok === false) {
          data = null;
        }
        if (body.error !== undefined) {
          error = body.error;
        }
      }

      return { ok, data, error, status: response.status };

    } catch (err) {
      lastError = err;

      if (err.name === 'AbortError') {
        console.warn(`[api] Request timeout: ${url}`);
        if (attempt < retries) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        return { ok: false, data: null, error: 'Požadavek vypršel', status: 0 };
      }

      // Network error → retry
      if (attempt < retries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[api] Network error, retry ${attempt + 1}/${retries} in ${delay}ms`);
        await sleep(delay);
        continue;
      }
    }
  }

  return {
    ok: false,
    data: null,
    error: lastError?.message || 'Síťová chyba',
    status: 0,
  };
}

/**
 * Sleep utility.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── CONVENIENCE METHODS ──────────────────────────────────────

/**
 * GET /admin/dashboard — přehledové statistiky.
 * @returns {Promise<ApiResponse>}
 */
function getDashboard() {
  return request('/dashboard');
}

/**
 * GET /admin/bookings — seznam poptávek/rezervací.
 * @param {Object} [params] — filtrační parametry
 * @param {string} [params.status] — pending|confirmed|done|cancelled
 * @param {number} [params.limit=20]
 * @param {number} [params.offset=0]
 * @returns {Promise<ApiResponse>}
 */
function getBookings(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/bookings${qs ? '?' + qs : ''}`);
}

/**
 * PUT /admin/bookings — aktualizace statusu rezervace.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<ApiResponse>}
 */
function updateBooking(id, updates) {
  return request('/bookings', { method: 'PUT', body: { id, ...updates } });
}

/**
 * DELETE /admin/bookings — trvalé smazání rezervace (NEVRATNÉ).
 * @param {string} id
 * @returns {Promise<ApiResponse>}
 */
function deleteBooking(id) {
  return request('/bookings', { method: 'DELETE', body: { id, confirm: true } });
}

/**
 * PUT /admin/bookings — označení "klient nedorazil" (confirmed → done + no_show_flag).
 * @param {string} id
 * @returns {Promise<ApiResponse>}
 */
function markNoShow(id) {
  return request('/bookings', { method: 'PUT', body: { id, action: 'no_show' } });
}

/**
 * GET /admin/booking-detail — detail rezervace s dešifrovanými PII a audit historií.
 * @param {string} id
 * @returns {Promise<ApiResponse>}
 */
function getBookingDetail(id) {
  return request(`/booking-detail?id=${encodeURIComponent(id)}`);
}

/**
 * POST /admin/copywriter — generování obsahu AI.
 * @param {Object} data
 * @param {string} data.prompt     — zadání pro AI
 * @param {string} [data.type]     — 'blog'|'social'|'newsletter'
 * @param {string} [data.service]  — slug služby pro kontext
 * @returns {Promise<ApiResponse>}
 */
function generateContent(data) {
  return request('/copywriter', { method: 'POST', body: data, timeout: 30000 });
}

/**
 * POST /admin/publish — publikace schváleného obsahu.
 * @param {Object} data
 * @param {string} data.id       — ID blog_posts
 * @param {string[]} [data.channels] — ['web','social']
 * @returns {Promise<ApiResponse>}
 */
function publishContent(data) {
  return request('/publish', { method: 'POST', body: data });
}

/**
 * GET /admin/invoices — přehled faktur.
 * @param {Object} [params]
 * @returns {Promise<ApiResponse>}
 */
function getInvoices(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/invoices${qs ? '?' + qs : ''}`);
}

/**
 * GET /admin/payments — přehled plateb Stripe.
 * @returns {Promise<ApiResponse>}
 */
function getPayments() {
  return request('/payments');
}


/**
 * POST /admin/invoices — vystavení faktury.
 * @param {Object} data
 * @returns {Promise<ApiResponse>}
 */
function createInvoice(data) {
  return request('/invoices', { method: 'POST', body: data });
}

/**
 * GET /admin/geo — GEO-Marketing analytika.
 * @returns {Promise<ApiResponse>}
 */
function getGeoAnalytics() {
  return request('/geo');
}

/**
 * GET /admin/settings — aktuální nastavení.
 * @returns {Promise<ApiResponse>}
 */
function getSettings() {
  return request('/settings');
}

/**
 * PUT /admin/settings — uložení nastavení.
 * @param {Object} settings
 * @returns {Promise<ApiResponse>}
 */
function saveSettings(settings) {
  return request('/settings', { method: 'PUT', body: settings });
}

/**
 * GET /admin/activity — activity feed (poslední události).
 * @param {number} [limit=30]
 * @returns {Promise<ApiResponse>}
 */
function getActivityFeed(limit = 30) {
  return request(`/activity?limit=${limit}`);
}

/**
 * POST /admin/campaign — vytvoření/správa kampaně.
 * @param {Object} data
 * @returns {Promise<ApiResponse>}
 */
function createCampaign(data) {
  return request('/campaign', { method: 'POST', body: data });
}

/**
 * GET /admin/me — aktuálně přihlášený operátor.
 * @returns {Promise<ApiResponse>}
 */
function getMe() {
  return request('/me');
}

/**
 * GET /admin/blog — seznam všech článků.
 * @returns {Promise<ApiResponse>}
 */
function getBlogPosts() {
  return request('/blog');
}

/**
 * GET /admin/blog?id=... — detail jednoho článku.
 * @param {string} id
 * @returns {Promise<ApiResponse>}
 */
function getBlogPost(id) {
  return request(`/blog?id=${id}`);
}

/**
 * PUT /admin/blog — akce nad články (update, publish, schedule, unpublish, archive).
 * @param {Object} body
 * @returns {Promise<ApiResponse>}
 */
function updateBlogPost(body) {
  return request('/blog', { method: 'PUT', body });
}

/**
 * GET /admin/availability — otevírací doby + booking_settings.
 * @returns {Promise<ApiResponse>}
 */
function getAvailability() {
  return request('/availability');
}

/**
 * PUT /admin/availability — ulož pravidla otevírací doby a nastavení.
 * @param {Object} data — { rules: [...], settings: {...} }
 * @returns {Promise<ApiResponse>}
 */
function saveAvailability(data) {
  return request('/availability', { method: 'PUT', body: data });
}

/**
 * GET /admin/exceptions — načti výjimky dostupnosti.
 * @returns {Promise<ApiResponse>}
 */
function getExceptions() {
  return request('/exceptions');
}

/**
 * POST /admin/exceptions — přidej výjimku dostupnosti.
 * @param {Object} data — { date, type, start_time?, end_time?, note? }
 * @returns {Promise<ApiResponse>}
 */
function addException(data) {
  return request('/exceptions', { method: 'POST', body: data });
}

/**
 * DELETE /admin/exceptions — smaž výjimku dostupnosti.
 * @param {string} id — ID výjimky
 * @returns {Promise<ApiResponse>}
 */
function deleteException(id) {
  return request(`/exceptions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── CMS: OBSAH WEBU ──────────────────────────────────────────

/** GET /admin/content — seznam textových sekcí (nebo ?key= / ?history=1). */
function getContentSections() {
  return request('/content');
}
/** GET /admin/content?history=1 — audit historie CMS změn. @returns {Promise<ApiResponse>} */
function getContentHistory() {
  return request('/content?history=1');
}
/** POST /admin/content — vytvoří textovou sekci. @param {Object} body @returns {Promise<ApiResponse>} */
function createContentSection(body) {
  return request('/content', { method: 'POST', body });
}
/** PUT /admin/content — upraví textovou sekci. @param {Object} body @returns {Promise<ApiResponse>} */
function updateContentSection(body) {
  return request('/content', { method: 'PUT', body });
}
/** GET /admin/content?key= — detail sekce (živé + draft pole). @param {string} key @returns {Promise<ApiResponse>} */
function getContentSection(key) {
  return request(`/content?key=${encodeURIComponent(key)}`);
}
/** POST /admin/content {action:publish} — zveřejní koncept sekce. @param {string} section_key @returns {Promise<ApiResponse>} */
function publishContentSection(section_key) {
  return request('/content', { method: 'POST', body: { action: 'publish', section_key } });
}
/** POST /admin/content {action:discard} — zahodí koncept sekce. @param {string} section_key @returns {Promise<ApiResponse>} */
function discardContentSection(section_key) {
  return request('/content', { method: 'POST', body: { action: 'discard', section_key } });
}
/** DELETE /admin/content — smaže sekci dle klíče. @param {string} section_key @returns {Promise<ApiResponse>} */
function deleteContentSection(section_key) {
  return request(`/content?key=${encodeURIComponent(section_key)}`, { method: 'DELETE' });
}

/** GET /admin/gallery — seznam galerií (nebo ?key= pro položky). */
function getGalleries() {
  return request('/gallery');
}
/** GET /admin/gallery?key= — položky galerie. @param {string} key @returns {Promise<ApiResponse>} */
function getGalleryItems(key) {
  return request(`/gallery?key=${encodeURIComponent(key)}`);
}
/** PUT /admin/gallery — úprava metadat položky. @param {Object} body @returns {Promise<ApiResponse>} */
function updateGalleryItem(body) {
  return request('/gallery', { method: 'PUT', body });
}
/** PUT /admin/gallery — změna pořadí položek. @param {string} gallery_key @param {Array} items @returns {Promise<ApiResponse>} */
function reorderGallery(gallery_key, items) {
  return request('/gallery', { method: 'PUT', body: { action: 'reorder', gallery_key, items } });
}
/** DELETE /admin/gallery?id= — smaže obrázek. @param {string} id @returns {Promise<ApiResponse>} */
function deleteGalleryItem(id) {
  return request(`/gallery?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Upload obrázku do galerie (multipart/form-data — mimo standardní JSON request).
 * @param {string} galleryKey
 * @param {File} file
 * @returns {Promise<ApiResponse>}
 */
async function uploadGalleryImage(galleryKey, file) {
  const form = new FormData();
  form.append('gallery_key', galleryKey);
  form.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/gallery`, {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (res.status === 401 || res.status === 403) {
      handleAuthError(res.status);
      return { ok: false, data: null, error: 'Neoprávněný přístup', status: res.status };
    }
    return {
      ok: res.ok && body?.ok !== false,
      data: body?.data ?? null,
      error: body?.error ?? (res.ok ? null : `HTTP ${res.status}`),
      status: res.status,
    };
  } catch (err) {
    return { ok: false, data: null, error: err.message || 'Síťová chyba', status: 0 };
  }
}

/** GET /admin/hero — seznam hero bannerů (nebo ?key=). */
function getHeroes() {
  return request('/hero');
}
/** GET /admin/hero?key= — hero konfigurace stránky. @param {string} key @returns {Promise<ApiResponse>} */
function getHero(key) {
  return request(`/hero?key=${encodeURIComponent(key)}`);
}
/** PUT /admin/hero — uloží změnu hero jako koncept. @param {Object} body @returns {Promise<ApiResponse>} */
function saveHero(body) {
  return request('/hero', { method: 'PUT', body });
}
/** POST /admin/hero {action:publish} — zveřejní koncept hero. @param {string} page_key @returns {Promise<ApiResponse>} */
function publishHero(page_key) {
  return request('/hero', { method: 'POST', body: { action: 'publish', page_key } });
}
/** POST /admin/hero {action:discard} — zahodí koncept hero. @param {string} page_key @returns {Promise<ApiResponse>} */
function discardHero(page_key) {
  return request('/hero', { method: 'POST', body: { action: 'discard', page_key } });
}

// ─── EXPORT (pro browser ES module) ────────────────────────────

const AdminAPI = {
  request,
  getDashboard,
  getBookings,
  updateBooking,
  deleteBooking,
  markNoShow,
  getBookingDetail,
  generateContent,
  publishContent,
  getInvoices,
  createInvoice,
  getPayments,
  getGeoAnalytics,
  getSettings,
  saveSettings,
  getActivityFeed,
  createCampaign,
  getMe,
  getBlogPosts,
  getBlogPost,
  updateBlogPost,
  getAvailability,
  saveAvailability,
  getExceptions,
  addException,
  deleteException,
  // CMS — obsah webu
  getContentSections,
  getContentSection,
  getContentHistory,
  createContentSection,
  updateContentSection,
  publishContentSection,
  discardContentSection,
  deleteContentSection,
  getGalleries,
  getGalleryItems,
  updateGalleryItem,
  reorderGallery,
  deleteGalleryItem,
  uploadGalleryImage,
  getHeroes,
  getHero,
  saveHero,
  publishHero,
  discardHero,
};

// Také na window pro přístup z modulů
window.AdminAPI = AdminAPI;

export default AdminAPI;
