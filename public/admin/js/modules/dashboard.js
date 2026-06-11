/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Dashboard Module (Virtual Office Home)
 * ═══════════════════════════════════════════════════════════════
 * Hlavní přehledový modul:
 *   - KPI karty (poptávky, tržby, návštěvy, AI články)
 *   - Živý seznam čekajících poptávek
 *   - Quick Actions (rychlé akce)
 *   - Týdenní trend minigrafy
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Vykreslí dashboard do kontejneru.
 * @param {HTMLElement} container
 * @param {Object} ctx — { route, navigate, showToast, api }
 */
export async function render(container, ctx) {
  const { api, showToast, navigate } = ctx;

  // Skeleton loading state
  container.innerHTML = renderSkeleton();

  // Fetch dashboard data
  let data = null;
  let hasError = false;

  if (api) {
    const res = await api.getDashboard();
    if (res.ok) {
      data = res.data;
    } else {
      hasError = true;
      showToast('Nepodařilo se načíst přehled: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  } else {
    hasError = true;
    showToast('API klient není k dispozici.', 'error');
  }

  if (hasError || !data) {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">Přehled</h1>
        <p class="canvas-subtitle">Data se nepodařilo načíst</p>
      </div>
      <div class="card mt-6">
        <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">⚠️</div>
          <h4 class="empty-state-title">Data se nepodařilo načíst</h4>
          <p class="empty-state-text">Zkontrolujte připojení k databázi nebo zkuste stránku obnovit.</p>
        </div>
      </div>
    `;
    return;
  }

  // Render final dashboard
  container.innerHTML = renderDashboard(data);

  // Bind event listeners
  bindEvents(container, ctx, data);
}

/**
 * Cleanup při opuštění modulu.
 */
export function destroy() {
  // Žádný interval ani WebSocket — čistý modul
}

// ─── RENDERERS ──────────────────────────────────────────────────

function renderDashboard(data) {
  return `
    <div class="canvas-header">
      <h1 class="canvas-title">Přehled</h1>
      <p class="canvas-subtitle">Dobrý den ☀️ — zde je váš dnešní souhrn</p>
    </div>

    <!-- KPI karty -->
    <div class="grid-4 mb-6">
      ${renderKPI('Nové poptávky', data?.pendingBookings ?? 0, data?.pendingTrend ?? 0, 'tento týden', '📋')}
      ${renderKPI('Tržby', formatCurrency(data?.revenueWeek ?? 0), data?.revenueTrend ?? 0, 'tento týden', '💰')}
      ${renderKPI('Potvrzené', data?.confirmedBookings ?? 0, data?.confirmedTrend ?? 0, 'tento měsíc', '✅')}
      ${renderKPI('AI články', data?.aiArticles ?? 0, data?.aiTrend ?? 0, 'celkem v draftu', '🤖')}
    </div>

    <!-- Dva sloupce: Čekající poptávky + Quick Actions -->
    <div class="grid-2 gap-6">
      <!-- Čekající poptávky -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Čekající poptávky</h3>
          <button class="btn btn-ghost btn-sm" id="btn-view-all-bookings">Zobrazit vše</button>
        </div>
        <div class="card-body">
          ${(data?.recentBookings?.length ?? 0) > 0
            ? renderBookingsList(data.recentBookings ?? [])
            : renderEmptyBookings()
          }
        </div>
      </div>

      <!-- Quick Actions + Geo Highlights -->
      <div class="flex flex-col gap-6">
        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Rychlé akce</h3>
          </div>
          <div class="card-body">
            <div class="quick-actions">
              ${renderQuickAction('calendar-plus', 'Nový termín', 'Přidat volný slot do kalendáře', 'btn-quick-slot')}
              ${renderQuickAction('pen-tool', 'AI článek', 'Nechat AI navrhnout blog post', 'btn-quick-ai')}
              ${renderQuickAction('receipt', 'Faktura', 'Vystavit novou fakturu', 'btn-quick-invoice')}
              ${renderQuickAction('send', 'Newsletter', 'Odeslat kampaň odběratelům', 'btn-quick-newsletter')}
            </div>
          </div>
        </div>

        <!-- GEO Highlights -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">GEO přehled</h3>
            <span class="badge badge-new">Live</span>
          </div>
          <div class="card-body">
            ${renderGeoHighlights(data?.topCities ?? [])}
          </div>
        </div>
      </div>
    </div>

    <!-- Systémový stav -->
    <div class="card mt-6">
      <div class="card-header">
        <h3 class="card-title">Systémový stav</h3>
        <span class="card-subtitle">Poslední kontrola: právě teď</span>
      </div>
      <div class="card-body">
        <div class="system-grid">
          ${renderSystemStatus('Databáze D1', data?.system?.d1 ?? 'standby')}
          ${renderSystemStatus('Úložiště R2', data?.system?.r2 ?? 'standby')}
          ${renderSystemStatus('Cache KV', data?.system?.kv ?? 'standby')}
          ${renderSystemStatus('Telegram Bot', data?.system?.telegram ?? 'standby')}
          ${renderSystemStatus('Google Calendar', data?.system?.calendar ?? 'standby')}
          ${renderSystemStatus('iDoklad', data?.system?.idoklad ?? 'standby')}
        </div>
      </div>
    </div>
  `;
}

function renderKPI(label, value, trend, trendLabel, icon) {
  const trendClass = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  const trendSign = trend > 0 ? '+' : '';
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';

  return `
    <div class="card kpi-card">
      <div style="font-size: 1.5rem; margin-bottom: var(--sp-2);">${icon}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-trend ${trendClass}">
        ${trendIcon} ${trendSign}${trend}% ${escapeHtml(trendLabel)}
      </div>
    </div>`;
}

function renderBookingsList(bookings) {
  const rows = bookings.map((b) => {
    const statusBadge = {
      pending:   '<span class="badge badge-pending">Čeká</span>',
      confirmed: '<span class="badge badge-confirmed">Potvrzeno</span>',
      done:      '<span class="badge badge-done">Dokončeno</span>',
      cancelled: '<span class="badge badge-cancelled">Zrušeno</span>',
    };

    return `
      <tr data-booking-id="${escapeAttr(b.id)}">
        <td><strong>${escapeHtml(b.name || '(šifrováno)')}</strong></td>
        <td>${escapeHtml(b.service)}</td>
        <td>${formatDate(b.preferred_date)}</td>
        <td>${statusBadge[b.status] || ''}</td>
        <td>
          <button class="btn btn-champagne btn-sm btn-confirm-booking"
                  data-id="${escapeAttr(b.id)}" title="Potvrdit termín">
            Potvrdit
          </button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Klient</th>
            <th>Služba</th>
            <th>Požadovaný termín</th>
            <th>Stav</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderEmptyBookings() {
  return `
    <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
      <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">🌿</div>
      <h4 class="empty-state-title">Žádné čekající poptávky</h4>
      <p class="empty-state-text">Skvělé — vše je pod kontrolou. Nové poptávky se zobrazí automaticky.</p>
    </div>`;
}

function renderQuickAction(icon, title, description, id) {
  return `
    <button class="quick-action-btn" id="${id}">
      <div class="quick-action-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          ${getQuickActionIconPath(icon)}
        </svg>
      </div>
      <div class="quick-action-text">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </div>
    </button>`;
}

function getQuickActionIconPath(icon) {
  const paths = {
    'calendar-plus': '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/>',
    'pen-tool': '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"/><path d="M8 10h8"/><path d="M8 14h4"/>',
    'send': '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  };
  return paths[icon] || '';
}

function renderGeoHighlights(cities) {
  const cityList = cities ?? [];
  if (cityList.length === 0) {
    return '<p class="text-sage" style="font-size: var(--text-sm);">GEO data budou dostupná po prvních poptávkách.</p>';
  }

  const maxCount = Math.max(...cityList.map((c) => c.count || 0), 1);

  return cityList.map((city) => {
    const pct = Math.round(((city.count || 0) / maxCount) * 100);
    return `
      <div class="geo-bar-item">
        <div class="flex justify-between items-center mb-2">
          <span style="font-size: var(--text-sm); font-weight: 500;">${escapeHtml(city.name || '')}</span>
          <span style="font-size: var(--text-xs); color: var(--c-sage);">${city.count || 0} poptávek</span>
        </div>
        <div class="geo-bar">
          <div class="geo-bar-fill" style="width: ${pct}%;"></div>
        </div>
      </div>`;
  }).join('');
}

function renderSystemStatus(label, status) {
  const configs = {
    ok:      { dot: 'online',  text: 'Online',    color: 'var(--c-success)' },
    standby: { dot: 'warning', text: 'Standby',   color: 'var(--c-warning)' },
    error:   { dot: 'offline', text: 'Nedostupné', color: 'var(--c-error)' },
  };
  const cfg = configs[status] || configs.standby;

  return `
    <div class="system-status-item">
      <span class="statusbar-dot ${cfg.dot}" style="animation: none;"></span>
      <span style="font-size: var(--text-sm);">${escapeHtml(label)}</span>
      <span style="font-size: var(--text-xs); color: ${cfg.color}; margin-left: auto;">${cfg.text}</span>
    </div>`;
}

function renderSkeleton() {
  return `
    <div class="canvas-header">
      <div class="skeleton" style="width: 200px; height: 32px; margin-bottom: var(--sp-2);"></div>
      <div class="skeleton" style="width: 300px; height: 16px;"></div>
    </div>
    <div class="grid-4 mb-6">
      ${Array(4).fill('<div class="card kpi-card"><div class="skeleton" style="width: 80px; height: 40px; margin: 0 auto var(--sp-2);"></div><div class="skeleton" style="width: 120px; height: 14px; margin: 0 auto;"></div></div>').join('')}
    </div>
    <div class="grid-2 gap-6">
      <div class="card"><div class="skeleton" style="width: 100%; height: 200px;"></div></div>
      <div class="card"><div class="skeleton" style="width: 100%; height: 200px;"></div></div>
    </div>`;
}

// ─── EVENT BINDINGS ─────────────────────────────────────────────

function bindEvents(container, ctx, data) {
  // View all bookings
  const viewAllBtn = container.querySelector('#btn-view-all-bookings');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => ctx.navigate('/kalendar'));
  }

  // Quick actions
  const quickSlot = container.querySelector('#btn-quick-slot');
  if (quickSlot) {
    quickSlot.addEventListener('click', () => ctx.navigate('/kalendar'));
  }

  const quickAI = container.querySelector('#btn-quick-ai');
  if (quickAI) {
    quickAI.addEventListener('click', () => ctx.navigate('/blog'));
  }

  const quickInvoice = container.querySelector('#btn-quick-invoice');
  if (quickInvoice) {
    quickInvoice.addEventListener('click', () => ctx.navigate('/fakturace'));
  }

  const quickNewsletter = container.querySelector('#btn-quick-newsletter');
  if (quickNewsletter) {
    quickNewsletter.addEventListener('click', () => {
      ctx.showToast('Newsletter modul bude brzy dostupný', 'info');
    });
  }

  // Confirm booking buttons
  container.querySelectorAll('.btn-confirm-booking').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const bookingId = btn.dataset.id;
      if (!bookingId) return;

      btn.disabled = true;
      btn.textContent = 'Potvrzuji…';

      if (ctx.api) {
        const res = await ctx.api.updateBooking(bookingId, { status: 'confirmed' });
        if (res.ok) {
          ctx.showToast('Rezervace potvrzena ✓', 'success');
          // Refresh dashboard
          const canvas = document.getElementById('admin-canvas-content');
          if (canvas) render(canvas, ctx);
        } else {
          ctx.showToast('Chyba: ' + (res.error || 'Nepodařilo se potvrdit'), 'error');
          btn.disabled = false;
          btn.textContent = 'Potvrdit';
        }
      } else {
        ctx.showToast('API není dostupné (demo režim)', 'warning');
        btn.disabled = false;
        btn.textContent = 'Potvrdit';
      }
    });
  });
}

// ─── UTILITIES ──────────────────────────────────────────────────

function formatCurrency(amount) {
  if (typeof amount !== 'number') return '0 Kč';
  return amount.toLocaleString('cs-CZ') + ' Kč';
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  return new Date(isoDate).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

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
