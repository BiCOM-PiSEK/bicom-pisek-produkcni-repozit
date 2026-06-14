/**
 * BICOM PÍSEK — Exceptions Module (F4 Admin UI)
 * Správa výjimek dostupnosti (svátky, dovolená, ad-hoc, extra)
 */

const TYPE_LABELS = {
  holiday: 'Svátek',
  vacation: 'Dovolená',
  adhoc: 'Ad-hoc blokace',
  extra: 'Extra otevírací doba',
};

const TYPES = ['holiday', 'vacation', 'adhoc', 'extra'];

function escapeHtml(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

export async function render(container, ctx) {
  const { api, showToast } = ctx;

  let exceptions = [];

  // Load data
  if (api) {
    const res = await api.getExceptions();
    if (res.ok && res.data) {
      exceptions = res.data.exceptions || [];
    }
  }

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Výjimky a svátky</h1>
      <p class="canvas-subtitle">Spravujte svátky, dovolenou, ad-hoc blokace a extra otevíračky</p>
    </div>

    <div class="card mb-6">
      <div class="card-header"><h3 class="card-title">➕ Přidat výjimku</h3></div>
      <div class="card-body">
        <form id="exception-form">
          <div class="form-group">
            <label class="form-label">Typ *</label>
            <select id="exception-type" class="form-control" required>
              <option value="">Vyberte typ...</option>
              <option value="holiday">Svátek</option>
              <option value="vacation">Dovolená</option>
              <option value="adhoc">Ad-hoc blokace</option>
              <option value="extra">Extra otevírací doba</option>
            </select>
            <p class="form-hint">Svátek/Dovolená: celý den; Ad-hoc/Extra: vyžadují časy</p>
          </div>

          <div class="form-group">
            <label class="form-label">Datum *</label>
            <input type="date" id="exception-date" class="form-control" required>
            <p class="form-hint">Budoucí datum (YYYY-MM-DD)</p>
          </div>

          <div class="form-group" id="exception-time-group" style="display: none;">
            <label class="form-label">Časy *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label class="form-label" style="font-size: 0.875rem;">Od</label>
                <input type="time" id="exception-start-time" class="form-control" placeholder="HH:MM">
              </div>
              <div>
                <label class="form-label" style="font-size: 0.875rem;">Do</label>
                <input type="time" id="exception-end-time" class="form-control" placeholder="HH:MM">
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Poznámka (max 200 znaků)</label>
            <textarea id="exception-note" class="form-control" placeholder="Např. Vánoce, nemocná, …" style="resize: vertical; min-height: 80px;"></textarea>
          </div>

          <button type="submit" class="btn btn-primary">💾 Přidat výjimku</button>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><h3 class="card-title">📋 Seznam výjimek</h3></div>
      <div class="card-body">
        <div id="exceptions-table-container"></div>
      </div>
    </div>
  `;

  // Toggle time inputs based on type
  const typeSelect = container.querySelector('#exception-type');
  const timeGroup = container.querySelector('#exception-time-group');

  typeSelect.addEventListener('change', () => {
    const type = typeSelect.value;
    timeGroup.style.display = (type === 'adhoc' || type === 'extra') ? 'block' : 'none';
  });

  // Render table
  function renderExceptionsList() {
    const tableContainer = container.querySelector('#exceptions-table-container');
    if (!tableContainer) return;

    if (exceptions.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.style.cssText = 'padding: 2rem; text-align: center; color: var(--c-sage);';
      emptyDiv.textContent = 'Zatím žádné výjimky. Přidejte první!';
      tableContainer.innerHTML = '';
      tableContainer.appendChild(emptyDiv);
      return;
    }

    const tbody = exceptions.map((exc) => {
      const timeStr = (exc.start_time && exc.end_time)
        ? `${exc.start_time} – ${exc.end_time}`
        : 'Celý den';
      const typeLabel = TYPE_LABELS[exc.type] || exc.type;

      const tr = document.createElement('tr');
      tr.dataset.id = exc.id;
      tr.innerHTML = `
        <td style="font-weight: 500;">${escapeHtml(exc.date)}</td>
        <td>${escapeHtml(typeLabel)}</td>
        <td>${escapeHtml(timeStr)}</td>
        <td>${exc.note ? '<div style="font-size: var(--text-sm); color: var(--c-sage);">' + escapeHtml(exc.note) + '</div>' : ''}</td>
        <td>
          <button class="btn btn-ghost btn-sm btn-delete-exc" title="Smazat">🗑️</button>
        </td>
      `;
      return tr;
    });

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Datum</th>
          <th>Typ</th>
          <th>Čas</th>
          <th>Poznámka</th>
          <th style="text-align: right;">Akce</th>
        </tr>
      </thead>
    `;

    const tbodyEl = document.createElement('tbody');
    tbody.forEach((tr) => tbodyEl.appendChild(tr));
    table.appendChild(tbodyEl);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';
    tableWrap.appendChild(table);

    tableContainer.innerHTML = '';
    tableContainer.appendChild(tableWrap);

    // Bind delete listeners
    tableContainer.querySelectorAll('tr[data-id]').forEach((row) => {
      const id = row.dataset.id;
      row.querySelector('.btn-delete-exc')?.addEventListener('click', async () => {
        if (!confirm('Opravdu chcete smazat tuto výjimku?')) return;

        const res = await api.deleteException(id);
        if (res.ok) {
          exceptions = exceptions.filter((e) => e.id !== id);
          renderExceptionsList();
          showToast('✓ Výjimka smazána', 'success');
        } else {
          showToast(`Chyba: ${res.error || 'Neznámá chyba'}`, 'error');
        }
      });
    });
  }

  renderExceptionsList();

  // Form submit
  const form = container.querySelector('#exception-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = container.querySelector('#exception-type').value;
    const date = container.querySelector('#exception-date').value;
    const startTime = container.querySelector('#exception-start-time').value;
    const endTime = container.querySelector('#exception-end-time').value;
    const note = container.querySelector('#exception-note').value || null;

    // Client-side validation
    if (!date) {
      showToast('Vyberte datum', 'error');
      return;
    }

    if (type === 'adhoc' || type === 'extra') {
      if (!startTime || !endTime) {
        showToast(`Typ "${TYPE_LABELS[type]}" vyžaduje časy`, 'error');
        return;
      }

      if (startTime >= endTime) {
        showToast('Čas "Od" musí být < "Do"', 'error');
        return;
      }
    }

    if (api) {
      const payload = {
        date,
        type,
        start_time: (type === 'adhoc' || type === 'extra') ? startTime : null,
        end_time: (type === 'adhoc' || type === 'extra') ? endTime : null,
        note,
      };

      const res = await api.addException(payload);
      if (res.ok) {
        showToast('✓ Výjimka přidána', 'success');
        form.reset();
        container.querySelector('#exception-time-group').style.display = 'none';

        // Reload list
        const loadRes = await api.getExceptions();
        if (loadRes.ok) {
          exceptions = loadRes.data.exceptions || [];
          renderExceptionsList();
        }
      } else {
        showToast(`Chyba: ${res.error || 'Neznámá chyba'}`, 'error');
      }
    } else {
      showToast('Demo režim — přidání simulováno', 'info');
    }
  });
}

export function destroy() {
  // Cleanup if needed
}
