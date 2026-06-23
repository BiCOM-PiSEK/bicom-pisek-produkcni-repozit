/*
  Bicom Písek — Interaktivní Průvodce (guide.js)
  Řídí interaktivní výběr programů z katalogu služeb v D1.
*/

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".guide-btn");
  const titleEl = document.getElementById("guide-title");
  const descEl = document.getElementById("guide-description");
  const sessionsEl = document.getElementById("guide-sessions");
  const priceEl = document.getElementById("guide-price");
  const ctaEl = document.getElementById("guide-cta");
  const formEl = document.getElementById("booking-form");
  const bookingDateEl = document.getElementById("booking-date");
  const bookingAddressEl = document.getElementById("booking-address");
  const bookingAddressSuggestionsEl = document.getElementById("booking-address-suggestions");
  const bookingPscEl = document.getElementById("booking-psc");
  const bookingTimeWrapEl = document.getElementById("booking-time-wrap");
  const bookingSlotsEl = document.getElementById("booking-slots");
  const bookingSlotStartEl = document.getElementById("booking-slot-start");

  let servicesCache = null;
  let selectedSlot = null;
  let availabilityRequestSeq = 0;
  let placeSuggestDebounce = null;
  let placeSuggestRequestSeq = 0;

  /**
   * Fetches services from API.
   */
  async function loadServices() {
    if (servicesCache) return servicesCache;
    try {
      const res = await fetch("/api/services");
      if (res.ok) {
        servicesCache = await res.json();
      }
    } catch (err) {
      console.error("[guide] Error fetching services:", err);
    }
    return servicesCache || [];
  }

  /**
   * Updates interactive guide content.
   */
  function updateGuideContent(service) {
    if (!service) return;

    // Fade out animation
    const card = document.querySelector(".guide-card");
    if (card) card.style.opacity = "0.4";

    const visualEl = document.querySelector(".guide-placeholder-visual");

    setTimeout(() => {
      titleEl.textContent = service.name;
      descEl.textContent = service.short_desc || "Tento program se zaměřuje na vyhodnocení zátěží a obnovu rovnováhy.";
      sessionsEl.textContent = `Doporučený rozsah: ${service.sessions_typ || '3–6 sezení'}`;
      priceEl.textContent = `Orientační cena: ${service.price_avg || '1200'} Kč / sezení`;
      
      // Update CTA link to go to dynamic SPA route
      ctaEl.setAttribute("href", `/sluzby/${service.slug}`);
      ctaEl.textContent = "Zobrazit detaily programu";
      
      // Update icon visual
      if (visualEl) {
        visualEl.innerHTML = `
          <img src="/assets/img/icons/icon-${service.slug}.webp" alt="Ikona ${service.name}" style="width: 55%; height: 55%; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(58,74,60,0.12)); animation: scaleUp 0.3s ease-out;" class="guide-icon-img">
        `;
      }
      
      if (card) card.style.opacity = "1";
    }, 150);
  }

  // Handle guide buttons click
  buttons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const slug = btn.getAttribute("data-slug");
      
      // Set active button state
      buttons.forEach(b => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");

      const services = await loadServices();
      const selected = services.find(s => s.slug === slug);
      
      if (selected) {
        updateGuideContent(selected);
      }
    });
  });

  // Load configuration and initialize payment options if not mandatory
  let bookingConfig = {
    stripe_deposit_required: false,
    stripe_enabled: false,
    require_phone: true,
    turnstile_enabled: false,
    turnstile_sitekey: null
  };
  let turnstileToken = null;
  let turnstileWidgetId = null;

  // Phone prefix UX: fixed +420 badge (backend only accepts Czech numbers)
  (function initPhonePrefix() {
    const wrap = document.getElementById('phone-input-wrap');
    const badge = document.getElementById('phone-prefix-badge');
    const hint = document.getElementById('phone-prefix-hint');
    const btn = document.getElementById('phone-change-prefix-btn');
    if (!wrap || !badge || !hint || !btn) return;
    // Toggle is disabled: backend accepts +420 only.
    // Hide the "Jiná předvolba?" hint to keep UI clean.
    hint.style.display = 'none';
  })();

  /**
   * Normalizes a Czech phone number to E.164 (+420XXXXXXXXX).
   * Strips all non-digit chars (except leading +), then prepends +420
   * if not already present. Backend validates /^\+420\d{9}$/.
   */
  function normalizePhone(raw) {
    // Strip everything except digits and leading +
    let s = raw.trim().replace(/[^\d+]/g, '');
    if (!s) return s;
    if (s.startsWith('+')) return s;           // already E.164
    if (s.startsWith('00420')) return '+' + s.slice(2);
    if (s.startsWith('420')) return '+' + s;
    if (s.startsWith('0')) return '+420' + s.slice(1);
    return '+420' + s;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function fetchPlaceSuggestions(query) {
    const res = await fetch(`/api/places/suggest?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.ok ? (data.suggestions || []) : [];
  }

  function hidePlaceSuggestions() {
    if (!bookingAddressSuggestionsEl) return;
    bookingAddressSuggestionsEl.style.display = 'none';
    bookingAddressSuggestionsEl.innerHTML = '';
  }

  function selectPlaceSuggestion(item) {
    if (!bookingAddressEl) return;
    bookingAddressEl.value = item.title || '';
    if (bookingPscEl && item.postalCode) bookingPscEl.value = String(item.postalCode).replace(/\D+/g, '').slice(0, 5);
    hidePlaceSuggestions();
  }

  function renderPlaceSuggestions(items) {
    if (!bookingAddressSuggestionsEl) return;
    if (!items.length) {
      hidePlaceSuggestions();
      return;
    }

    const listHtml = items.map((item, index) => `
      <button type="button" data-suggest-index="${index}" style="display:block; width:100%; text-align:left; border:0; background:#fff; padding:10px 12px; cursor:pointer; border-bottom:1px solid #eef2f5;">
        <strong style="display:block; font-size:0.9rem; color:var(--c-forest);">${escapeHtml(item.title || '')}</strong>
        <span style="display:block; font-size:0.8rem; color:#687076;">${escapeHtml(item.subtitle || item.city || '')}</span>
      </button>
    `).join('');

    bookingAddressSuggestionsEl.innerHTML = `
      <div style="position:absolute; top:0; left:0; right:0; z-index:20; border:1px solid #d4dce2; border-radius:8px; overflow:hidden; box-shadow:0 8px 25px rgba(0,0,0,0.08); max-height:240px; overflow-y:auto; background:#fff;">
        ${listHtml}
      </div>
    `;
    bookingAddressSuggestionsEl.style.display = 'block';

    bookingAddressSuggestionsEl.querySelectorAll('[data-suggest-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number.parseInt(btn.getAttribute('data-suggest-index'), 10);
        if (Number.isInteger(idx) && items[idx]) selectPlaceSuggestion(items[idx]);
      });
    });
  }

  function bindAddressAutocomplete() {
    if (!bookingAddressEl || !bookingAddressSuggestionsEl) return;

    bookingAddressEl.addEventListener('input', () => {
      const query = bookingAddressEl.value.trim();
      if (placeSuggestDebounce) clearTimeout(placeSuggestDebounce);

      if (query.length < 3) {
        hidePlaceSuggestions();
        return;
      }

      placeSuggestDebounce = setTimeout(async () => {
        const requestSeq = ++placeSuggestRequestSeq;
        const queryAtRequest = query;
        try {
          const suggestions = await fetchPlaceSuggestions(query);
          if (requestSeq !== placeSuggestRequestSeq) return;
          if (!bookingAddressEl || bookingAddressEl.value.trim() !== queryAtRequest) return;
          renderPlaceSuggestions(suggestions);
        } catch (err) {
          console.error('[booking] Places suggest error:', err);
          hidePlaceSuggestions();
        }
      }, 280);
    });

    bookingAddressEl.addEventListener('blur', () => {
      // Delay to allow suggestion click before closing dropdown.
      setTimeout(() => {
        hidePlaceSuggestions();
      }, 120);
    });

    bookingAddressEl.addEventListener('focus', () => {
      if (bookingAddressSuggestionsEl.innerHTML) bookingAddressSuggestionsEl.style.display = 'block';
    });

    document.addEventListener('click', (event) => {
      if (!bookingAddressSuggestionsEl || !bookingAddressEl) return;
      const clickedInsideInput = bookingAddressEl.contains(event.target);
      const clickedInsideMenu = bookingAddressSuggestionsEl.contains(event.target);
      if (!clickedInsideInput && !clickedInsideMenu) {
        hidePlaceSuggestions();
      }
    });
  }

  function updatePhoneRequirement() {
    const phoneInput = document.getElementById("booking-phone");
    if (!phoneInput) return;

    const phoneLabel = document.querySelector('label[for="booking-phone"]');
    const channelSelect = document.getElementById("booking-reminder-channel");
    const channel = channelSelect ? channelSelect.value : 'email';
    
    const requirePhone = bookingConfig ? bookingConfig.require_phone : true;
    const isPhoneRequired = requirePhone || (channel === 'sms');
    
    if (isPhoneRequired) {
      phoneInput.setAttribute("required", "");
      if (phoneLabel) phoneLabel.innerHTML = 'Telefon *';
    } else {
      phoneInput.removeAttribute("required");
      if (phoneLabel) phoneLabel.innerHTML = 'Telefon';
    }
  }

  async function initBookingConfig() {
    try {
      const res = await fetch("/api/booking-config");
      if (res.ok) {
        bookingConfig = await res.json();
      }
    } catch (err) {
      console.error("[guide] Error fetching booking config:", err);
    }

    updatePhoneRequirement();

    const channelSelect = document.getElementById("booking-reminder-channel");
    if (channelSelect) {
      channelSelect.addEventListener("change", updatePhoneRequirement);
    }

    const submitBtn = formEl ? formEl.querySelector('button[type="submit"]') : null;

    if (formEl && bookingConfig.turnstile_enabled && bookingConfig.turnstile_sitekey) {
      const actionsContainer = formEl.querySelector('.booking-actions');
      if (actionsContainer && !document.getElementById('booking-turnstile')) {
        const turnstileWrap = document.createElement('div');
        turnstileWrap.className = 'form-group form-full';
        turnstileWrap.innerHTML = `
          <div id="booking-turnstile" style="display:flex; justify-content:center;"></div>
        `;
        formEl.insertBefore(turnstileWrap, actionsContainer);
      }

      await renderTurnstile();
    }

    if (formEl && bookingConfig.stripe_enabled && !bookingConfig.stripe_deposit_required) {
      // Stripe is configured but optional: show payment choice
      const actionsContainer = formEl.querySelector('.booking-actions');
      if (actionsContainer) {
        const choiceContainer = document.createElement('div');
        choiceContainer.id = 'payment-options-container';
        choiceContainer.className = 'form-group form-full';
        choiceContainer.style.marginTop = '1.5rem';
        choiceContainer.style.borderTop = '1px solid rgba(115,138,117,0.15)';
        choiceContainer.style.paddingTop = '1.5rem';
        choiceContainer.style.marginBottom = '1.5rem';
        choiceContainer.innerHTML = `
          <label class="form-label" style="font-weight: 600; margin-bottom: 0.75rem; display: block; color: var(--c-forest);">Způsob dokončení rezervace</label>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer; padding: 0.75rem; border: 1px solid var(--c-sage); border-radius: 8px; background-color: #fafbfc; transition: all 0.2s ease;">
              <input type="radio" name="payment_method" value="stripe" checked style="margin-top: 0.2rem;">
              <div>
                <strong style="color: var(--c-forest); display: block;">Uhradit zálohu 500 Kč online (kartou / Apple Pay / Google Pay)</strong>
                <p style="font-size: 0.85rem; color: #555; margin: 4px 0 0 0; line-height: 1.4;">Zabezpečená platba přes Stripe. Rezervace s uhrazenou zálohou mají nejvyšší prioritu a jsou potvrzeny okamžitě.</p>
              </div>
            </label>
            <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer; padding: 0.75rem; border: 1px solid #e1e4e6; border-radius: 8px; transition: all 0.2s ease;">
              <input type="radio" name="payment_method" value="free" style="margin-top: 0.2rem;">
              <div>
                <strong style="display: block;">Rezervovat předběžně bez platby předem</strong>
                <p style="font-size: 0.85rem; color: #767a7d; margin: 4px 0 0 0; line-height: 1.4;">Rezervace zdarma jsou pouze předběžné a termín může být obsazen klienty s prioritní platbou. Budete zařazeni do pořadníku a pro potvrzení vás kontaktujeme telefonicky.</p>
              </div>
            </label>
          </div>
        `;
        formEl.insertBefore(choiceContainer, actionsContainer);

        const radios = choiceContainer.querySelectorAll('input[name="payment_method"]');
        radios.forEach(radio => {
          radio.addEventListener('change', (e) => {
            radios.forEach(r => {
              const label = r.closest('label');
              const str = label.querySelector('strong');
              if (r.checked) {
                label.style.borderColor = 'var(--c-sage)';
                label.style.backgroundColor = '#fafbfc';
                str.style.color = 'var(--c-forest)';
              } else {
                label.style.borderColor = '#e1e4e6';
                label.style.backgroundColor = 'transparent';
                str.style.color = 'inherit';
              }
            });
            if (submitBtn) {
              submitBtn.textContent = e.target.value === 'stripe'
                ? "Dokončit rezervaci a přejít k platbě"
                : "Odeslat předběžnou rezervaci";
            }
          });
        });

        if (submitBtn) submitBtn.textContent = "Dokončit rezervaci a přejít k platbě";
      }
    } else if (submitBtn && bookingConfig.stripe_enabled && bookingConfig.stripe_deposit_required) {
      // Stripe mandatory
      submitBtn.textContent = "Odeslat a zaplatit zálohu (500 Kč)";
    } else if (submitBtn) {
      // Stripe not configured: simple free booking
      submitBtn.textContent = "Odeslat rezervaci";
    }
  }

  function loadTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-turnstile="booking"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = 'booking';
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Turnstile script failed to load.')), { once: true });
      document.head.appendChild(script);
    });
  }

  async function renderTurnstile() {
    const container = document.getElementById('booking-turnstile');
    if (!container) return;

    try {
      await loadTurnstileScript();
      if (!window.turnstile) return;

      if (turnstileWidgetId !== null) {
        window.turnstile.remove(turnstileWidgetId);
      }
      turnstileToken = null;
      turnstileWidgetId = window.turnstile.render('#booking-turnstile', {
        sitekey: bookingConfig.turnstile_sitekey,
        callback: (token) => {
          turnstileToken = token;
        },
        'expired-callback': () => {
          turnstileToken = null;
        },
        'error-callback': () => {
          turnstileToken = null;
        }
      });
    } catch (err) {
      console.error('[booking] Turnstile init failed:', err);
    }
  }

  if (formEl) {
    initBookingConfig();
    bindAddressAutocomplete();
  }

  // Load availability for a date
  async function loadAvailability(dateStr) {
    try {
      const res = await fetch(`/api/availability?from=${dateStr}&to=${dateStr}`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.error("[guide] Availability error:", err);
    }
    return null;
  }

  // Render time slots
  function renderTimeSlots(availData, dateStr) {
    if (!availData || !availData.days) {
      bookingSlotsEl.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'Chyba při načítání dostupnosti. Zkuste znovu.';
      p.style.cssText = 'color: var(--c-sage); font-size: 0.9rem;';
      bookingSlotsEl.appendChild(p);
      return;
    }
    const dayData = availData.days.find(d => d.date === dateStr);
    if (!dayData || !dayData.slots || dayData.slots.length === 0) {
      bookingSlotsEl.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = 'V tento den není volno, zkuste jiný.';
      p.style.cssText = 'color: var(--c-sage); font-size: 0.9rem;';
      bookingSlotsEl.appendChild(p);
      selectedSlot = null;
      bookingSlotStartEl.value = '';
      return;
    }
    bookingSlotsEl.innerHTML = '';
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; flex-wrap: wrap; gap: 0.75rem;';
    dayData.slots.forEach(slot => {
      const time = slot.start.split(' ')[1];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = time;
      btn.dataset.slotStart = slot.start;
      btn.style.cssText = 'padding: 0.6rem 1.2rem; border: 1px solid var(--c-sage); background-color: transparent; color: var(--c-sage); border-radius: 20px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease;';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('[data-slot-start]').forEach(b => {
          b.style.backgroundColor = 'transparent';
          b.style.color = 'var(--c-sage)';
        });
        btn.style.backgroundColor = 'var(--c-sage)';
        btn.style.color = 'var(--c-white)';
        selectedSlot = slot.start;
        bookingSlotStartEl.value = slot.start;
      });
      container.appendChild(btn);
    });
    bookingSlotsEl.appendChild(container);
  }

  // Handle date change
  if (bookingDateEl) {
    bookingDateEl.addEventListener('change', async () => {
      const dateStr = bookingDateEl.value;
      if (!dateStr) {
        bookingTimeWrapEl.hidden = true;
        return;
      }
      // Clear slot immediately (CR-2: prevent race condition)
      selectedSlot = null;
      bookingSlotStartEl.value = '';
      // Sequential guard: ignore out-of-order responses
      const reqSeq = ++availabilityRequestSeq;
      bookingSlotsEl.innerHTML = '';
      const loading = document.createElement('p');
      loading.textContent = 'Načítám dostupnost...';
      loading.style.cssText = 'color: var(--c-sage); font-size: 0.9rem;';
      bookingSlotsEl.appendChild(loading);
      bookingTimeWrapEl.hidden = false;
      const availData = await loadAvailability(dateStr);
      // Ignore if newer request already arrived
      if (reqSeq !== availabilityRequestSeq) return;
      renderTimeSlots(availData, dateStr);
    });
  }

  // Handle booking form submission
  if (formEl) {
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = formEl.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Odesílám...";
      submitBtn.disabled = true;

      const serviceSelect = document.getElementById("booking-service");
      const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text;

      const reminderEl = document.getElementById("booking-reminder-channel");
      const preferred_date = document.getElementById("booking-date").value;

      // Validate: slot is required ONLY if actual slots exist (CR-1)
      const hasAvailableSlots = Boolean(bookingSlotsEl?.querySelector('[data-slot-start]'));
      if (hasAvailableSlots && !bookingSlotStartEl.value) {
        showToast("Vyberte prosím čas", "error");
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }

      const data = {
        name: document.getElementById("booking-name").value,
        email: document.getElementById("booking-email").value,
        phone: normalizePhone(document.getElementById("booking-phone").value),
        service: serviceSelect.value,
        serviceName: serviceName,
        preferred_date: preferred_date,
        slot_start: bookingSlotStartEl.value || null,
        psc: document.getElementById("booking-psc").value || null,
        address: bookingAddressEl ? bookingAddressEl.value.trim() || null : null,
        note: document.getElementById("booking-note").value || null,
        consent_processing: document.getElementById("booking-consent-processing").checked,
        consent_marketing: document.getElementById("booking-marketing").checked,
        reminder_channel: reminderEl ? reminderEl.value : "email",
        turnstile_token: turnstileToken
      };

      if (bookingConfig.turnstile_enabled && !turnstileToken) {
        showToast("Potvrďte prosím bezpečnostní ověření (nejsem robot).", "error");
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Determine which workflow to use (Stripe vs. Free)
      const selectedMethodEl = formEl.querySelector('input[name="payment_method"]:checked');
      const method = selectedMethodEl ? selectedMethodEl.value : (bookingConfig.stripe_enabled ? 'stripe' : 'free');

      try {
        if (method === 'stripe') {
          // Stripe checkout redirect flow
          const res = await fetch("/api/stripe-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });

          const result = await res.json();
          
          if (res.ok && result.url) {
            showToast("Přesměrovávám na platební bránu...", "success");
            window.location.href = result.url;
          } else {
            showToast(result.message || result.error || "Příprava platby selhala.", "error");
          }
        } else {
          // Direct booking flow (free/unpaid)
          const res = await fetch("/api/book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
          });

          const result = await res.json();
          
          if (res.ok && result.success) {
            showToast("Poptávka byla úspěšně odeslána. Přesměrovávám...", "success");
            formEl.reset();
            // Redirect to confirmations page with free=true
            window.location.href = `/rezervace-potvrzena?id=${result.bookingId}&free=true`;
          } else {
            showToast(result.error || "Odeslání poptávky selhalo. Zkontrolujte údaje.", "error");
          }
        }
      } catch (err) {
        console.error("[booking] Form submit error:", err);
        showToast("Chyba při komunikaci se serverem.", "error");
      } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  /**
   * Helper to show alert toasts (WCAG AA).
   */
  function showToast(message, type = "success") {
    let toast = document.getElementById("toast-msg");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast-msg";
      toast.setAttribute("role", "alert");
      toast.style.position = "fixed";
      toast.style.bottom = "24px";
      toast.style.left = "50%";
      toast.style.transform = "translateX(-50%)";
      toast.style.padding = "1rem 2rem";
      toast.style.borderRadius = "12px";
      toast.style.fontSize = "0.95rem";
      toast.style.zIndex = "1001";
      toast.style.boxShadow = "0 4px 15px rgba(0,0,0,0.15)";
      toast.style.transition = "all 0.3s ease";
      document.body.appendChild(toast);
    }

    if (type === "success") {
      toast.style.backgroundColor = "var(--c-sage)";
      toast.style.color = "var(--c-white)";
    } else {
      toast.style.backgroundColor = "var(--c-error)";
      toast.style.color = "var(--c-white)";
    }

    toast.textContent = message;
    toast.style.opacity = "1";
    toast.style.visibility = "visible";

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.visibility = "hidden";
    }, 4000);
  }
});
