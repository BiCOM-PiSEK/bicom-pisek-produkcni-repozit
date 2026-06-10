/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Admin App (inicializace Virtual Office)
 * ═══════════════════════════════════════════════════════════════
 * Vstupní bod admin SPA. Řeší:
 *   - Inicializaci routeru
 *   - Sidebar toggle (rozbalení/sbalení)
 *   - Activity feed polling
 *   - Status bar živé aktualizace
 *   - Mobilní sidebar overlay
 *   - Keyboard shortcuts
 * ═══════════════════════════════════════════════════════════════
 */

import { initRouter, navigate, showToast } from './router.js';
import AdminAPI from './api.js';

// ─── STATE ──────────────────────────────────────────────────────
const state = {
  sidebarCollapsed: false,
  activityHidden: false,
  mobileMenuOpen: false,
  activityPollTimer: null,
  statusPollTimer: null,
};

// ─── DOM HELPERS ────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── SIDEBAR CONTROLS ──────────────────────────────────────────

/**
 * Toggle sidebar collapse/expand.
 */
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const shell = $('.admin-shell');
  shell.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);

  // Persist preference
  try {
    localStorage.setItem('bicom-admin-sidebar', state.sidebarCollapsed ? 'collapsed' : 'expanded');
  } catch { /* noop */ }

  updateToggleButtons();
}

/**
 * Toggle activity panel visibility.
 */
function toggleActivity() {
  state.activityHidden = !state.activityHidden;
  const shell = $('.admin-shell');
  shell.classList.toggle('activity-hidden', state.activityHidden);

  try {
    localStorage.setItem('bicom-admin-activity', state.activityHidden ? 'hidden' : 'visible');
  } catch { /* noop */ }

  updateToggleButtons();
}

/**
 * Toggle mobile sidebar overlay.
 */
function toggleMobileMenu() {
  state.mobileMenuOpen = !state.mobileMenuOpen;
  const sidebar = $('.admin-sidebar');
  const overlay = $('#mobile-overlay');

  sidebar.classList.toggle('mobile-open', state.mobileMenuOpen);
  if (overlay) {
    overlay.classList.toggle('active', state.mobileMenuOpen);
  }
}

/**
 * Update visual states (aria-pressed and active class) of toggle buttons.
 */
function updateToggleButtons() {
  const activityBtn = $('#btn-toggle-activity');
  if (activityBtn) {
    const isActive = !state.activityHidden;
    activityBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    activityBtn.classList.toggle('active', isActive);
  }

  const sidebarBtn = $('#btn-toggle-sidebar');
  if (sidebarBtn) {
    const isActive = state.sidebarCollapsed;
    sidebarBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    sidebarBtn.classList.toggle('active', isActive);
  }
}

// ─── ACTIVITY FEED ──────────────────────────────────────────────

/**
 * Načte a vykreslí activity feed z API.
 */
async function refreshActivityFeed() {
  const stream = $('#activity-stream');
  if (!stream) return;

  const res = await AdminAPI.getActivityFeed(30);

  if (!res.ok || !res.data?.items) {
    // Při chybě ponechej stávající obsah, nemazej
    return;
  }

  const items = res.data.items;

  // Pokud nejsou nové položky, neupravuj DOM
  const currentFirst = stream.querySelector('.activity-item')?.dataset?.id;
  if (currentFirst && items[0]?.id === currentFirst) return;

  stream.innerHTML = items.map(renderActivityItem).join('');
}

/**
 * Vykreslí jednu položku activity feed.
 * @param {Object} item
 * @returns {string} HTML
 */
function renderActivityItem(item) {
  const typeConfig = {
    booking:  { icon: '📋', css: 'booking' },
    invoice:  { icon: '💰', css: 'invoice' },
    system:   { icon: '⚙️', css: 'system' },
    alert:    { icon: '⚠️', css: 'alert' },
    error:    { icon: '❌', css: 'error' },
    ai:       { icon: '🤖', css: 'ai' },
  };

  const config = typeConfig[item.type] || typeConfig.system;
  const time = formatRelativeTime(item.created_at);

  return `
    <div class="activity-item" data-id="${escapeAttr(item.id)}">
      <div class="activity-icon ${config.css}">${config.icon}</div>
      <div class="activity-body">
        <div class="activity-text">${escapeHtml(item.message)}</div>
        <div class="activity-time">${time}</div>
      </div>
    </div>`;
}

/**
 * Formátuje datum do relativního času (česky).
 * @param {string} isoDate
 * @returns {string}
 */
function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'právě teď';
  if (diffMin < 60) return `před ${diffMin} min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `před ${diffHrs} h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'včera';
  if (diffDays < 7) return `před ${diffDays} dny`;
  return new Date(isoDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── STATUS BAR ─────────────────────────────────────────────────

/**
 * Aktualizuje status bar s živými daty.
 */
async function refreshStatusBar() {
  const pendingEl = $('#status-pending');
  const revenueEl = $('#status-revenue');
  const d1StatusEl = $('#status-d1');

  // Jednoduchý health check
  try {
    const healthRes = await fetch('/api/health');
    const health = await healthRes.json();

    if (d1StatusEl) {
      const dot = d1StatusEl.querySelector('.statusbar-dot');
      if (dot) {
        dot.className = `statusbar-dot ${health.checks?.d1 === 'ok' ? 'online' : 'offline'}`;
      }
      const label = d1StatusEl.querySelector('.statusbar-label');
      if (label) {
        label.textContent = health.checks?.d1 === 'ok' ? 'D1 online' : 'D1 offline';
      }
    }
  } catch {
    // Silently fail — status bar is non-critical
  }

  // Dashboard data pro pending / revenue
  try {
    const res = await AdminAPI.getDashboard();
    if (res.ok && res.data) {
      if (pendingEl) {
        pendingEl.textContent = `${res.data.pendingBookings || 0} čeká`;
      }
      if (revenueEl) {
        const rev = res.data.revenueToday || 0;
        revenueEl.textContent = `${rev.toLocaleString('cs-CZ')} Kč dnes`;
      }
    }
  } catch { /* noop */ }
}

/**
 * Načte informace o přihlášeném operátorovi a aktualizuje sidebar.
 */
async function loadOperatorInfo() {
  const nameEl = $('#operator-name');
  const roleEl = $('#operator-role');
  const avatarEl = $('#operator-avatar');

  try {
    const res = await AdminAPI.getMe();
    if (res.ok && res.data?.operator) {
      const op = res.data.operator;
      if (nameEl && op.name) {
        nameEl.textContent = op.name;
      }
      if (roleEl && (op.role || op.email)) {
        roleEl.textContent = op.role || op.email;
      }
      if (avatarEl && op.name) {
        avatarEl.textContent = op.name.charAt(0).toUpperCase();
        avatarEl.title = `${op.name} (${op.email || ''})`;
      }
    }
  } catch (err) {
    console.error('[app] Failed to load operator info:', err);
  }
}

// ─── KEYBOARD SHORTCUTS ─────────────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + B → toggle sidebar
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggleSidebar();
    }

    // Cmd/Ctrl + K → focus search (future)
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      showToast('Vyhledávání bude dostupné brzy', 'info');
    }

    // Escape → close mobile menu
    if (e.key === 'Escape' && state.mobileMenuOpen) {
      toggleMobileMenu();
    }

    // Number keys 1-8 → navigate (with Alt)
    if (e.altKey && e.key >= '1' && e.key <= '8') {
      e.preventDefault();
      const routes = ['/', '/kalendar', '/blog', '/fakturace', '/platby', '/zpravy', '/geo-marketing', '/nastaveni'];
      const idx = parseInt(e.key) - 1;
      if (routes[idx]) navigate(routes[idx]);
    }
  });
}

// ─── UTILITIES ──────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ─── INIT ───────────────────────────────────────────────────────

function init() {
  // Restore sidebar preference
  try {
    const pref = localStorage.getItem('bicom-admin-sidebar');
    if (pref === 'collapsed') {
      state.sidebarCollapsed = true;
      $('.admin-shell')?.classList.add('sidebar-collapsed');
    }

    let actPref = localStorage.getItem('bicom-admin-activity');
    if (!actPref && window.innerWidth <= 1280) {
      actPref = 'hidden';
    }
    if (actPref === 'hidden') {
      state.activityHidden = true;
      $('.admin-shell')?.classList.add('activity-hidden');
    }
  } catch { /* noop */ }

  // Register click handlers
  const toggleSidebarBtn = $('#btn-toggle-sidebar');
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
  }

  const toggleActivityBtn = $('#btn-toggle-activity');
  if (toggleActivityBtn) {
    toggleActivityBtn.addEventListener('click', toggleActivity);
  }

  const mobileMenuBtn = $('#btn-mobile-menu');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }

  const mobileOverlay = $('#mobile-overlay');
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', toggleMobileMenu);
  }

  const notificationsBtn = $('#btn-notifications');
  if (notificationsBtn) {
    notificationsBtn.setAttribute('title', 'Připravujeme');
    notificationsBtn.addEventListener('click', () => {
      showToast('Centrum oznámení připravujeme', 'info');
    });
  }

  // Close mobile menu on route change
  document.addEventListener('click', (e) => {
    if (e.target.closest('.sidebar-link') && state.mobileMenuOpen) {
      toggleMobileMenu();
    }
  });

  // Load operator profile info
  loadOperatorInfo();

  // Init keyboard shortcuts
  initKeyboardShortcuts();

  // Init router
  initRouter();

  // Start activity feed polling (every 30s)
  refreshActivityFeed();
  state.activityPollTimer = setInterval(refreshActivityFeed, 30000);

  // Start status bar polling (every 60s)
  refreshStatusBar();
  state.statusPollTimer = setInterval(refreshStatusBar, 60000);

  // Update initial visual states for toggle buttons
  updateToggleButtons();

  console.log(
    '%c🌿 Bicom Písek — Virtual Office',
    'color: #738A75; font-size: 14px; font-weight: bold; font-family: "Cormorant Garamond", Georgia, serif;'
  );
  console.log(
    '%cQuiet Luxury Admin v1.0',
    'color: #C5A880; font-size: 11px; font-family: Montserrat, system-ui;'
  );
}

/**
 * Zastaví pollery na pozadí (activity feed a status bar).
 */
function stopPollers() {
  if (state.activityPollTimer) {
    clearInterval(state.activityPollTimer);
    state.activityPollTimer = null;
    console.log('[app] Activity feed poller stopped.');
  }
  if (state.statusPollTimer) {
    clearInterval(state.statusPollTimer);
    state.statusPollTimer = null;
    console.log('[app] Status bar poller stopped.');
  }
}

// Zpřístupníme na window pro centrální Access Denied handler
window.stopPollers = stopPollers;

// Spuštění po DOM loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { toggleSidebar, toggleActivity, toggleMobileMenu, stopPollers };

