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
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        const errorMsg = data?.error || `HTTP ${response.status}`;

        // 401/403 → přesměrovat na login (Cloudflare Access)
        if (response.status === 401 || response.status === 403) {
          console.warn('[api] Auth error, redirecting to login');
          window.location.href = '/admin';
          return { ok: false, data: null, error: 'Neoprávněný přístup', status: response.status };
        }

        // 429 → rate limit, retry s delším čekáním
        if (response.status === 429 && attempt < retries) {
          const delay = Math.pow(2, attempt + 2) * 1000; // 4s, 8s
          console.warn(`[api] Rate limited, retry in ${delay}ms`);
          await sleep(delay);
          continue;
        }

        return { ok: false, data, error: errorMsg, status: response.status };
      }

      return { ok: true, data, error: null, status: response.status };

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
 * PUT /admin/bookings/:id — aktualizace statusu rezervace.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<ApiResponse>}
 */
function updateBooking(id, updates) {
  return request(`/bookings/${id}`, { method: 'PUT', body: updates });
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

// ─── EXPORT (pro browser ES module) ────────────────────────────

const AdminAPI = {
  request,
  getDashboard,
  getBookings,
  updateBooking,
  generateContent,
  publishContent,
  getInvoices,
  createInvoice,
  getGeoAnalytics,
  getSettings,
  saveSettings,
  getActivityFeed,
  createCampaign,
};

// Také na window pro přístup z modulů
window.AdminAPI = AdminAPI;

export default AdminAPI;
