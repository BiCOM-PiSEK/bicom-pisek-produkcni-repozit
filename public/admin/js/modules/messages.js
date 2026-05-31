/**
 * BICOM PÍSEK — Messages Module (Zprávy / Telegram log)
 */
export async function render(container, ctx) {
  const messages = getDemoMessages();
  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Zprávy</h1>
      <p class="canvas-subtitle">Telegram komunikace a eskalované dotazy z AI Rádce</p>
    </div>
    <div class="grid-2 gap-6">
      <div class="card">
        <div class="card-header"><h3 class="card-title">📨 Eskalované dotazy</h3></div>
        <div class="card-body">
          ${messages.map((m) => `
            <div class="activity-item">
              <div class="activity-icon ${m.type}">${m.icon}</div>
              <div class="activity-body">
                <div class="activity-text"><strong>${esc(m.from)}:</strong> ${esc(m.text)}</div>
                <div class="activity-time">${esc(m.time)}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3 class="card-title">🤖 Telegram Bot</h3></div>
        <div class="card-body">
          <p style="font-size: var(--text-sm); color: var(--c-sage); margin-bottom: var(--sp-4);">Telegram bot je propojený se skupinovým chatem provozovatelek. Dostává notifikace o nových poptávkách, cash flow alertech a eskalovaných dotazech.</p>
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-4">
              <span class="statusbar-dot ${ctx.api ? 'online' : 'warning'}" style="animation:none;"></span>
              <span style="font-size: var(--text-sm);">${ctx.api ? 'Bot aktivní' : 'Bot ve standby (čeká na API klíč)'}</span>
            </div>
            <div style="font-size: var(--text-xs); color: var(--c-sage);">
              <strong>Dostupné příkazy:</strong><br>
              /stats — týdenní statistiky<br>
              /slots — volné termíny<br>
              /cashflow — stav fakturace<br>
              /sync — synchronizace IG
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
export function destroy() {}

function getDemoMessages() {
  return [
    { from: 'AI Rádce', text: 'Klientka se ptá na kombinaci biorezonance s homeopatií — eskaluji k operátorce.', icon: '🤖', type: 'ai', time: 'před 2 h' },
    { from: 'Web formulář', text: 'Dotaz na dětský program pro 5letého syna s ekzémem.', icon: '📋', type: 'booking', time: 'před 4 h' },
    { from: 'Telegram', text: 'Jana: „Potvrzuji termín pro paní Novákovou na čtvrtek."', icon: '💬', type: 'system', time: 'včera' },
  ];
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
