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
  var VISUAL_BRIDGE = PREVIEW && window.parent && window.parent !== window;
  var _vbBlocks = [];
  var _vbSelectedId = '';
  var _vbInitDone = false;
  var _vbPublishTimer = null;

  /** Naplánuje synchronizaci mapy CMS bloků pro Visual Builder. */
  function scheduleVisualMapSync() {
    if (!VISUAL_BRIDGE) return;
    if (_vbPublishTimer) clearTimeout(_vbPublishTimer);
    _vbPublishTimer = setTimeout(function () {
      publishVisualMap();
      _vbPublishTimer = null;
    }, 120);
  }

  /** Přidá CSS pro zvýraznění bloků v náhledu. */
  function ensureVisualStyles() {
    if (!VISUAL_BRIDGE) return;
    if (document.getElementById('cms-vb-style')) return;
    var style = document.createElement('style');
    style.id = 'cms-vb-style';
    style.textContent = [
      '[data-cms-vb-id]{scroll-margin-top:80px;}',
      '.cms-vb-selected{outline:3px solid #3A4A3C !important; outline-offset:2px; transition:outline-color .16s ease;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /** Vygeneruje deduplikovanou mapu CMS bloků z DOM. @returns {Array<Object>} */
  function collectVisualBlocks() {
    var blocks = [];
    var seen = Object.create(null);
    var idx = 0;
    var landingCity = (document.body && document.body.getAttribute('data-cms-landing')) || '';

    function push(node, type, key, sectionKey, field) {
      if (!node) return;
      var dedupe = [type || '', key || '', sectionKey || '', field || ''].join('|');
      if (seen[dedupe]) return;
      seen[dedupe] = true;
      idx += 1;
      var id = 'cmsvb-' + idx;
      node.setAttribute('data-cms-vb-id', id);
      blocks.push({
        id: id,
        type: type || '',
        key: key || '',
        sectionKey: sectionKey || '',
        field: field || ''
      });
    }

    document.querySelectorAll('[data-cms-section]').forEach(function (node) {
      var key = node.getAttribute('data-cms-section') || '';
      push(node, 'section', key, key, '');
    });
    document.querySelectorAll('[data-cms-list]').forEach(function (node) {
      var key = node.getAttribute('data-cms-list') || '';
      push(node, 'list', key, key, '');
    });
    document.querySelectorAll('[data-cms-gallery]').forEach(function (node) {
      var key = node.getAttribute('data-cms-gallery') || '';
      push(node, 'gallery', key, key, '');
    });
    document.querySelectorAll('[data-cms-hero]').forEach(function (node) {
      var key = node.getAttribute('data-cms-hero') || '';
      push(node, 'hero', key, key, '');
    });
    document.querySelectorAll('[data-cms-hero-field]').forEach(function (node) {
      var field = node.getAttribute('data-cms-hero-field') || '';
      var owner = node.closest('[data-cms-hero]');
      var key = owner ? (owner.getAttribute('data-cms-hero') || '') : '';
      push(node, 'heroField', key, key, field);
    });
    document.querySelectorAll('[data-cms-nap]').forEach(function (node) {
      var field = node.getAttribute('data-cms-nap') || '';
      push(node, 'nap', 'site-nap', 'site-nap', field);
    });
    document.querySelectorAll('[data-cms-faq]').forEach(function (node) {
      var key = node.getAttribute('data-cms-faq') || '';
      push(node, 'faq', key, key, '');
    });
    document.querySelectorAll('[data-cms-programs]').forEach(function (node) {
      push(node, 'programs', 'services', 'services', '');
    });
    if (document.body && document.body.getAttribute('data-cms-seo')) {
      var seoKey = document.body.getAttribute('data-cms-seo') || '';
      push(document.body, 'seo', seoKey, seoKey, '');
    }
    if (landingCity) {
      push(document.body, 'landing', landingCity, 'landing-' + landingCity, '');
    }
    document.querySelectorAll('[data-cms-landing-field]').forEach(function (node) {
      var field = node.getAttribute('data-cms-landing-field') || '';
      var key = landingCity || '';
      var sectionKey = key ? ('landing-' + key) : '';
      push(node, 'landingField', key, sectionKey, field);
    });

    return blocks;
  }

  /** Vrátí blok dle ID. @param {string} id @returns {Object|null} */
  function getVisualBlock(id) {
    for (var i = 0; i < _vbBlocks.length; i++) {
      if (_vbBlocks[i].id === id) return _vbBlocks[i];
    }
    return null;
  }

  /** Odešle zprávu parent oknu. @param {Object} payload */
  function postVisual(payload) {
    if (!VISUAL_BRIDGE) return;
    try { window.parent.postMessage(payload, window.location.origin); } catch (_) { /* noop */ }
  }

  /**
   * Nastaví aktivní výběr bloků v preview.
   * @param {string} id
   * @param {boolean} scroll
   * @param {boolean} fromParent
   */
  function selectVisualBlock(id, scroll, fromParent) {
    var prev = _vbSelectedId ? document.querySelector('[data-cms-vb-id="' + _vbSelectedId + '"]') : null;
    if (prev) prev.classList.remove('cms-vb-selected');
    _vbSelectedId = id || '';
    var el = _vbSelectedId ? document.querySelector('[data-cms-vb-id="' + _vbSelectedId + '"]') : null;
    if (!el) return;
    el.classList.add('cms-vb-selected');
    if (scroll) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { el.scrollIntoView(); }
    }
    if (!fromParent) {
      var block = getVisualBlock(_vbSelectedId);
      if (block) postVisual({ type: 'cms-vb-select', block: block });
    }
  }

  /** Přepočte a pošle mapu bloků do parent okna. */
  function publishVisualMap() {
    if (!VISUAL_BRIDGE) return;
    _vbBlocks = collectVisualBlocks();
    if (_vbSelectedId && !_vbBlocks.some(function (b) { return b.id === _vbSelectedId; })) {
      _vbSelectedId = '';
    }
    postVisual({ type: 'cms-vb-map', blocks: _vbBlocks });
  }

  /** Inicializuje message bridge pro Visual Builder. */
  function initVisualBridge() {
    if (!VISUAL_BRIDGE || _vbInitDone) return;
    _vbInitDone = true;
    ensureVisualStyles();

    window.addEventListener('message', function (event) {
      if (event.origin !== window.location.origin) return;
      var msg = event.data || {};
      if (msg.type === 'cms-vb-ping') {
        publishVisualMap();
        return;
      }
      if (msg.type === 'cms-vb-highlight') {
        selectVisualBlock(msg.id || '', !!msg.scroll, true);
        return;
      }
      if (msg.type === 'cms-vb-clear') {
        selectVisualBlock('', false, true);
      }
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;
      var el = target.closest('[data-cms-vb-id]');
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      selectVisualBlock(el.getAttribute('data-cms-vb-id') || '', false, false);
    }, true);

    scheduleVisualMapSync();
    setTimeout(scheduleVisualMapSync, 500);
    setTimeout(scheduleVisualMapSync, 1500);
  }

  /**
   * Sestaví URL endpointu dle režimu (veřejný vs. náhled konceptů).
   * @param {'content'|'gallery'|'hero'} kind
   * @param {string} key
   * @returns {string}
   */
  function endpoint(kind, key) {
    var k = encodeURIComponent(key);
    if (PREVIEW) {
      if (kind === 'gallery') return '/admin/gallery?key=' + k + '&preview=1';
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
      if (data && data.content) {
        el.innerHTML = data.content;
        scheduleVisualMapSync();
      }
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
      scheduleVisualMapSync();
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
      scheduleVisualMapSync();
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
      scheduleVisualMapSync();
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
      scheduleVisualMapSync();
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
      scheduleVisualMapSync();
    } catch (err) {
      console.warn('[cms] booking select — ponechán fallback:', err.message);
    }
  }

  /** Načte seznam služeb (preview vs. veřejné). @returns {Promise<Array>} */
  async function fetchServices() {
    var url = PREVIEW ? '/admin/services?preview=1' : '/api/services';
    var res = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var body = await res.json();
    return Array.isArray(body) ? body : ((body.data && body.data.services) || []);
  }

  /** Nastaví obsah meta tagu, pokud existuje. @param {string} attr @param {string} val @param {string} content */
  function setMeta(attr, val, content) {
    if (content == null || content === '') return;
    var m = document.querySelector('meta[' + attr + '="' + val + '"]');
    if (m) m.setAttribute('content', content);
  }

  /**
   * Aplikuje SEO meta (title, description, og:*, canonical) z config bloku.
   * Pozn.: fallback meta zůstávají v HTML pro crawlery; tohle je klientský překryv.
   * @param {string} key
   */
  async function applySeo(key) {
    try {
      var data = await getJSON(endpoint('content', key));
      if (!data || !data.content) return;
      var seo = JSON.parse(data.content);
      if (seo.title) document.title = seo.title;
      setMeta('name', 'description', seo.description);
      setMeta('property', 'og:title', seo.ogTitle);
      setMeta('property', 'og:description', seo.ogDescription);
      setMeta('property', 'og:image', seo.ogImage);
      if (seo.canonical && isSafeUrl(seo.canonical)) {
        var l = document.querySelector('link[rel="canonical"]');
        if (l) l.setAttribute('href', seo.canonical);
      }
      scheduleVisualMapSync();
    } catch (err) {
      console.warn('[cms] SEO "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /**
   * Vyrenderuje FAQ karty z konfigu [{q,a}]. Odpověď (a) může obsahovat
   * bezpečné odkazy (sanitizováno serverem), proto innerHTML; otázka textContent.
   * @param {string} key
   * @param {HTMLElement} el
   */
  async function applyFaq(key, el) {
    try {
      var data = await getJSON(endpoint('content', key));
      if (!data || !data.content) return;
      var items = JSON.parse(data.content);
      if (!Array.isArray(items) || !items.length) return;
      el.innerHTML = '';
      items.forEach(function (it) {
        var card = document.createElement('div'); card.className = 'info-card';
        var inner = document.createElement('div');
        var h = document.createElement('h3'); h.textContent = it.q || '';
        var p = document.createElement('p'); p.style.margin = '0'; p.style.fontSize = '0.95rem';
        p.innerHTML = it.a || '';
        inner.appendChild(h); inner.appendChild(p); card.appendChild(inner); el.appendChild(card);
      });
      scheduleVisualMapSync();
    } catch (err) {
      console.warn('[cms] FAQ "' + key + '" — ponechán fallback:', err.message);
    }
  }

  /**
   * Vyrenderuje karty programů ze služeb (anchor id = slug pro kotvy z FAQ).
   * @param {HTMLElement} el
   */
  async function applyPrograms(el) {
    try {
      var list = await fetchServices();
      if (!list.length) return;
      el.innerHTML = '';
      list.forEach(function (s) {
        var a = document.createElement('a');
        a.className = 'info-card'; a.id = s.slug; a.href = '/#rezervace'; a.style.textDecoration = 'none';
        var div = document.createElement('div');
        var h = document.createElement('h3'); h.textContent = s.name;
        var p = document.createElement('p'); p.style.margin = '0'; p.style.fontSize = '0.9rem';
        p.textContent = s.short_desc || 'Komplementární biorezonanční program. Cena se zjistí v objednávce.';
        div.appendChild(h); div.appendChild(p); a.appendChild(div); el.appendChild(a);
      });
      scheduleVisualMapSync();
    } catch (err) {
      console.warn('[cms] programy — ponechán fallback:', err.message);
    }
  }

  /**
   * Vyplní per-město texty landing stránky z configu landing-<city>.
   * @param {string} city
   */
  async function applyLanding(city) {
    try {
      var data = await getJSON(endpoint('content', 'landing-' + city));
      if (!data || !data.content) return;
      var cfg = JSON.parse(data.content);
      document.querySelectorAll('[data-cms-landing-field]').forEach(function (node) {
        var f = node.getAttribute('data-cms-landing-field');
        if (cfg[f] != null && cfg[f] !== '') node.textContent = cfg[f];
      });
      scheduleVisualMapSync();
    } catch (err) {
      console.warn('[cms] landing "' + city + '" — ponechán fallback:', err.message);
    }
  }

  /** Projde DOM a aplikuje CMS na všechny opt-in elementy. */
  function init() {
    if (VISUAL_BRIDGE) initVisualBridge();
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
    document.querySelectorAll('[data-cms-faq]').forEach(function (el) {
      applyFaq(el.getAttribute('data-cms-faq'), el);
    });
    document.querySelectorAll('[data-cms-programs]').forEach(function (el) {
      applyPrograms(el);
    });
    var seoEl = document.querySelector('[data-cms-seo]');
    if (seoEl) applySeo(seoEl.getAttribute('data-cms-seo'));
    var landingEl = document.querySelector('[data-cms-landing]');
    if (landingEl) applyLanding(landingEl.getAttribute('data-cms-landing'));
    applyNap();
    populateBookingSelect();
    scheduleVisualMapSync();
    setTimeout(scheduleVisualMapSync, 600);
    setTimeout(scheduleVisualMapSync, 1800);
  }

  window.CMS = { renderSection, loadGallery, applyHero, applyList, applyFaq, applyPrograms, applySeo, applyLanding, applyNap, populateBookingSelect, init, preview: PREVIEW };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
