/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Calendar Module (Kalendář)
 * ═══════════════════════════════════════════════════════════════
 */

export async function render(container, ctx) {
  const { api, showToast } = ctx;

  container.innerHTML = renderSkeleton();

  let bookings = [];
  let hasError = false;

  if (api) {
    const res = await api.getBookings({ limit: 50 });
    if (res.ok) {
      bookings = res.data?.bookings ?? [];
    } else {
      hasError = true;
      showToast('Nepodařilo se načíst rezervace: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  } else {
    bookings = [];
  }

  if (hasError) {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">Kalendář</h1>
        <p class="canvas-subtitle">Data se nepodařilo načíst</p>
      </div>
      <div class="card">
        <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">⚠️</div>
          <h4 class="empty-state-title">Chyba stahování dat</h4>
          <p class="empty-state-text">Nepodařilo se navázat spojení s databází rezervací.</p>
        </div>
      </div>
    `;
    return;
  }

  const pending = bookings.filter((b) => b.status === 'pending');
  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const done = bookings.filter((b) => b.status === 'done');

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Kalendář</h1>
      <p class="canvas-subtitle">Správa rezervací a termínů obou operátorek</p>
    </div>

    <!-- Filtrační záložky -->
    <div class="flex gap-4 mb-6">
      <button class="btn btn-primary btn-sm tab-btn active" data-filter="all">Vše (${bookings.length})</button>
      <button class="btn btn-ghost btn-sm tab-btn" data-filter="pending">Čekající (${pending.length})</button>
      <button class="btn btn-ghost btn-sm tab-btn" data-filter="confirmed">Potvrzené (${confirmed.length})</button>
      <button class="btn btn-ghost btn-sm tab-btn" data-filter="done">Dokončené (${done.length})</button>
    </div>

    <!-- Tabulka -->
    <div class="card">
      <div class="card-body">
        ${renderBookingsTable(bookings)}
      </div>
    </div>
  `;

  // Tab filtering
  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('active', 'btn-primary');
        b.classList.add('btn-ghost');
      });
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-ghost');

      const filter = btn.dataset.filter;
      container.querySelectorAll('.booking-row').forEach((row) => {
        row.style.display = (filter === 'all' || row.dataset.status === filter) ? '' : 'none';
      });
    });
  });

  // Action buttons
  container.querySelectorAll('.btn-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { id, action } = btn.dataset;
      btn.disabled = true;
      btn.textContent = 'Zpracovávám…';
      if (api) {
        const res = await api.updateBooking(id, { status: action });
        if (res.ok) {
          showToast(action === 'confirmed' ? 'Potvrzeno ✓' : 'Zrušeno', action === 'confirmed' ? 'success' : 'warning');
          render(container, ctx);
          return;
        }
        showToast('Chyba: ' + res.error, 'error');
      } else {
        showToast('Demo režim — API nedostupné', 'info');
      }
      btn.disabled = false;
    });
  });
}

export function destroy() {}

function renderBookingsTable(bookings) {
  if (bookings.length === 0) {
    return '<div class="empty-state"><h4 class="empty-state-title">Žádné rezervace</h4></div>';
  }
  const rows = bookings.map((b) => {
    const badge = { pending: 'badge-pending', confirmed: 'badge-confirmed', done: 'badge-done', cancelled: 'badge-cancelled' };
    const label = { pending: 'Čeká', confirmed: 'Potvrzeno', done: 'Dokončeno', cancelled: 'Zrušeno' };
    const actions = b.status === 'pending' ? `
      <button class="btn btn-champagne btn-sm btn-action" data-id="${esc(b.id)}" data-action="confirmed">Potvrdit</button>
      <button class="btn btn-ghost btn-sm btn-action" data-id="${esc(b.id)}" data-action="cancelled">Zrušit</button>
    ` : '';
    return `<tr class="booking-row" data-status="${b.status}">
      <td><strong>${esc(b.name || '(šifrováno)')}</strong></td>
      <td>${esc(b.service)}</td>
      <td>${fmtDate(b.preferred_date)}</td>
      <td><span class="badge ${badge[b.status] || ''}">${label[b.status] || b.status}</span></td>
      <td>${actions}</td>
    </tr>`;
  }).join('');

  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Klient</th><th>Služba</th><th>Termín</th><th>Stav</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function renderSkeleton() {
  return '<div class="canvas-header"><div class="skeleton" style="width:200px;height:32px;"></div></div><div class="card"><div class="skeleton" style="width:100%;height:300px;"></div></div>';
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }); }
