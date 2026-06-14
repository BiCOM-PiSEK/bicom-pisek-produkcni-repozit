/**
 * BICOM PÍSEK — Availability Module (F3 Admin UI)
 * Správa otevírací doby (weekday rules) + booking_settings
 */

const WEEKDAY_NAMES = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const WEEKDAY_KEYS = [0, 1, 2, 3, 4, 5, 6]; // 0=Ne, 1=Po, ..., 6=So

export async function render(container, ctx) {
  const { api, showToast } = ctx;

  let rules = [];
  let settings = {
    slot_duration_min: 60,
    slot_gap_min: 10,
    min_lead_hours: 24,
    max_horizon_days: 60,
    require_confirmation: 1,
    require_deposit: 0,
    deposit_amount: null,
  };

  // Load data
  if (api) {
    const res = await api.getAvailability();
    if (res.ok && res.data) {
      rules = res.data.rules || [];
      settings = { ...settings, ...(res.data.settings || {}) };
    }
  }

  // Build rule map by weekday
  const rulesByWeekday = {};
  rules.forEach((r) => {
    rulesByWeekday[r.weekday] = r;
  });

  const dayRowsHtml = WEEKDAY_KEYS.map((weekday) => {
    const rule = rulesByWeekday[weekday];
    const isOpen = rule && rule.active === 1;
    const startTime = rule?.start_time || '09:00';
    const endTime = rule?.end_time || '17:00';
    return `
      <div style="display: grid; gap: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(115,138,117,0.15);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <label class="form-label" style="margin: 0;">${WEEKDAY_NAMES[weekday]}</label>
          <label class="toggle">
            <input type="checkbox" name="day_${weekday}_open" ${isOpen ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <label class="form-label">Od</label>
            <input type="time" class="form-input" name="day_${weekday}_start" value="${startTime}" ${!isOpen ? 'disabled' : ''}>
          </div>
          <div>
            <label class="form-label">Do</label>
            <input type="time" class="form-input" name="day_${weekday}_end" value="${endTime}" ${!isOpen ? 'disabled' : ''}>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="canvas-header">
      <h1 class="canvas-title">Otevírací doba</h1>
      <p class="canvas-subtitle">Spravujte pracovní dobu a parametry rezervačních slotů</p>
    </div>

    <form id="availability-form">
      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">📅 Otevírací doba</h3></div>
        <div class="card-body">
          <div style="display: grid; gap: 1.5rem;">
            ${dayRowsHtml}
          </div>
          <p class="form-hint" style="margin-top: 1.5rem; margin-bottom: 0;">
            Odpísknutá pole znamenají zavřeno. Časy jsou v lokálním čase (Praha).
          </p>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">⏱️ Parametry rezervačních slotů</h3></div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">Délka jednoho termínu (minuty)</label>
            <input type="number" class="form-input" name="slot_duration_min" value="${settings.slot_duration_min}" min="1" style="width: 150px;">
            <p class="form-hint">Typicky 60 minut (1 hodina)</p>
          </div>
          <div class="form-group">
            <label class="form-label">Pauza mezi termíny (minuty)</label>
            <input type="number" class="form-input" name="slot_gap_min" value="${settings.slot_gap_min}" min="0" style="width: 150px;">
            <p class="form-hint">Čas na přípravu mezi rezervacemi, typicky 10 minut</p>
          </div>
          <div class="form-group" style="border-top: 1px solid rgba(115,138,117,0.15); padding-top: 1.5rem; margin-top: 1.5rem;">
            <label class="form-label">Minimální předstih rezervace (hodiny)</label>
            <input type="number" class="form-input" name="min_lead_hours" value="${settings.min_lead_hours}" min="0" style="width: 150px;">
            <p class="form-hint">Klient musí rezervovat alespoň N hodin dopředu, typicky 24h</p>
          </div>
          <div class="form-group">
            <label class="form-label">Jak daleko dopředu lze rezervovat (dny)</label>
            <input type="number" class="form-input" name="max_horizon_days" value="${settings.max_horizon_days}" min="1" style="width: 150px;">
            <p class="form-hint">Sloty se nabízejí maximálně N dní v budoucnosti, typicky 60 dní</p>
          </div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header"><h3 class="card-title">✅ Rezervační chování</h3></div>
        <div class="card-body">
          <div class="form-group flex items-center justify-between">
            <div>
              <label class="form-label" style="margin:0;">Vyžadovat ruční potvrzení</label>
              <p class="form-hint">Rezervace čeká na vaše schválení, není okamžitě potvrzená</p>
            </div>
            <label class="toggle">
              <input type="checkbox" name="require_confirmation" ${settings.require_confirmation === 1 ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-group flex items-center justify-between" style="margin-top: 1.5rem; border-top: 1px solid rgba(115,138,117,0.15); padding-top: 1.5rem;">
            <div>
              <label class="form-label" style="margin:0;">Vyžadovat online zálohu</label>
              <p class="form-hint">Klient musí uhradit zálohu přes Stripe před dokončením</p>
            </div>
            <label class="toggle">
              <input type="checkbox" name="require_deposit" ${settings.require_deposit === 1 ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="form-group" style="margin-top: 1.5rem;">
            <label class="form-label">Výše zálohy (Kč, 0 = vypnuto)</label>
            <input type="number" class="form-input" name="deposit_amount" value="${settings.deposit_amount || 0}" min="0" style="width: 150px;">
          </div>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-lg">💾 Uložit dostupnost</button>
    </form>
  `;

  // Form handler
  const form = container.querySelector('#availability-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect rules from open days
    const newRules = [];
    for (const weekday of WEEKDAY_KEYS) {
      const isOpen = form.querySelector(`input[name="day_${weekday}_open"]`)?.checked;
      if (!isOpen) continue;

      const startTime = form.querySelector(`input[name="day_${weekday}_start"]`)?.value;
      const endTime = form.querySelector(`input[name="day_${weekday}_end"]`)?.value;

      if (!startTime || !endTime) {
        showToast(`${WEEKDAY_NAMES[weekday]}: chybí časy`, 'error');
        return;
      }

      if (startTime >= endTime) {
        showToast(`${WEEKDAY_NAMES[weekday]}: "Od" musí být < "Do"`, 'error');
        return;
      }

      newRules.push({
        weekday,
        start_time: startTime,
        end_time: endTime,
        active: 1,
      });
    }

    // Collect settings
    const newSettings = {
      slot_duration_min: parseInt(form.querySelector('input[name="slot_duration_min"]')?.value || '60', 10),
      slot_gap_min: parseInt(form.querySelector('input[name="slot_gap_min"]')?.value || '10', 10),
      min_lead_hours: parseInt(form.querySelector('input[name="min_lead_hours"]')?.value || '24', 10),
      max_horizon_days: parseInt(form.querySelector('input[name="max_horizon_days"]')?.value || '60', 10),
      require_confirmation: form.querySelector('input[name="require_confirmation"]')?.checked ? 1 : 0,
      require_deposit: form.querySelector('input[name="require_deposit"]')?.checked ? 1 : 0,
      deposit_amount: parseInt(form.querySelector('input[name="deposit_amount"]')?.value || '0', 10) || null,
    };

    if (newSettings.slot_duration_min <= 0) {
      showToast('Délka slotu musí být > 0', 'error');
      return;
    }

    if (newSettings.slot_duration_min + newSettings.slot_gap_min <= 0) {
      showToast('Součet délky a pauzy musí být > 0', 'error');
      return;
    }

    if (api) {
      const res = await api.saveAvailability({
        rules: newRules,
        settings: newSettings,
      });
      showToast(
        res.ok ? '✓ Dostupnost uložena' : ('Chyba: ' + (res.error || 'Neznámá chyba')),
        res.ok ? 'success' : 'error'
      );
    } else {
      showToast('Demo režim — uložení simulováno', 'info');
    }
  });

  // Enable/disable time inputs based on open checkbox
  WEEKDAY_KEYS.forEach((weekday) => {
    const checkbox = form.querySelector(`input[name="day_${weekday}_open"]`);
    const startInput = form.querySelector(`input[name="day_${weekday}_start"]`);
    const endInput = form.querySelector(`input[name="day_${weekday}_end"]`);

    checkbox?.addEventListener('change', () => {
      startInput.disabled = !checkbox.checked;
      endInput.disabled = !checkbox.checked;
    });
  });
}

export function destroy() {
  // Cleanup if needed
}
