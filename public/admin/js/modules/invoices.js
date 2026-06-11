/**
 * BICOM PÍSEK — Invoices Module (Fakturace)
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;
  let invoices = [];
  let hasError = false;
  let isMock = false;

  if (api) {
    const res = await api.getInvoices();
    if (res.ok) {
      invoices = res.data?.invoices || [];
      isMock = res.data?.source === 'mock';
    } else {
      hasError = true;
      showToast('Nepodařilo se načíst faktury: ' + (res.error || 'Neznámá chyba'), 'error');
    }
  }

  if (hasError) {
    container.innerHTML = `
      <div class="canvas-header">
        <h1 class="canvas-title">Fakturace</h1>
        <p class="canvas-subtitle">Data se nepodařilo načíst</p>
      </div>
      <div class="card">
        <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">⚠️</div>
          <h4 class="empty-state-title">Chyba stahování dat</h4>
          <p class="empty-state-text">Nepodařilo se navázat spojení s fakturačním systémem.</p>
        </div>
      </div>
    `;
    return;
  }

  if (isMock) {
    container.innerHTML = `
      <div class="canvas-header flex justify-between items-center">
        <div>
          <h1 class="canvas-title">Fakturace</h1>
          <p class="canvas-subtitle">Přehled faktur z iDokladu</p>
        </div>
      </div>
      <div class="card">
        <div class="empty-state" style="padding: var(--sp-8) var(--sp-4);">
          <div style="font-size: 2.5rem; margin-bottom: var(--sp-3);">🔌</div>
          <h4 class="empty-state-title">iDoklad není propojen</h4>
          <p class="empty-state-text">Propojení s iDokladem bude aktivní po zadání API klíčů v Cloudflare Secrets.</p>
        </div>
      </div>
    `;
    return;
  }

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0);

  container.innerHTML = `
    <div class="canvas-header flex justify-between items-center">
      <div>
        <h1 class="canvas-title">Fakturace</h1>
        <p class="canvas-subtitle">Přehled faktur z iDokladu</p>
      </div>
      <button class="btn btn-champagne" id="btn-new-invoice">+ Nová faktura</button>
    </div>
    <div class="grid-3 mb-6">
      <div class="card kpi-card"><div class="kpi-value">${fmtCzk(total)}</div><div class="kpi-label">Celkem fakturováno</div></div>
      <div class="card kpi-card"><div class="kpi-value">${fmtCzk(paid)}</div><div class="kpi-label">Uhrazeno</div></div>
      <div class="card kpi-card"><div class="kpi-value">${fmtCzk(total - paid)}</div><div class="kpi-label">Neuhrazeno</div></div>
    </div>
    <div class="card"><div class="card-body">${renderTable(invoices)}</div></div>
  `;

  container.querySelector('#btn-new-invoice')?.addEventListener('click', () => {
    showToast('Vystavování faktur vyžaduje nastavení iDoklad API klíčů.', 'info');
  });
}

export function destroy() {}

function renderTable(invoices) {
  if (!invoices.length) return '<div class="empty-state"><h4 class="empty-state-title">Žádné faktury</h4></div>';
  const rows = invoices.map((i) => `<tr>
    <td><strong>${esc(i.number)}</strong></td>
    <td>${esc(i.customer)}</td>
    <td>${fmtDate(i.date)}</td>
    <td>${fmtCzk(i.amount)}</td>
    <td><span class="badge ${i.status === 'paid' ? 'badge-confirmed' : 'badge-pending'}">${i.status === 'paid' ? 'Uhrazena' : 'Neuhrazena'}</span></td>
  </tr>`).join('');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Číslo</th><th>Klient</th><th>Datum</th><th>Částka</th><th>Stav</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
function fmtCzk(n) { return (n || 0).toLocaleString('cs-CZ') + ' Kč'; }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' }); }
