/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin SPA Router
 * ═══════════════════════════════════════════════════════════════
 * Vanilla JS router s History API.
 * Každá "stránka" = modul v /admin/js/modules/{name}.js
 * Router řeší:
 *   - definici routes
 *   - lazy-loading modulů
 *   - přechody s animací
 *   - aktualizaci sidebar active state
 *   - breadcrumb aktualizaci
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Route
 * @property {string} path       — URL cesta (bez /admin prefix)
 * @property {string} title      — Název stránky (čeština)
 * @property {string} icon       — Lucide ikona (identifikátor)
 * @property {string} moduleId   — Identifikátor modulu pro lazy-load
 * @property {Function} [render] — Funkce render(container, ctx) — vyplní se lazy
 */

/** @type {Route[]} */
const ROUTES = [
  {
    path: '/',
    title: 'Přehled',
    icon: 'layout-dashboard',
    moduleId: 'dashboard',
  },
  {
    path: '/kalendar',
    title: 'Kalendář',
    icon: 'calendar-days',
    moduleId: 'calendar',
  },
  {
    path: '/blog',
    title: 'Blog & AI',
    icon: 'pen-tool',
    moduleId: 'blog',
  },
  {
    path: '/fakturace',
    title: 'Fakturace',
    icon: 'receipt',
    moduleId: 'invoices',
  },
  {
    path: '/zpravy',
    title: 'Zprávy',
    icon: 'message-square',
    moduleId: 'messages',
  },
  {
    path: '/geo-marketing',
    title: 'GEO-Marketing',
    icon: 'map-pin',
    moduleId: 'geo',
  },
  {
    path: '/nastaveni',
    title: 'Nastavení',
    icon: 'settings',
    moduleId: 'settings',
  },
];

// Prefix pro admin routes
const BASE_PATH = '/admin';

// Cache pro lazy-loaded moduly
const moduleCache = new Map();

/**
 * Najde route dle aktuální URL.
 * @param {string} pathname
 * @returns {Route|null}
 */
function matchRoute(pathname) {
  // Odstraň base path
  let path = pathname.replace(BASE_PATH, '') || '/';
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return ROUTES.find((r) => r.path === path) || null;
}

/**
 * Lazy-load modul. Každý modul exportuje `render(container, ctx)` a
 * volitelně `destroy()` pro cleanup.
 * @param {string} moduleId
 * @returns {Promise<{render: Function, destroy?: Function}>}
 */
async function loadModule(moduleId) {
  if (moduleCache.has(moduleId)) {
    return moduleCache.get(moduleId);
  }

  try {
    const mod = await import(`./modules/${moduleId}.js`);
    moduleCache.set(moduleId, mod);
    return mod;
  } catch (err) {
    console.error(`[router] Failed to load module "${moduleId}":`, err);
    return {
      render(container) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24"
                   fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 class="empty-state-title">Modul není dostupný</h3>
            <p class="empty-state-text">
              Modul „${moduleId}" se nepodařilo načíst.
              Zkontrolujte konzoli prohlížeče.
            </p>
          </div>`;
      },
    };
  }
}

// Referát na aktuálně aktivní modul (pro destroy lifecycle)
let activeModule = null;

/**
 * Naviguje na danou cestu.
 * @param {string} path — cesta relativní k /admin (např. '/kalendar')
 * @param {boolean} [pushState=true] — zda přidat do history
 */
async function navigate(path, pushState = true) {
  const fullPath = BASE_PATH + (path === '/' ? '' : path);
  const route = matchRoute(fullPath);

  if (!route) {
    console.warn(`[router] No route found for "${path}", redirecting to /`);
    navigate('/', pushState);
    return;
  }

  // Cleanup předchozího modulu
  if (activeModule && typeof activeModule.destroy === 'function') {
    try {
      activeModule.destroy();
    } catch (err) {
      console.error('[router] Module destroy error:', err);
    }
  }

  // Update URL
  if (pushState) {
    history.pushState({ path }, '', fullPath);
  }

  // Update browser title
  document.title = `${route.title} — Bicom Písek Virtual Office`;

  // Update sidebar active state
  updateSidebarActive(route.path);

  // Update breadcrumb
  updateBreadcrumb(route.title);

  // Get canvas container
  const canvas = document.getElementById('admin-canvas-content');
  if (!canvas) return;

  // Fade out
  canvas.style.opacity = '0';
  canvas.style.transform = 'translateY(4px)';

  // Wait for transition
  await new Promise((r) => setTimeout(r, 150));

  // Load and render module
  const mod = await loadModule(route.moduleId);
  canvas.innerHTML = '';

  // Build context for modules
  const ctx = {
    route,
    navigate,
    showToast,
    api: window.AdminAPI || null,
  };

  try {
    await mod.render(canvas, ctx);
    activeModule = mod;
  } catch (err) {
    console.error(`[router] Error rendering module "${route.moduleId}":`, err);
    canvas.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Chyba při vykreslování</h3>
        <p class="empty-state-text">${escapeHtml(err.message)}</p>
      </div>`;
  }

  // Fade in
  requestAnimationFrame(() => {
    canvas.style.transition = 'opacity 250ms cubic-bezier(0.22,1,0.36,1), transform 250ms cubic-bezier(0.22,1,0.36,1)';
    canvas.style.opacity = '1';
    canvas.style.transform = 'translateY(0)';
  });
}

/**
 * Aktualizuje active třídu na sidebar odkazech.
 * @param {string} routePath
 */
function updateSidebarActive(routePath) {
  const links = document.querySelectorAll('.sidebar-link[data-path]');
  links.forEach((link) => {
    const linkPath = link.getAttribute('data-path');
    link.classList.toggle('active', linkPath === routePath);
  });
}

/**
 * Aktualizuje breadcrumb text v topbaru.
 * @param {string} title
 */
function updateBreadcrumb(title) {
  const el = document.getElementById('topbar-breadcrumb-title');
  if (el) {
    el.textContent = title;
  }
}

/**
 * Zobrazí toast notifikaci.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 * @param {number} [duration=4000]
 */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Zavřít" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;

  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    toast.style.transition = 'all 300ms cubic-bezier(0.22,1,0.36,1)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Sanitizuje string pro bezpečný HTML výstup.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

/**
 * Inicializace routeru: zaregistruje event listenery.
 */
function initRouter() {
  // Handle popstate (back/forward)
  window.addEventListener('popstate', (e) => {
    const state = e.state;
    if (state && state.path) {
      navigate(state.path, false);
    } else {
      navigate('/', false);
    }
  });

  // Intercept sidebar link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.sidebar-link[data-path]');
    if (link) {
      e.preventDefault();
      const path = link.getAttribute('data-path');
      navigate(path);
    }
  });

  // Initial route
  const initialPath = location.pathname.replace(BASE_PATH, '') || '/';
  navigate(initialPath, false);
}

// Public API
export { ROUTES, navigate, showToast, initRouter };
