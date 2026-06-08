/**
 * BICOM PÍSEK — Settings Module (Nastavení)
 */
export async function render(container, ctx) {
  const { api, showToast } = ctx;
  let settings = getDefaults();
  if (api) {
    const res = await api.getSettings();
    if (res.ok && res.data?.settings) {
      for (const [k, v] of Object.entries(res.data.settings)) {
        settings[k] = v.value;
      }
    }
  }

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Nastavení</h1>
      <p class="canvas-subtitle">Konfigurace chování systému — změny se projeví okamžitě</p>
    </div>
    <form id="settings-form">
      <!-- Fakturace -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">💰 Fakturace</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Režim fakturace</label>
            <select class="form-select" name="invoice_mode">
              <option value="auto_confirm" ${settings.invoice_mode === 'auto_confirm' ? 'selected' : ''}>Automaticky při potvrzení</option>
              <option value="manual" ${settings.invoice_mode === 'manual' ? 'selected' : ''}>Ručně</option>
              <option value="after_visit" ${settings.invoice_mode === 'after_visit' ? 'selected' : ''}>Po návštěvě</option>
            </select>
            <p class="form-hint">Určuje, kdy se automaticky vystaví faktura v iDokladu</p>
          </div>
        </div>
      </div>

      <!-- Platby & Zálohy -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">💳 Platby &amp; Zálohy</h3></div>
        <div class="card-body">
          <div class="form-group flex items-center justify-between">
            <div>
              <label class="form-label" style="margin:0;">Vyžadovat online zálohu (500 Kč)</label>
              <p class="form-hint">Pokud je zapnuto, klient musí před dokončením rezervace uhradit zálohu přes Stripe. Pokud je vypnuto, platba online je dobrovolná (klient může dokončit rezervaci zdarma).</p>
            </div>
            <label class="toggle"><input type="checkbox" name="stripe_deposit_required" ${settings.stripe_deposit_required === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
          <div class="form-group flex items-center justify-between" style="margin-top: 1.5rem; border-top: 1px solid rgba(115,138,117,0.15); padding-top: 1.5rem;">
            <div>
              <label class="form-label" style="margin:0;">Vyžadovat telefonní číslo</label>
              <p class="form-hint">Pokud je zapnuto, telefonní číslo je vždy povinné. Pokud je vypnuto, telefon je nepovinný (povinným se stane pouze tehdy, pokud klient zvolí zasílání upomínek přes SMS).</p>
            </div>
            <label class="toggle"><input type="checkbox" name="require_phone" ${settings.require_phone === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- Upomínky -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">🔔 Upomínky</h3></div>
        <div class="card-body">
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">SMS upomínky</label><p class="form-hint">Upomínka klientce 24h před termínem</p></div>
            <label class="toggle"><input type="checkbox" name="reminder_sms" ${settings.reminder_sms === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">E-mail upomínky</label><p class="form-hint">E-mail s instrukcemi před termínem</p></div>
            <label class="toggle"><input type="checkbox" name="reminder_email" ${settings.reminder_email === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
          <div class="form-group">
            <label class="form-label">Předstih upomínky (hodiny)</label>
            <input type="number" class="form-input" name="reminder_hours" value="${settings.reminder_hours || '24'}" min="1" max="72" style="width:120px;">
          </div>
        </div>
      </div>

      <!-- Telegram -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">📱 Telegram</h3></div>
        <div class="card-body">
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">Notifikace o nových poptávkách</label></div>
            <label class="toggle"><input type="checkbox" name="telegram_booking" ${settings.telegram_booking === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">Týdenní digest</label></div>
            <label class="toggle"><input type="checkbox" name="telegram_digest" ${settings.telegram_digest === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">Cash flow alerty</label></div>
            <label class="toggle"><input type="checkbox" name="telegram_cashflow" ${settings.telegram_cashflow === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- AI -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">🤖 AI Copywriter</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Tón psaní</label>
            <select class="form-select" name="ai_copywriter_tone">
              <option value="quiet_luxury" ${settings.ai_copywriter_tone === 'quiet_luxury' ? 'selected' : ''}>Quiet Luxury (doporučeno)</option>
              <option value="friendly" ${settings.ai_copywriter_tone === 'friendly' ? 'selected' : ''}>Přátelský</option>
              <option value="formal" ${settings.ai_copywriter_tone === 'formal' ? 'selected' : ''}>Formální</option>
            </select>
          </div>
          <div class="form-group flex items-center justify-between">
            <div><label class="form-label" style="margin:0;">Automatická publikace</label><p class="form-hint">Články se publikují bez schválení</p></div>
            <label class="toggle"><input type="checkbox" name="ai_auto_publish" ${settings.ai_auto_publish === '1' ? 'checked' : ''}><span class="toggle-slider"></span></label>
          </div>
        </div>
      </div>

      <!-- GDPR -->
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">🔒 GDPR</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Retence osobních údajů (dny)</label>
            <input type="number" class="form-input" name="gdpr_retention_days" value="${settings.gdpr_retention_days || '30'}" min="7" max="365" style="width:120px;">
            <p class="form-hint">Po uplynutí se šifrovaná data automaticky anonymizují</p>
          </div>
          <div class="form-group">
            <label class="form-label">Maximální budoucí rezervace (dny)</label>
            <input type="number" class="form-input" name="booking_max_future_days" value="${settings.booking_max_future_days || '90'}" min="7" max="365" style="width:120px;">
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg">💾 Uložit nastavení</button>
    </form>
  `;

  // Form submit
  container.querySelector('#settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {};
    form.querySelectorAll('select, input[type=number]').forEach((el) => {
      data[el.name] = el.value;
    });
    form.querySelectorAll('input[type=checkbox]').forEach((el) => {
      data[el.name] = el.checked ? '1' : '0';
    });

    if (api) {
      const res = await api.saveSettings(data);
      showToast(res.ok ? 'Nastavení uloženo ✓' : 'Chyba: ' + res.error, res.ok ? 'success' : 'error');
    } else {
      showToast('Demo režim — uložení simulováno', 'info');
    }
  });
}
export function destroy() {}

function getDefaults() {
  return {
    invoice_mode: 'manual', reminder_sms: '1', reminder_email: '1', reminder_hours: '24',
    telegram_booking: '1', telegram_digest: '1', telegram_cashflow: '1',
    ai_copywriter_tone: 'quiet_luxury', ai_auto_publish: '0',
    gdpr_retention_days: '30', booking_max_future_days: '90',
    stripe_deposit_required: '1', require_phone: '1',
  };
}
