/**
 * BICOM PÍSEK — Messages Module (Zprávy)
 */
export async function render(container, ctx) {
  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Zprávy</h1>
      <p class="canvas-subtitle">Komunikační centrum</p>
    </div>
    <div class="card">
      <div class="empty-state" style="padding: var(--sp-12) var(--sp-4); text-align: center;">
        <div style="font-size: 3rem; margin-bottom: var(--sp-4);">✉️</div>
        <h4 class="empty-state-title" style="font-family: var(--font-serif); font-size: 1.5rem; color: var(--c-forest); margin-bottom: var(--sp-2);">Centrum zpráv připravujeme</h4>
        <p class="empty-state-text" style="max-width: 480px; margin: 0 auto; color: var(--c-sage);">Eskalace AI Rádce a přehled komunikace zde najdete brzy.</p>
      </div>
    </div>
  `;
}

export function destroy() {}
