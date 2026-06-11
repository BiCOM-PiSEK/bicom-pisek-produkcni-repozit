/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Payments Module (Platby Stripe)
 * ═══════════════════════════════════════════════════════════════
 * Přehled Stripe transakcí, celkové tržby, propojení s iDokladem.
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Vykreslí modul platby do kontejneru.
 * @param {HTMLElement} container
 * @param {Object} ctx — { route, navigate, showToast, api }
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;

  // Render loading skeleton
  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Stripe Platby</h1>
      <p class="canvas-subtitle">Načítám finanční ukazatele…</p>
    </div>
    <div class="grid-3 mb-6">
      <div class="card kpi-card"><div class="skeleton" style="width:100px;height:24px;margin-bottom:8px;"></div><div class="skeleton" style="width:60px;height:12px;"></div></div>
      <div class="card kpi-card"><div class="skeleton" style="width:100px;height:24px;margin-bottom:8px;"></div><div class="skeleton" style="width:60px;height:12px;"></div></div>
      <div class="card kpi-card"><div class="skeleton" style="width:100px;height:24px;margin-bottom:8px;"></div><div class="skeleton" style="width:60px;height:12px;"></div></div>
    </div>
    <div class="card"><div class="skeleton" style="width:100%;height:300px;"></div></div>
  `;

  let data = null;
  let hasError = false;
  if (api) {
    const res = await api.getPayments();
    if (res.ok) {
      data = res.data;
    } else {
      hasError = true;
      showToast('Nepodařilo se načíst platby: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  } else {
    data = { totalRevenue: 0, paymentCount: 0, transactions: [] };
  }

  if (hasError) {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">Stripe Platby</h1>
        <p class="canvas-subtitle">Data se nepodařilo načíst</p>
      </div>
      <div class="card">
        <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">⚠️</div>
          <h4 class="empty-state-title">Chyba stahování dat</h4>
          <p class="empty-state-text">Nepodařilo se navázat spojení s databází plateb.</p>
        </div>
      </div>
    `;
    return;
  }

  const totalRevenue = data?.totalRevenue || 0;
  const paymentCount = data?.paymentCount || 0;
  const transactions = data?.transactions || [];
  const averagePayment = paymentCount > 0 ? Math.round(totalRevenue / paymentCount) : 0;

  container.innerHTML = `
    <div class="canvas-header flex justify-between items-center">
      <div>
        <h1 class="canvas-title">Online Platby (Stripe)</h1>
        <p class="canvas-subtitle">Finanční přehled a stav plateb za zálohy termínů</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="badge badge-confirmed" style="background-color: var(--c-success); color: white; display: inline-flex; align-items: center; gap: 6px;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:white; animate: pulse 1.5s infinite;"></span>
          Stripe Webhook Live
        </span>
      </div>
    </div>

    <!-- Finanční KPI karty -->
    <div class="grid-3 mb-6">
      <div class="card kpi-card">
        <div style="font-size: 1.5rem; margin-bottom: var(--sp-2);">💳</div>
        <div class="kpi-value">${fmtCzk(totalRevenue)}</div>
        <div class="kpi-label">Tržby přes Stripe</div>
      </div>
      <div class="card kpi-card">
        <div style="font-size: 1.5rem; margin-bottom: var(--sp-2);">📊</div>
        <div class="kpi-value">${paymentCount}</div>
        <div class="kpi-label">Úspěšných transakcí</div>
      </div>
      <div class="card kpi-card">
        <div style="font-size: 1.5rem; margin-bottom: var(--sp-2);">📈</div>
        <div class="kpi-value">${fmtCzk(averagePayment)}</div>
        <div class="kpi-label">Průměrná platba (záloha)</div>
      </div>
    </div>

    <!-- Informace o fakturačním mostu -->
    <div class="card mb-6" style="border-left: 4px solid var(--c-champagne); background-color: #faf8f5;">
      <div class="card-body" style="padding: var(--sp-4);">
        <div class="flex gap-3 items-start">
          <div style="font-size:1.5rem;">⚙️</div>
          <div>
            <h4 style="font-weight: 600; color: var(--c-forest); margin-bottom: 4px;">Automatický fakturační most iDoklad</h4>
            <p style="font-size: 0.85rem; color: #555; line-height: 1.5;">
              Při dokončení platby na platební bráně Stripe systém automaticky dešifruje osobní údaje klienta, spojí se s vaším <strong>iDokladem</strong> a okamžitě vystaví zaplacenou zálohovou fakturu. Vše probíhá plně automaticky na pozadí bez nutnosti ručního přepisování.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Výpis transakcí -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Historie transakcí</h3>
      </div>
      <div class="card-body">
        ${renderTable(transactions)}
      </div>
    </div>
  `;
}

export function destroy() {}

function renderTable(txs) {
  if (!txs || !txs.length) {
    return `<div class="empty-state"><h4 class="empty-state-title">Zatím neproběhly žádné platby</h4></div>`;
  }

  const rows = txs.map((tx) => {
    return `
      <tr>
        <td><strong>${esc(tx.clientName)}</strong></td>
        <td><span style="font-size: var(--text-xs); color: var(--c-sage);">${esc(tx.service)}</span></td>
        <td>${fmtDate(tx.preferredDate)}</td>
        <td><strong>${fmtCzk(tx.amount)}</strong></td>
        <td>
          <span class="badge badge-confirmed" style="background-color: #e6f4ea; color: #137333;">
            Uhrazena
          </span>
        </td>
        <td><span class="text-sage" style="font-size: var(--text-xs); font-family: monospace;">${esc(tx.stripeSessionId ? tx.stripeSessionId.slice(0, 15) + '...' : '—')}</span></td>
        <td>${fmtDate(tx.createdAt)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>Klient</th>
            <th>Program / Služba</th>
            <th>Termín terapie</th>
            <th>Částka</th>
            <th>Stav platby</th>
            <th>Stripe Ref ID</th>
            <th>Datum platby</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function esc(s) {
  if (!s) return '';
  const e = document.createElement('span');
  e.textContent = s;
  return e.innerHTML;
}

function fmtCzk(n) {
  return (n || 0).toLocaleString('cs-CZ') + ' Kč';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}
