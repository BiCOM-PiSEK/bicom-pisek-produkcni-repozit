/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — CMS klient pro veřejný web (F11 + F12)
 * ═══════════════════════════════════════════════════════════════
 * Progressive enhancement: v HTML zůstává hardcoded fallback; pokud
 * CMS API odpoví, obsah se nahradí. Když API selže, vidí návštěvník
 * původní obsah.
 *
 * Data-atributy (opt-in):
 *   <div data-cms-section="key">…fallback…</div>          — text/HTML sekce
 *   <div class="gallery-grid" data-cms-gallery="key">…</div> — galerie
 *   <section data-cms-hero="page"> … data-cms-hero-field … </section>
 *   <span data-cms-nap="phone|email|street|…">…</span>     — sdílené NAP/footer
 *
 * Náhled (F12): když běží pod /admin/preview/* (window.__CMS_PREVIEW__),
 * klient čte z chráněných /admin/* endpointů s ?preview=1 (zobrazí KONCEPTY).
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var PREVIEW = !!window.__CMS_PREVIEW__;

  /**
   * Sestaví URL endpointu dle režimu (veřejný vs. náhled konceptů).
   * @param {'content'|'gallery'|'hero'} kind
   * @param {string} key
   * @returns {string}
   */
  function endpoint(kind, key) {
    var k = encodeURIComponent(key);
    if (PREVIEW) {
      if (kind === 'gallery') return '/admin/gallery?key=' + k;
      return '/admin/' + kind + '?key=' + k + '&preview=1';
    }
    return '/api/' + kind + '?key=' + k;
  }

  /**
   * Stáhne JSON a vrátí pole `data` (vyhodí při chybě/ok:false).
   * @param {string} url
   * @returns {Promise<*>}
   */
  async function getJSON(url) {
    var res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var body = await res.json();
    if (body.ok === false) throw new Error(body.error || 'CMS error');
    return body.data;
  }

  /** Bezpečná URL pro href/pozadí. @param {string} v @returns {boolean} */
  function isSafeUrl(v) {
    return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(String(v || '').trim());
  }

  /** Escapuje hodnotu do HTML atributu. @param {string} s @returns {string} */
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /**
   * Nahradí obsah elementu textovou sekcí z CMS.
   * (content je sanitizováno na serveru při zápisu → innerHTML je bezpečné.)
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function renderSection(key, el) {
    try {
      var data = await getJSON(endpoint('content', key));
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
      var data = await getJSON(endpoint('gallery', key));
      var items = (data && data.items) || [];
      if (!items.length) return;
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
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function applyHero(key, el) {
    try {
      var data = await getJSON(endpoint('hero', key));
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

  /**
   * Naplní všechny [data-cms-nap] prvky ze sdíleného configu `site-nap`.
   * Pole 'phone'/'email' na <a> nastaví i href (tel:/mailto:).
   */
  async function applyNap() {
    var nodes = document.querySelectorAll('[data-cms-nap]');
    if (!nodes.length) return;
    try {
      var data = await getJSON(endpoint('content', 'site-nap'));
      if (!data || !data.content) return;
      var nap = JSON.parse(data.content);
      nodes.forEach(function (node) {
        var field = node.getAttribute('data-cms-nap');
        var val = nap[field];
        if (val == null || val === '') return;
        node.textContent = val;
        if (node.tagName === 'A') {
          if (field === 'phone') node.setAttribute('href', 'tel:' + (nap.phoneHref || val).replace(/\s+/g, ''));
          else if (field === 'email') node.setAttribute('href', 'mailto:' + val);
        }
      });
    } catch (err) {
      console.warn('[cms] NAP — ponechán fallback:', err.message);
    }
  }

  /**
   * Naplní opakované karty (info-karty/cert-karty) z JSON pole dle pořadí —
   * SVG ikony v HTML zůstávají, mění se jen nadpis (h3) a text (p).
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function applyList(key, el) {
    try {
      var data = await getJSON(endpoint('content', key));
      if (!data || !data.content) return;
      var items = JSON.parse(data.content);
      if (!Array.isArray(items)) return;
      var cards = el.querySelectorAll('.info-card, .cert-card');
      items.forEach(function (it, i) {
        var card = cards[i];
        if (!card) return;
        var h = card.querySelector('h3');
        if (h && it.title != null) h.textContent = it.title;
        var p = card.querySelector('p');
        if (p && it.text != null) p.textContent = it.text;
      });
    } catch (err) {
      console.warn('[cms] list "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /**
   * Naplní rezervační <select id="booking-service"> seznamem služeb z DB.
   * Ponechá placeholder; při chybě nechá hardcoded options jako fallback.
   */
  async function populateBookingSelect() {
    var sel = document.getElementById('booking-service');
    if (!sel) return;
    try {
      var url = PREVIEW ? '/admin/services?preview=1' : '/api/services';
      var res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      if (!res.ok) return;
      var body = await res.json();
      var list = Array.isArray(body) ? body : ((body.data && body.data.services) || []);
      if (!list.length) return;
      var placeholder = sel.querySelector('option[value=""]');
      sel.innerHTML = '';
      if (placeholder) {
        sel.appendChild(placeholder);
      } else {
        var o = document.createElement('option');
        o.value = ''; o.disabled = true; o.selected = true; o.textContent = 'Vyberte program...';
        sel.appendChild(o);
      }
      list.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.slug;
        opt.textContent = s.name;
        sel.appendChild(opt);
      });
    } catch (err) {
      console.warn('[cms] booking select — ponechán fallback:', err.message);
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
    document.querySelectorAll('[data-cms-list]').forEach(function (el) {
      applyList(el.getAttribute('data-cms-list'), el);
    });
    applyNap();
    populateBookingSelect();
  }

  window.CMS = { renderSection, loadGallery, applyHero, applyList, applyNap, populateBookingSelect, init, preview: PREVIEW };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
