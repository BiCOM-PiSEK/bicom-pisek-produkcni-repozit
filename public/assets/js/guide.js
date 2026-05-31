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

  // Handle booking form submission
  if (formEl) {
    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const submitBtn = formEl.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = "Odesílám...";
      submitBtn.disabled = true;

      const data = {
        name: document.getElementById("booking-name").value,
        email: document.getElementById("booking-email").value,
        phone: document.getElementById("booking-phone").value,
        service: document.getElementById("booking-service").value,
        preferred_date: document.getElementById("booking-date").value,
        psc: document.getElementById("booking-psc").value || null,
        note: document.getElementById("booking-note").value || null,
        consent_marketing: document.getElementById("booking-marketing").checked ? 1 : 0
      };

      try {
        const res = await fetch("/api/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await res.json();
        
        if (res.ok && result.success) {
          showToast("Poptávka byla úspěšně odeslána. Brzy vás budeme kontaktovat.", "success");
          formEl.reset();
        } else {
          showToast(result.error || "Odeslání poptávky selhalo. Zkontrolujte údaje.", "error");
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
