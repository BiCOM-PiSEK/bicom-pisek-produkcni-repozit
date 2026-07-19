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
const ADMIN_PASSWORD_STORAGE_KEY = 'admin_auth_password';
let _authPromptActive = false;
const ADMIN_PASSWORD_COOKIE_NAME = 'admin_auth';
const ADMIN_PASSWORD_DASH_VARIANTS_REGEX = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
const ADMIN_PASSWORD_PLUS_VARIANTS_REGEX = /[\uFF0B\uFE62\u207A\u208A\u2795]/g;
const ADMIN_PASSWORD_AT_VARIANTS_REGEX = /[\uFF20\uFE6B]/g;
const ADMIN_PASSWORD_ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const ADMIN_PASSWORD_CZ_NUMBER_ROW_REGEX = /[ěščřžýáíéĚŠČŘŽÝÁÍÉ]/g;
const ADMIN_PASSWORD_CZ_NUMBER_ROW_MAP = {
  'ě': '2', 'š': '3', 'č': '4', 'ř': '5', 'ž': '6', 'ý': '7', 'á': '8', 'í': '9', 'é': '0',
  'Ě': '2', 'Š': '3', 'Č': '4', 'Ř': '5', 'Ž': '6', 'Ý': '7', 'Á': '8', 'Í': '9', 'É': '0',
};

/**
 * Normalizuje heslo z UI tak, aby ručně psané varianty
 * (typografická pomlčka / full-width znaky) odpovídaly serveru.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeAdminPassword(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(ADMIN_PASSWORD_ZERO_WIDTH_REGEX, '')
    .replace(ADMIN_PASSWORD_DASH_VARIANTS_REGEX, '-')
    .replace(ADMIN_PASSWORD_PLUS_VARIANTS_REGEX, '+')
    .replace(ADMIN_PASSWORD_AT_VARIANTS_REGEX, '@')
    .replace(ADMIN_PASSWORD_CZ_NUMBER_ROW_REGEX, (ch) => ADMIN_PASSWORD_CZ_NUMBER_ROW_MAP[ch] || ch)
    .replace(/\s*([+-])\s*/g, '$1')
    .trim();
}

/**
 * Persistuje admin heslo i do cookie, aby fungovaly i iframe requesty
 * (např. /admin/preview), které neumí přidat custom header.
 * @param {string} value
 */
function setAdminPasswordCookie(value) {
  const encoded = encodeURIComponent(normalizeAdminPassword(value));
  document.cookie = `${ADMIN_PASSWORD_COOKIE_NAME}=${encoded}; path=/admin; SameSite=Lax; Secure`;
}

function clearAdminPasswordCookie() {
  document.cookie = `${ADMIN_PASSWORD_COOKIE_NAME}=; Max-Age=0; path=/admin; SameSite=Lax; Secure`;
  document.cookie = `${ADMIN_PASSWORD_COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Lax; Secure`;
}

/** @returns {string} */
function getAdminPassword() {
  try { return normalizeAdminPassword(sessionStorage.getItem(ADMIN_PASSWORD_STORAGE_KEY) || ''); } catch { return ''; }
}

/** @param {string} value */
function setAdminPassword(value) {
  const normalized = normalizeAdminPassword(value);
  try { sessionStorage.setItem(ADMIN_PASSWORD_STORAGE_KEY, normalized); } catch { /* noop */ }
  try { setAdminPasswordCookie(normalized); } catch { /* noop */ }
}

function clearAdminPassword() {
  try { sessionStorage.removeItem(ADMIN_PASSWORD_STORAGE_KEY); } catch { /* noop */ }
  try { clearAdminPasswordCookie(); } catch { /* noop */ }
}

/**
 * Vykreslí statickou obrazovku "Přístup odepřen"
 * a zastaví pollery na pozadí.
 * @param {string} [reason]
 */
function showAccessDenied(reason = 'Přístup odepřen.') {
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
      <button id="admin-login-retry-btn" style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        padding: 0 1.25rem;
        border: 0;
        border-radius: 10px;
        background-color: #3A4A3C;
        color: #FFFFFF;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        box-shadow: 0 4px 12px rgba(58, 74, 60, 0.08);
        transition: background-color 150ms ease;
        cursor: pointer;
      " onmouseover="this.style.backgroundColor='#2D3A2F'" onmouseout="this.style.backgroundColor='#3A4A3C'">
        Zadat heslo znovu
      </button>
    </div>
  `;
  const retryBtn = document.getElementById('admin-login-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      clearAdminPassword();
      window.location.reload();
    });
  }
}

// Zpřístupníme na window pro ostatní moduly a skripty
window.showAccessDenied = showAccessDenied;

/**
 * Zobrazí vlastní přihlašovací modal s maskovaným polem pro heslo.
 * Guard `_authPromptActive` zabraňuje vícenásobnému otevření při souběžných 401.
 * @param {boolean} isRetry — true = zobrazí chybovou hlášku "špatné heslo"
 */
function showPasswordModal(isRetry) {
  if (_authPromptActive) return;
  _authPromptActive = true;

  const overlay = document.createElement('div');
  overlay.id = 'admin-auth-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Přihlášení do administrace');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(4px)',
  ].join(';');

  overlay.innerHTML = `
    <div style="
      background:#FAF8F5;
      border-radius:16px;
      padding:2.5rem 2rem;
      width:min(360px,90vw);
      box-shadow:0 24px 60px rgba(0,0,0,0.22);
      font-family:'Montserrat',system-ui,sans-serif;
      color:#2B2B2B;
    ">
      <div style="font-size:2.5rem;text-align:center;margin-bottom:1rem">🔒</div>
      <h2 style="
        font-family:'Cormorant Garamond',Georgia,serif;
        font-size:1.6rem;font-weight:600;
        color:#3A4A3C;text-align:center;
        margin:0 0 0.5rem;
      ">Administrace</h2>
      <p style="font-size:0.82rem;color:#738A75;text-align:center;margin:0 0 1.5rem">
        Bicom Písek — Virtual Office
      </p>
      ${isRetry ? `<p id="auth-modal-error" style="
        font-size:0.82rem;color:#c0392b;background:#fff0ee;
        border-radius:8px;padding:0.5rem 0.75rem;
        margin:0 0 1rem;text-align:center;
      ">Heslo není správné. Zkuste znovu.</p>` : ''}
      <div style="position:relative;margin-bottom:1rem">
        <input id="auth-modal-pw" type="password"
          placeholder="Heslo"
          autocomplete="current-password"
          style="
            width:100%;box-sizing:border-box;
            padding:0.65rem 2.75rem 0.65rem 0.875rem;
            border:1.5px solid #d0d8d1;border-radius:10px;
            font-size:1rem;font-family:inherit;
            background:#fff;color:#2B2B2B;
            outline:none;transition:border-color 150ms;
          "
          onfocus="this.style.borderColor='#3A4A3C'"
          onblur="this.style.borderColor='#d0d8d1'"
        />
        <button id="auth-modal-eye" type="button" title="Zobrazit/skrýt heslo" style="
          position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);
          background:none;border:none;cursor:pointer;padding:0;
          font-size:1.1rem;color:#738A75;line-height:1;
        ">👁</button>
      </div>
      <button id="auth-modal-submit" type="button" style="
        display:block;width:100%;
        padding:0.7rem 1.25rem;
        background:#3A4A3C;color:#fff;
        border:none;border-radius:10px;
        font-size:0.9rem;font-weight:600;
        font-family:inherit;cursor:pointer;
        transition:background 150ms;margin-bottom:0.75rem;
      "
        onmouseover="this.style.background='#2D3A2F'"
        onmouseout="this.style.background='#3A4A3C'"
      >Přihlásit se</button>
      <button id="auth-modal-cancel" type="button" style="
        display:block;width:100%;
        padding:0.55rem;background:none;
        border:none;color:#738A75;font-size:0.82rem;
        font-family:inherit;cursor:pointer;
      ">Zrušit přihlášení</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const pwInput  = overlay.querySelector('#auth-modal-pw');
  const eyeBtn   = overlay.querySelector('#auth-modal-eye');
  const submitBtn = overlay.querySelector('#auth-modal-submit');
  const cancelBtn = overlay.querySelector('#auth-modal-cancel');

  eyeBtn.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
    eyeBtn.textContent = pwInput.type === 'password' ? '👁' : '🙈';
    pwInput.focus();
  });

  const doSubmit = () => {
    const normalized = normalizeAdminPassword(pwInput.value);
    if (!normalized) {
      let errEl = overlay.querySelector('#auth-modal-error');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.id = 'auth-modal-error';
        errEl.style.cssText = 'font-size:0.82rem;color:#c0392b;background:#fff0ee;border-radius:8px;padding:0.5rem 0.75rem;margin:0 0 1rem;text-align:center';
        pwInput.parentElement.before(errEl);
      }
      errEl.textContent = 'Zadejte heslo.';
      pwInput.focus();
      return;
    }
    setAdminPassword(normalized);
    _authPromptActive = false;
    overlay.remove();
    window.location.reload();
  };

  submitBtn.addEventListener('click', doSubmit);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSubmit(); });

  cancelBtn.addEventListener('click', () => {
    _authPromptActive = false;
    overlay.remove();
    clearAdminPassword();
    showAccessDenied('Přístup vyžaduje heslo.');
  });

  setTimeout(() => pwInput.focus(), 60);
}

/**
 * Centrální ošetření chyb přihlášení (401 a 403).
 * @param {number} status
 * @param {Response} [response]
 */
function handleAuthError(status, response) {
  if (status === 403) {
    console.warn('[api] 403 Forbidden - Access Denied.');
    showAccessDenied('Váš účet nemá přístup.');
    return;
  }
  if (status === 401) {
    const isRetry = !!getAdminPassword();
    showPasswordModal(isRetry);
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
  const adminPassword = getAdminPassword();
  if (adminPassword) {
    fetchHeaders['X-Admin-Password'] = adminPassword;
  }

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
          handleAuthError(response.status, response);
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
 * GET /admin/imagine — seznam AI vizuálních assetů.
 * @param {Object} [params]
 * @returns {Promise<ApiResponse>}
 */
function getAiAssets(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/imagine${qs ? '?' + qs : ''}`);
}

/**
 * GET /admin/imagine?view=jobs — přehled AI generovacích jobů.
 * @param {Object} [params]
 * @returns {Promise<ApiResponse>}
 */
function getAiJobs(params = {}) {
  const qp = new URLSearchParams({ view: 'jobs', ...params }).toString();
  return request(`/imagine?${qp}`);
}

/**
 * POST /admin/imagine — generování AI vizuálu.
 * @param {Object} data
 * @returns {Promise<ApiResponse>}
 */
function generateAiVisual(data) {
  return request('/imagine', { method: 'POST', body: data, timeout: 45000 });
}

/**
 * POST /admin/imagine {action:retry} — retry failed jobu.
 * @param {string} jobId
 * @returns {Promise<ApiResponse>}
 */
function retryAiJob(jobId) {
  return request('/imagine', { method: 'POST', body: { action: 'retry', job_id: jobId }, timeout: 45000 });
}

/**
 * PUT /admin/imagine — update metadata/status AI assetu.
 * @param {Object} data
 * @returns {Promise<ApiResponse>}
 */
function updateAiAsset(data) {
  return request('/imagine', { method: 'PUT', body: data });
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
/** POST /admin/gallery {action:publish}. @param {string} gallery_key @returns {Promise<ApiResponse>} */
function publishGallery(gallery_key) {
  return request('/gallery', { method: 'POST', body: { action: 'publish', gallery_key } });
}
/** POST /admin/gallery {action:discard}. @param {string} gallery_key @returns {Promise<ApiResponse>} */
function discardGallery(gallery_key) {
  return request('/gallery', { method: 'POST', body: { action: 'discard', gallery_key } });
}
/** DELETE /admin/gallery?id=&gallery_key= — smaže obrázek v konceptu. @param {string} id @param {string} gallery_key @returns {Promise<ApiResponse>} */
function deleteGalleryItem(id, gallery_key) {
  return request(`/gallery?id=${encodeURIComponent(id)}&gallery_key=${encodeURIComponent(gallery_key)}`, { method: 'DELETE' });
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
      headers: {
        Accept: 'application/json',
        ...(getAdminPassword() ? { 'X-Admin-Password': getAdminPassword() } : {}),
      },
    });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    if (res.status === 401 || res.status === 403) {
      handleAuthError(res.status, res);
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

/** GET /admin/services — seznam služeb (vč. has_draft). @returns {Promise<ApiResponse>} */
function getServicesAdmin() {
  return request('/services');
}
/** GET /admin/services?slug= — detail služby (živé + draft_json). @param {string} slug @returns {Promise<ApiResponse>} */
function getServiceAdmin(slug) {
  return request(`/services?slug=${encodeURIComponent(slug)}`);
}
/** POST /admin/services — vytvoří službu. @param {Object} body @returns {Promise<ApiResponse>} */
function createService(body) {
  return request('/services', { method: 'POST', body });
}
/** PUT /admin/services — uloží změnu služby jako koncept. @param {Object} body @returns {Promise<ApiResponse>} */
function saveServiceDraft(body) {
  return request('/services', { method: 'PUT', body });
}
/** POST /admin/services {action:publish}. @param {string} slug @returns {Promise<ApiResponse>} */
function publishService(slug) {
  return request('/services', { method: 'POST', body: { action: 'publish', slug } });
}
/** POST /admin/services {action:discard}. @param {string} slug @returns {Promise<ApiResponse>} */
function discardService(slug) {
  return request('/services', { method: 'POST', body: { action: 'discard', slug } });
}
/** DELETE /admin/services?slug=. @param {string} slug @returns {Promise<ApiResponse>} */
function deleteService(slug) {
  return request(`/services?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
}

// ─── CMS — pojmenované koncepty / verze (F12-D) ────────────────
/** GET /admin/drafts — seznam verzí entity. @param {string} entity @param {string} entityId @returns {Promise<ApiResponse>} */
function listDraftVersions(entity, entityId) {
  return request(`/drafts?entity=${encodeURIComponent(entity)}&entity_id=${encodeURIComponent(entityId)}`);
}
/** POST /admin/drafts — uloží/aktualizuje pojmenovanou verzi. @param {string} entity @param {string} entityId @param {string} name @param {Object} payload @returns {Promise<ApiResponse>} */
function saveDraftVersion(entity, entityId, name, payload) {
  return request('/drafts', { method: 'POST', body: { entity, entity_id: entityId, name, payload } });
}
/** POST /admin/drafts {action:load} — načte verzi do pracovního konceptu. @param {string} id @returns {Promise<ApiResponse>} */
function loadDraftVersion(id) {
  return request('/drafts', { method: 'POST', body: { action: 'load', id } });
}
/** PUT /admin/drafts — přejmenuje verzi. @param {string} id @param {string} name @returns {Promise<ApiResponse>} */
function renameDraftVersion(id, name) {
  return request('/drafts', { method: 'PUT', body: { id, name } });
}
/** DELETE /admin/drafts?id= — smaže verzi. @param {string} id @returns {Promise<ApiResponse>} */
function deleteDraftVersion(id) {
  return request(`/drafts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
  getAiAssets,
  getAiJobs,
  generateAiVisual,
  retryAiJob,
  updateAiAsset,
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
  publishGallery,
  discardGallery,
  deleteGalleryItem,
  uploadGalleryImage,
  getHeroes,
  getHero,
  saveHero,
  publishHero,
  discardHero,
  getServicesAdmin,
  getServiceAdmin,
  createService,
  saveServiceDraft,
  publishService,
  discardService,
  deleteService,
  listDraftVersions,
  saveDraftVersion,
  loadDraftVersion,
  renameDraftVersion,
  deleteDraftVersion,
};

// Také na window pro přístup z modulů
window.AdminAPI = AdminAPI;

export default AdminAPI;
