/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS klient pro veřejný web (F11)
 * ═══════════════════════════════════════════════════════════════
 * Dynamicky doplňuje obsah z CMS API do stránky. Princip „progressive
 * enhancement": v HTML zůstává hardcoded obsah jako fallback; pokud API
 * odpoví, obsah se nahradí. Když API selže, návštěvník vidí původní obsah.
 *
 * Použití v HTML (opt-in přes data-atributy):
 *   <div data-cms-section="ordinace-intro"> …fallback… </div>
 *   <div class="gallery-grid" data-cms-gallery="ordinace"> …fallback… </div>
 *   <section data-cms-hero="homepage">
 *     <h1 data-cms-hero-field="headline">…</h1>
 *     <p  data-cms-hero-field="subheadline">…</p>
 *     <a  data-cms-hero-field="cta_link">Tlačítko</a>
 *   </section>
 *
 * Načítá se samo po DOMContentLoaded; lze volat i ručně přes window.CMS.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /**
   * Stáhne JSON z CMS API a vrátí pole `data` (vyhodí při chybě/ok:false).
   * @param {string} url
   * @returns {Promise<*>}
   */
  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const body = await res.json();
    if (body.ok === false) throw new Error(body.error || 'CMS error');
    return body.data;
  }

  /**
   * Bezpečná URL pro href/pozadí: jen http(s), mailto, tel, relativní cesta, kotva.
   * @param {string} value
   * @returns {boolean}
   */
  function isSafeUrl(value) {
    return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(String(value || '').trim());
  }

  /**
   * Escapuje hodnotu pro vložení do HTML atributu.
   * @param {string} s
   * @returns {string}
   */
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Nahradí obsah elementu textovou sekcí z CMS.
   * Pozn.: `content` je sanitizováno na serveru při zápisu (functions/lib/sanitize.js),
   * proto je vložení přes innerHTML bezpečné.
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function renderSection(key, el) {
    try {
      const data = await getJSON('/api/content?key=' + encodeURIComponent(key));
      if (data && data.content) el.innerHTML = data.content;
    } catch (err) {
      console.warn('[cms] section "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /**
   * Vykreslí galerii obrázků do elementu.
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function loadGallery(key, el) {
    try {
      const data = await getJSON('/api/gallery?key=' + encodeURIComponent(key));
      const items = (data && data.items) || [];
      if (!items.length) return; // necháme fallback
      el.innerHTML = items.map(function (it) {
        return '<div class="gallery-item"><img src="' + escAttr(it.image_url) +
          '" alt="' + escAttr(it.caption || it.title || '') + '" loading="lazy"></div>';
      }).join('');
    } catch (err) {
      console.warn('[cms] gallery "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /**
   * Aplikuje hero konfiguraci na element a jeho [data-cms-hero-field] potomky.
   * URL (cta_link, pozadí) se validují proti bezpečným schématům.
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function applyHero(key, el) {
    try {
      const data = await getJSON('/api/hero?key=' + encodeURIComponent(key));
      if (!data) return;
      el.querySelectorAll('[data-cms-hero-field]').forEach(function (node) {
        var f = node.getAttribute('data-cms-hero-field');
        if (data[f] == null || data[f] === '') return;
        if (f === 'cta_link' && node.tagName === 'A') {
          if (isSafeUrl(data[f])) node.setAttribute('href', data[f]);
        } else {
          node.textContent = data[f];
        }
      });
      if (data.background_image_url && isSafeUrl(data.background_image_url)) {
        el.style.backgroundImage = 'url("' + escAttr(data.background_image_url) + '")';
      }
    } catch (err) {
      console.warn('[cms] hero "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /** Projde DOM a aplikuje CMS na všechny opt-in elementy. */
  function init() {
    document.querySelectorAll('[data-cms-section]').forEach(function (el) {
      renderSection(el.getAttribute('data-cms-section'), el);
    });
    document.querySelectorAll('[data-cms-gallery]').forEach(function (el) {
      loadGallery(el.getAttribute('data-cms-gallery'), el);
    });
    document.querySelectorAll('[data-cms-hero]').forEach(function (el) {
      applyHero(el.getAttribute('data-cms-hero'), el);
    });
  }

  window.CMS = { renderSection, loadGallery, applyHero, init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
