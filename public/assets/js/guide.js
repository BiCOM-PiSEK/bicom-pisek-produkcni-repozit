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

  let servicesCache = null;

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
  let bookingConfig = { stripe_deposit_required: true };
  
  async function initBookingConfig() {
    try {
      const res = await fetch("/api/booking-config");
      if (res.ok) {
        bookingConfig = await res.json();
      }
    } catch (err) {
      console.error("[guide] Error fetching booking config:", err);
    }

    const submitBtn = formEl ? formEl.querySelector('button[type="submit"]') : null;

    if (formEl && !bookingConfig.stripe_deposit_required) {
      // Insert payment choice HTML above submit actions
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

        // Add change listeners to radios to adjust button text and classes
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
              if (e.target.value === 'stripe') {
                submitBtn.textContent = "Dokončit rezervaci a přejít k platbě";
              } else {
                submitBtn.textContent = "Odeslat předběžnou rezervaci";
              }
            }
          });
        });

        if (submitBtn) {
          submitBtn.textContent = "Dokončit rezervaci a přejít k platbě";
        }
      }
    } else if (submitBtn && bookingConfig.stripe_deposit_required) {
      submitBtn.textContent = "Odeslat a zaplatit zálohu (500 Kč)";
    }
  }

  if (formEl) {
    initBookingConfig();
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

      const data = {
        name: document.getElementById("booking-name").value,
        email: document.getElementById("booking-email").value,
        phone: document.getElementById("booking-phone").value,
        service: serviceSelect.value,
        serviceName: serviceName,
        preferred_date: document.getElementById("booking-date").value,
        psc: document.getElementById("booking-psc").value || null,
        note: document.getElementById("booking-note").value || null,
        consent_marketing: document.getElementById("booking-marketing").checked ? 1 : 0
      };

      // Determine which workflow to use (Stripe vs. Free)
      const selectedMethodEl = formEl.querySelector('input[name="payment_method"]:checked');
      const method = selectedMethodEl ? selectedMethodEl.value : 'stripe';

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
