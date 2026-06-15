/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Calendar Module (Kalendář)
 * ═══════════════════════════════════════════════════════════════
 * FE-1: Admin bookings management — statuses, buttons, modals
 */

let clickController = null;

/**
 * Loads bookings, renders calendar tabs and table, attaches delegated event listeners.
 * Handles Confirm, Cancel, Delete, Detail actions via modals.
 * @async
 * @param {Element} container - DOM element to render into
 * @param {Object} ctx - Router context { api, showToast }
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;

  // Abort previous click listeners to prevent stacking
  if (clickController) clickController.abort();
  clickController = new AbortController();

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

  // Delegated listeners pro všechny akce (Potvrdit, Přesunout, Zrušit, Smazat, Detail)
  container.addEventListener('click', async (e) => {
    const confirmBtn = e.target.closest('[data-action="confirmed"]');
    const rescheduleBtn = e.target.closest('[data-action="reschedule"]');
    const cancelBtn = e.target.closest('[data-action="cancel"]');
    const deleteBtn = e.target.closest('[data-action="delete"]');
    const detailBtn = e.target.closest('[data-action="detail"]');

    if (confirmBtn) {
      const id = confirmBtn.dataset.id;
      const originalText = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Zpracovávám…';

      const res = await api.updateBooking(id, { status: 'confirmed' });
      if (res.ok) {
        showToast('Potvrzeno ✓', 'success');
        render(container, ctx);
        return;
      }

      showToast('Chyba: ' + res.error, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }

    if (rescheduleBtn) {
      const id = rescheduleBtn.dataset.id;
      const booking = findBookingById(bookings, id);
      if (booking) {
        showRescheduleModal(booking, api, showToast, container, ctx);
      }
    }

    if (cancelBtn) {
      const id = cancelBtn.dataset.id;
      const booking = findBookingById(bookings, id);
      if (booking) {
        showCancelModal(booking, api, showToast, container, ctx);
      }
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const booking = findBookingById(bookings, id);
      if (booking) {
        showDeleteModal(booking, api, showToast, container, ctx);
      }
    }

    if (detailBtn) {
      const id = detailBtn.dataset.id;
      showDetailModal(id, api, showToast);
    }
  }, { signal: clickController.signal });
}

export function destroy() {}

/**
 * Renders table rows for all bookings with status-specific action buttons.
 * @param {Array} bookings - Array of booking objects
 * @returns {string} HTML table markup
 */
function renderBookingsTable(bookings) {
  if (bookings.length === 0) {
    return '<div class="empty-state"><h4 class="empty-state-title">Žádné rezervace</h4></div>';
  }
  const rows = bookings.map((b) => {
    const badge = { pending: 'badge-pending', confirmed: 'badge-confirmed', done: 'badge-done', cancelled: 'badge-cancelled' };
    const label = { pending: 'Čeká', confirmed: 'Potvrzeno', done: 'Dokončeno', cancelled: 'Zrušeno' };

    let actions = '';

    if (b.status === 'pending') {
      actions = `
        <button class="btn btn-champagne btn-sm" data-id="${esc(b.id)}" data-action="confirmed">Potvrdit</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="reschedule">Přesunout</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="cancel">Zrušit</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="detail">Detail</button>
      `;
    } else if (b.status === 'confirmed') {
      actions = `
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="reschedule">Přesunout</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="cancel">Zrušit</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="detail">Detail</button>
      `;
    } else if (b.status === 'cancelled' || b.status === 'done') {
      actions = `
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="detail">Detail</button>
        <button class="btn btn-ghost btn-sm" data-id="${esc(b.id)}" data-action="delete">Smazat</button>
      `;
    }

    return `<tr class="booking-row" data-status="${b.status}">
      <td><strong>${esc(b.name || '(šifrováno)')}</strong></td>
      <td>${esc(b.service)}</td>
      <td>${fmtDate(b.preferred_date)}</td>
      <td><span class="badge ${badge[b.status] || ''}">${label[b.status] || b.status}</span></td>
      <td style="display: flex; gap: var(--sp-2); flex-wrap: wrap;">${actions}</td>
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

/**
 * Formats ISO date to Czech locale (DD. MMM YYYY), or '—' if empty.
 * @param {string} d - ISO date string
 * @returns {string} Formatted date or placeholder
 */
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }); }

/**
 * Formats datetime (ISO or SQLite format) to Czech locale (DD. MMM YYYY HH:MM), or '—' if empty.
 * Handles both ISO 8601 and SQLite "YYYY-MM-DD HH:mm:ss" formats.
 * @param {string} d - Datetime string (ISO or SQLite)
 * @returns {string} Formatted datetime or placeholder
 */
function fmtDateTime(d) {
  if (!d) return '—';
  const iso = typeof d === 'string' ? d.replace(' ', 'T') : d;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Finds a booking in the list by ID.
 * @param {Array} bookings - Array of booking objects
 * @param {string} id - Booking ID to search
 * @returns {Object|undefined} Booking object or undefined
 */
function findBookingById(bookings, id) {
  return bookings.find((b) => b.id === id);
}

/**
 * Creates and displays a modal overlay. Handles closing on button click or overlay click.
 * @param {string} html - HTML content for the modal
 * @param {Function} [onMount] - Callback (overlay, closeModal) after modal is inserted
 * @param {Function} [onCleanup] - Callback (overlay) before modal is removed
 */
function showModal(html, onMount, onCleanup) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  const closeModal = () => {
    if (onCleanup) onCleanup(overlay);
    overlay.remove();
  };

  overlay.querySelectorAll('.btn-close, .btn-cancel').forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  if (onMount) onMount(overlay, closeModal);
}

/**
 * Displays modal to cancel (soft delete) a booking with optional client notification.
 * Updates booking status to 'cancelled' and sends email if checkbox checked.
 * @param {Object} booking - Booking object with id, name, service
 * @param {Object} api - API client
 * @param {Function} showToast - Toast notification function
 * @param {Element} container - Container to re-render after action
 * @param {Object} ctx - Router context
 */
function showCancelModal(booking, api, showToast, container, ctx) {
  const html = `
    <div class="modal" style="max-width: 480px; width: 90%;">
      <div class="modal-header">
        <h3 class="modal-title">Zrušit rezervaci</h3>
        <button type="button" class="btn-close" aria-label="Zavřít" style="position: absolute; top: var(--sp-4); right: var(--sp-4); background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">×</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: var(--sp-4); color: var(--c-forest);">
          Opravdu zrušit rezervaci <strong>${esc(booking.name || 'neznámý klient')}</strong>
          na službu <strong>${esc(booking.service)}</strong>?
        </p>
        <label style="display: flex; align-items: center; gap: var(--sp-2); cursor: pointer; margin-bottom: var(--sp-4);">
          <input type="checkbox" id="cancel-notify" style="cursor: pointer;">
          <span style="color: var(--c-sage);">Informovat klienta e-mailem o zrušení</span>
        </label>
      </div>
      <div class="modal-footer" style="display: flex; gap: var(--sp-3); justify-content: flex-end;">
        <button class="btn btn-cancel btn-ghost" style="border: 1px solid var(--c-sage);">Zpět</button>
        <button class="btn btn-delete" style="background-color: #ef4444; color: white; border: none;">Zrušit rezervaci</button>
      </div>
    </div>
  `;

  showModal(html, (overlay, closeModal) => {
    const notifyCheckbox = overlay.querySelector('#cancel-notify');
    const deleteBtn = overlay.querySelector('.btn-delete');

    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Zpracovávám…';

      const res = await api.updateBooking(booking.id, {
        status: 'cancelled',
        notify_client: notifyCheckbox.checked,
      });

      if (res.ok) {
        showToast('Rezervace zrušena', 'success');
        closeModal();
        render(container, ctx);
      } else {
        showToast('Chyba: ' + res.error, 'error');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Zrušit rezervaci';
      }
    });
  });
}

/**
 * Displays modal to hard-delete (IRREVERSIBLE) a booking from database and calendar.
 * Shows red warning and booking details before confirmation.
 * @param {Object} booking - Booking object with id, name, service, preferred_date
 * @param {Object} api - API client
 * @param {Function} showToast - Toast notification function
 * @param {Element} container - Container to re-render after action
 * @param {Object} ctx - Router context
 */
function showDeleteModal(booking, api, showToast, container, ctx) {
  const html = `
    <div class="modal" style="max-width: 480px; width: 90%;">
      <div class="modal-header">
        <h3 class="modal-title">Trvalé smazání</h3>
        <button type="button" class="btn-close" aria-label="Zavřít" style="position: absolute; top: var(--sp-4); right: var(--sp-4); background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">×</button>
      </div>
      <div class="modal-body">
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: var(--sp-4); margin-bottom: var(--sp-4);">
          <p style="color: #991b1b; font-weight: 600; margin: 0 0 var(--sp-2);">⚠️ Trvalé smazání — NEVRATNÉ</p>
          <p style="color: #7f1d1d; font-size: 0.9rem; margin: 0;">Záznam a všechny jeho údaje budou nenávratně odstraněny. Použij jen pro spam nebo testovací rezervace.</p>
        </div>
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: var(--sp-3); margin-bottom: var(--sp-4); font-size: 0.9rem;">
          <p style="margin: 0 0 var(--sp-1);"><strong>Klient:</strong> ${esc(booking.name || '—')}</p>
          <p style="margin: 0 0 var(--sp-1);"><strong>Služba:</strong> ${esc(booking.service || '—')}</p>
          <p style="margin: 0;"><strong>Termín:</strong> ${fmtDate(booking.preferred_date)}</p>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; gap: var(--sp-3); justify-content: flex-end;">
        <button class="btn btn-cancel btn-ghost" style="border: 1px solid var(--c-sage);">Zpět</button>
        <button class="btn btn-delete" style="background-color: #dc2626; color: white; border: none;">Trvale smazat</button>
      </div>
    </div>
  `;

  showModal(html, (overlay, closeModal) => {
    const deleteBtn = overlay.querySelector('.btn-delete');

    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Mažu…';

      const res = await api.deleteBooking(booking.id);

      if (res.ok) {
        showToast('Rezervace smazána', 'success');
        closeModal();
        render(container, ctx);
      } else {
        showToast('Chyba: ' + res.error, 'error');
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Trvale smazat';
      }
    });
  });
}

/**
 * Displays modal with booking details (decrypted PII) and audit history.
 * Fetches data from getBookingDetail endpoint, handles errors gracefully.
 * @param {string} bookingId - ID of booking to display
 * @param {Object} api - API client
 * @param {Function} showToast - Toast notification function
 */
function showDetailModal(bookingId, api, showToast) {
  const html = `
    <div class="modal" style="max-width: 700px; width: 95%; max-height: 80vh; overflow-y: auto;">
      <div class="modal-header">
        <h3 class="modal-title">Detail rezervace</h3>
        <button type="button" class="btn-close" aria-label="Zavřít" style="position: absolute; top: var(--sp-4); right: var(--sp-4); background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">×</button>
      </div>
      <div class="modal-body">
        <div style="text-align: center; padding: var(--sp-6);">
          <div class="spinner" style="margin: 0 auto var(--sp-3);"></div>
          <p style="color: var(--c-sage);">Načítám detaily…</p>
        </div>
      </div>
    </div>
  `;

  showModal(html, async (overlay, closeModal) => {
    const modalBody = overlay.querySelector('.modal-body');

    const res = await api.getBookingDetail(bookingId);

    if (!res.ok) {
      showToast('Nepodařilo se načíst detail: ' + res.error, 'error');
      closeModal();
      return;
    }

    const { booking, history, history_has_more } = res.data;

    let historyHtml = '';
    if (history && history.length > 0) {
      const historyRows = history.map((h) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f0f0f0';
        tr.innerHTML = `
          <td style="padding: var(--sp-2);"><strong>${esc(h.action)}</strong></td>
          <td style="padding: var(--sp-2);">${esc(h.actor || '—')}</td>
          <td style="padding: var(--sp-2);">${fmtDateTime(h.created_at)}</td>
          <td style="padding: var(--sp-2); color: var(--c-sage);">${esc(h.details || '—')}</td>
        `;
        return tr.outerHTML;
      }).join('');

      historyHtml = `
        <div style="margin-top: var(--sp-6); padding-top: var(--sp-6); border-top: 1px solid rgba(115,138,117,0.15);">
          <h4 style="margin: 0 0 var(--sp-3); color: var(--c-forest);">Historie akcí</h4>
          <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
            <thead style="background-color: #f3f4f6;">
              <tr>
                <th style="padding: var(--sp-2); text-align: left; border-bottom: 1px solid #e5e7eb;">Akce</th>
                <th style="padding: var(--sp-2); text-align: left; border-bottom: 1px solid #e5e7eb;">Operátor</th>
                <th style="padding: var(--sp-2); text-align: left; border-bottom: 1px solid #e5e7eb;">Čas</th>
                <th style="padding: var(--sp-2); text-align: left; border-bottom: 1px solid #e5e7eb;">Detaily</th>
              </tr>
            </thead>
            <tbody>${historyRows}</tbody>
          </table>
          ${history_has_more ? `<p style="margin-top: var(--sp-2); font-size: 0.8rem; color: var(--c-sage); font-style: italic;">Zobrazeno posledních 100 záznamů.</p>` : ''}
        </div>
      `;
    }

    const badgeMap = { pending: 'badge-pending', confirmed: 'badge-confirmed', done: 'badge-done', cancelled: 'badge-cancelled' };
    const badgeClass = badgeMap[booking.status] || '';
    const statusLabel = { pending: 'Čeká', confirmed: 'Potvrzeno', done: 'Dokončeno', cancelled: 'Zrušeno' }[booking.status] || booking.status;

    const contentHtml = `
      <div>
        <h4 style="margin: 0 0 var(--sp-3); color: var(--c-forest);">Rezervace</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-4); margin-bottom: var(--sp-4);">
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Klient</p>
            <p style="margin: 0; color: var(--c-forest); font-weight: 500;">${esc(booking.name || '—')}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Služba</p>
            <p style="margin: 0; color: var(--c-forest); font-weight: 500;">${esc(booking.service || '—')}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">E-mail</p>
            <p style="margin: 0; color: var(--c-forest); word-break: break-all;">${esc(booking.email || '—')}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Telefon</p>
            <p style="margin: 0; color: var(--c-forest);">${esc(booking.phone || '—')}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Termín (slot)</p>
            <p style="margin: 0; color: var(--c-forest);">${fmtDateTime(booking.slot_start || booking.preferred_date)}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Stav</p>
            <p style="margin: 0;"><span class="badge ${badgeClass}">${statusLabel}</span></p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Přiřazeno</p>
            <p style="margin: 0; color: var(--c-forest);">${esc(booking.assigned_to || '—')}</p>
          </div>
          <div>
            <p style="margin: 0 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-sage); font-weight: 600;">Poznámka</p>
            <p style="margin: 0; color: var(--c-forest);">${esc(booking.note || '—')}</p>
          </div>
        </div>
      </div>
      ${historyHtml}
    `;

    modalBody.innerHTML = contentHtml;
  });
}

/**
 * Displays modal to reschedule a booking by selecting a new slot from /api/availability.
 * Fetches available slots, renders picker, and sends new_slot_start/end to G3 PUT endpoint.
 * @param {Object} booking - Booking object with id, name, service, slot_start/preferred_date
 * @param {Object} api - API client
 * @param {Function} showToast - Toast notification function
 * @param {Element} container - Container to re-render after action
 * @param {Object} ctx - Router context
 */
function showRescheduleModal(booking, api, showToast, container, ctx) {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let selectedStart = null;
  let selectedEnd = null;
  let availabilityRequestSeq = 0;

  const html = `
    <div class="modal" style="max-width: 600px; width: 90%;">
      <div class="modal-header">
        <h3 class="modal-title">Přesunout rezervaci</h3>
        <button type="button" class="btn-close" aria-label="Zavřít" style="position: absolute; top: var(--sp-4); right: var(--sp-4); background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--c-sage);">×</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: var(--sp-4);">
          <p style="color: var(--c-forest); margin: 0 0 var(--sp-2);">
            <strong>${esc(booking.name || 'Klient')}</strong> • ${esc(booking.service)}
          </p>
          <p style="color: var(--c-sage); font-size: 0.9rem; margin: 0;">
            Aktuální termín: <strong>${fmtDateTime(booking.slot_start || booking.preferred_date)}</strong>
          </p>
        </div>
        <div style="margin-bottom: var(--sp-4);">
          <label for="reschedule-date" style="display: block; margin-bottom: var(--sp-2); color: var(--c-forest); font-weight: 500;">Vyberte nový den</label>
          <input type="date" id="reschedule-date" min="${today}" style="width: 100%; padding: 0.5rem; border: 1px solid var(--c-sage); border-radius: 6px; font-size: 0.9rem;">
        </div>
        <div style="margin-bottom: var(--sp-4);">
          <label style="display: block; margin-bottom: var(--sp-2); color: var(--c-forest); font-weight: 500;">Volné časy</label>
          <div id="reschedule-slots" style="display: flex; flex-wrap: wrap; gap: 0.75rem; min-height: 2.5rem;">
            <p style="color: var(--c-sage); font-size: 0.9rem; margin: 0;">Vyberte prosím den</p>
          </div>
        </div>
      </div>
      <div class="modal-footer" style="display: flex; gap: var(--sp-3); justify-content: flex-end;">
        <button class="btn btn-cancel btn-ghost" style="border: 1px solid var(--c-sage);">Zpět</button>
        <button class="btn btn-reschedule" style="background-color: #3A4A3C; color: white; border: none; cursor: pointer;" disabled>Přesunout</button>
      </div>
    </div>
  `;

  showModal(html, (overlay, closeModal) => {
    const dateInput = overlay.querySelector('#reschedule-date');
    const slotsContainer = overlay.querySelector('#reschedule-slots');
    const rescheduleBtn = overlay.querySelector('.btn-reschedule');

    dateInput.addEventListener('change', async () => {
      const dateStr = dateInput.value;
      if (!dateStr) {
        slotsContainer.innerHTML = '<p style="color: var(--c-sage); font-size: 0.9rem; margin: 0;">Vyberte prosím den</p>';
        selectedStart = null;
        selectedEnd = null;
        rescheduleBtn.disabled = true;
        return;
      }

      const reqSeq = ++availabilityRequestSeq;
      slotsContainer.innerHTML = '<p style="color: var(--c-sage); font-size: 0.9rem; margin: 0;">Načítám dostupnost…</p>';

      try {
        const res = await fetch(`/api/availability?from=${dateStr}&to=${dateStr}`);
        if (reqSeq !== availabilityRequestSeq) return;

        if (!res.ok) {
          slotsContainer.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; margin: 0;">Chyba při načítání dostupnosti</p>';
          return;
        }

        const availData = await res.json();
        const dayData = availData.days && availData.days[0];
        const slots = dayData && dayData.slots ? dayData.slots : [];

        if (slots.length === 0) {
          slotsContainer.innerHTML = '<p style="color: var(--c-sage); font-size: 0.9rem; margin: 0;">Žádné volné termíny pro tento den</p>';
          selectedStart = null;
          selectedEnd = null;
          rescheduleBtn.disabled = true;
          return;
        }

        slotsContainer.innerHTML = '';
        slots.forEach((slot) => {
          const time = slot.start.split(' ')[1];
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = time;
          btn.style.cssText = 'padding: 0.6rem 1.2rem; border: 1px solid var(--c-sage); background-color: transparent; color: var(--c-sage); border-radius: 20px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease;';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            slotsContainer.querySelectorAll('button').forEach((b) => {
              b.style.backgroundColor = 'transparent';
              b.style.color = 'var(--c-sage)';
            });
            btn.style.backgroundColor = 'var(--c-sage)';
            btn.style.color = 'var(--c-white)';
            selectedStart = slot.start;
            selectedEnd = slot.end;
            rescheduleBtn.disabled = false;
          });
          slotsContainer.appendChild(btn);
        });
      } catch (err) {
        console.error('[calendar] Availability fetch error:', err);
        slotsContainer.innerHTML = '<p style="color: #ef4444; font-size: 0.9rem; margin: 0;">Chyba při načítání dostupnosti</p>';
      }
    });

    rescheduleBtn.addEventListener('click', async () => {
      if (!selectedStart || !selectedEnd) return;

      rescheduleBtn.disabled = true;
      rescheduleBtn.textContent = 'Přesouvám…';

      const res = await api.updateBooking(booking.id, {
        new_slot_start: selectedStart,
        new_slot_end: selectedEnd,
      });

      if (res.ok) {
        showToast('Termín přesunut', 'success');
        closeModal();
        render(container, ctx);
      } else {
        showToast('Chyba: ' + res.error, 'error');
        rescheduleBtn.disabled = false;
        rescheduleBtn.textContent = 'Přesunout';
      }
    });
  });
}
