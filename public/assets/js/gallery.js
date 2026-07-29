/**
 * ═══════════════════════════════════════════════════════════════
 * BICOM PÍSEK — Interaktivní veřejná galerie
 * ═══════════════════════════════════════════════════════════════
 * - Featured pár (2 velké fotky) s automatickou crossfade rotací
 * - Posuvný pás všech fotek (3 viditelné, šipky + swipe/scroll)
 * - Lightbox s klávesovou navigací (Esc / ← / →)
 *
 * API: window.GalleryUI.render(rootEl, items)
 *   rootEl … element [data-cms-gallery]
 *   items  … [{ image_url, caption, title }]
 *
 * Rotace se pozastaví při hoveru/fokusu, skryté záložce,
 * otevřeném lightboxu a při prefers-reduced-motion se neaktivuje.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var ROTATE_MS = 7000;        // interval střídání featured fotek
  var FADE_FALLBACK_MS = 2500; // pojistka, kdyby preload obrázku nevrátil onload

  /** Escapuje text pro vložení do HTML/atributu. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var CHEV_LEFT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var CHEV_RIGHT = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  /* ----------------------------------------------------------
     Lightbox (singleton)
  ---------------------------------------------------------- */
  var lb = null;

  function buildLightbox() {
    if (lb) return lb;
    var el = document.createElement('div');
    el.className = 'gallery-lightbox';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Prohlížeč fotek');
    el.hidden = true;
    el.innerHTML =
      '<div class="glb-backdrop" data-glb-close></div>' +
      '<figure class="glb-stage">' +
        '<img class="glb-img" alt="">' +
        '<figcaption class="glb-caption"></figcaption>' +
      '</figure>' +
      '<button type="button" class="glb-btn glb-close" data-glb-close aria-label="Zavřít prohlížeč">×</button>' +
      '<button type="button" class="glb-btn glb-prev" aria-label="Předchozí fotka">' + CHEV_LEFT + '</button>' +
      '<button type="button" class="glb-btn glb-next" aria-label="Další fotka">' + CHEV_RIGHT + '</button>';
    document.body.appendChild(el);

    lb = {
      el: el,
      img: el.querySelector('.glb-img'),
      caption: el.querySelector('.glb-caption'),
      items: [],
      index: 0,
      lastFocus: null
    };

    el.querySelector('.glb-prev').addEventListener('click', function () { stepLightbox(-1); });
    el.querySelector('.glb-next').addEventListener('click', function () { stepLightbox(1); });
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-glb-close]')) closeLightbox();
    });
    document.addEventListener('keydown', function (ev) {
      if (el.hidden) return;
      if (ev.key === 'Escape') { ev.preventDefault(); closeLightbox(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepLightbox(-1); }
      else if (ev.key === 'ArrowRight') { ev.preventDefault(); stepLightbox(1); }
    });
    return lb;
  }

  function openLightbox(items, index) {
    var box = buildLightbox();
    box.items = items;
    box.index = index;
    box.lastFocus = document.activeElement;
    showLightboxItem();
    box.el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    box.el.querySelector('.glb-close').focus();
    notifyLightbox(true);
  }

  function showLightboxItem() {
    var it = lb.items[lb.index];
    if (!it) return;
    lb.img.src = it.image_url;
    lb.img.alt = it.caption || it.title || '';
    lb.caption.textContent = it.caption || it.title || '';
  }

  function stepLightbox(dir) {
    if (!lb || !lb.items.length) return;
    lb.index = (lb.index + dir + lb.items.length) % lb.items.length;
    showLightboxItem();
  }

  function closeLightbox() {
    if (!lb) return;
    lb.el.hidden = true;
    document.documentElement.style.overflow = '';
    if (lb.lastFocus && typeof lb.lastFocus.focus === 'function') lb.lastFocus.focus();
    notifyLightbox(false);
  }

  function notifyLightbox(open) {
    instances.forEach(function (inst) { inst.lightboxOpen = open; });
  }

  /* ----------------------------------------------------------
     Instance galerie (per [data-cms-gallery])
  ---------------------------------------------------------- */
  var instances = [];

  function findInstance(root) {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].root === root) return instances[i];
    }
    return null;
  }

  /** Posbírá položky ze statického fallback obsahu (dle src, bez duplicit). */
  function collectFromDom(root) {
    var seen = {};
    var out = [];
    root.querySelectorAll('img').forEach(function (img) {
      var src = img.getAttribute('src');
      if (!src || seen[src]) return;
      seen[src] = true;
      var alt = img.getAttribute('alt') || '';
      out.push({ image_url: src, caption: alt, title: alt });
    });
    return out;
  }

  /** Sestaví HTML featured páru + posuvného pásu. */
  function buildMarkup(items, featuredIdx) {
    var html = '<div class="gallery-featured">';
    featuredIdx.forEach(function (idx) {
      var it = items[idx];
      var alt = it.caption || it.title || '';
      html +=
        '<button type="button" class="gallery-featured-item gallery-item" data-idx="' + idx + '" aria-label="Zvětšit fotku: ' + esc(alt || (idx + 1)) + '">' +
          '<img class="gl-layer is-active" src="' + esc(it.image_url) + '" alt="' + esc(alt) + '" loading="lazy">' +
          (items.length >= 3 ? '<img class="gl-layer" alt="" aria-hidden="true">' : '') +
        '</button>';
    });
    html += '</div>';

    html += '<div class="gallery-strip">' +
      '<button type="button" class="gallery-nav gallery-nav-prev" aria-label="Posunout galerii doleva">' + CHEV_LEFT + '</button>' +
      '<div class="gallery-strip-viewport"><div class="gallery-strip-track">';
    items.forEach(function (it, i) {
      var alt = it.caption || it.title || '';
      html +=
        '<button type="button" class="gallery-strip-item gallery-item" data-idx="' + i + '" aria-label="Zvětšit fotku: ' + esc(alt || (i + 1)) + '">' +
          '<img src="' + esc(it.image_url) + '" alt="' + esc(alt) + '" loading="lazy">' +
        '</button>';
    });
    html += '</div></div>' +
      '<button type="button" class="gallery-nav gallery-nav-next" aria-label="Posunout galerii doprava">' + CHEV_RIGHT + '</button>' +
      '</div>';
    return html;
  }

  /**
   * Překreslí galerii v root elementu a naváže interakce.
   * @param {HTMLElement} root
   * @param {Array<{image_url:string, caption?:string, title?:string}>} items
   */
  function render(root, items) {
    if (!root || !items || !items.length) return;

    var inst = findInstance(root);
    if (!inst) {
      inst = { root: root, timer: null, turn: 0, hoverPause: false, lightboxOpen: false, resizeBound: false };
      instances.push(inst);
    }
    stopRotation(inst);
    inst.items = items;
    inst.featuredIdx = items.length > 1 ? [0, 1] : [0];
    inst.turn = 0;

    root.innerHTML = buildMarkup(items, inst.featuredIdx);

    inst.featuredEls = Array.prototype.slice.call(root.querySelectorAll('.gallery-featured-item'));
    inst.viewport = root.querySelector('.gallery-strip-viewport');
    inst.prevBtn = root.querySelector('.gallery-nav-prev');
    inst.nextBtn = root.querySelector('.gallery-nav-next');

    bindInstance(inst);
    startRotation(inst);
  }

  function bindInstance(inst) {
    var root = inst.root;

    // Otevření lightboxu z featured i pásu
    root.querySelectorAll('[data-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openLightbox(inst.items, parseInt(btn.getAttribute('data-idx'), 10) || 0);
      });
    });

    // Šipky pásu — posun o šířku jedné položky (+ gap)
    var step = function () {
      var item = inst.viewport.querySelector('.gallery-strip-item');
      var track = inst.viewport.querySelector('.gallery-strip-track');
      var gap = 16;
      if (track) {
        var g = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap);
        if (!isNaN(g)) gap = g;
      }
      return item ? item.offsetWidth + gap : inst.viewport.clientWidth;
    };
    inst.prevBtn.addEventListener('click', function () {
      inst.viewport.scrollBy({ left: -step(), behavior: 'smooth' });
    });
    inst.nextBtn.addEventListener('click', function () {
      inst.viewport.scrollBy({ left: step(), behavior: 'smooth' });
    });
    inst.viewport.addEventListener('scroll', function () { updateNav(inst); }, { passive: true });

    if (!inst.resizeBound) {
      inst.resizeBound = true;
      window.addEventListener('resize', function () { updateNav(inst); });
    }
    updateNav(inst);

    // Pauza rotace při hoveru / fokusu uvnitř galerie
    root.addEventListener('pointerenter', function () { inst.hoverPause = true; });
    root.addEventListener('pointerleave', function () { inst.hoverPause = false; });
    root.addEventListener('focusin', function () { inst.hoverPause = true; });
    root.addEventListener('focusout', function () { inst.hoverPause = false; });
  }

  /** Šipky pásu: skryje, když není co posouvat; zablokuje na koncích. */
  function updateNav(inst) {
    var v = inst.viewport;
    if (!v || !inst.prevBtn) return;
    var max = v.scrollWidth - v.clientWidth;
    var scrollable = max > 4;
    inst.prevBtn.hidden = !scrollable;
    inst.nextBtn.hidden = !scrollable;
    if (!scrollable) return;
    inst.prevBtn.disabled = v.scrollLeft <= 1;
    inst.nextBtn.disabled = v.scrollLeft >= max - 1;
  }

  /* ----------------------------------------------------------
     Automatická rotace featured páru (crossfade)
  ---------------------------------------------------------- */
  function rotationAllowed() {
    return !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function startRotation(inst) {
    stopRotation(inst);
    if (!rotationAllowed()) return;
    if (!inst.items || inst.items.length < 3) return; // 1–2 fotky: není co střídat
    inst.timer = setInterval(function () { rotateTick(inst); }, ROTATE_MS);
  }

  function stopRotation(inst) {
    if (inst.timer) {
      clearInterval(inst.timer);
      inst.timer = null;
    }
  }

  function rotateTick(inst) {
    if (inst.hoverPause || inst.lightboxOpen || document.hidden) return;
    var n = inst.items.length;
    var slotCount = inst.featuredEls.length;
    if (!slotCount) return;
    var slot = inst.turn % slotCount;
    inst.turn += 1;

    // Nový index = další za fotkou v druhém slotu → pár se postupně přetáčí přes celou galerii
    var otherIdx = slotCount > 1 ? inst.featuredIdx[1 - slot] : inst.featuredIdx[slot];
    var nextIdx = (otherIdx + 1) % n;
    if (nextIdx === inst.featuredIdx[slot]) nextIdx = (nextIdx + 1) % n;
    crossfadeTo(inst, slot, nextIdx);
  }

  function crossfadeTo(inst, slot, nextIdx) {
    var el = inst.featuredEls[slot];
    var it = inst.items[nextIdx];
    if (!el || !it) return;
    var layers = el.querySelectorAll('.gl-layer');
    if (layers.length < 2) return;
    var active = el.querySelector('.gl-layer.is-active');
    var inactive = active === layers[0] ? layers[1] : layers[0];
    var done = false;

    var apply = function () {
      if (done) return;
      done = true;
      if (inactive.getAttribute('src') !== it.image_url) inactive.src = it.image_url;
      inactive.alt = it.caption || it.title || '';
      inactive.classList.add('is-active');
      active.classList.remove('is-active');
      inactive.removeAttribute('aria-hidden');
      active.setAttribute('aria-hidden', 'true');
      inst.featuredIdx[slot] = nextIdx;
      el.setAttribute('data-idx', String(nextIdx));
      el.setAttribute('aria-label', 'Zvětšit fotku: ' + (it.caption || it.title || (nextIdx + 1)));
      // Po přechodu uvolnit starou vrstvu pro další fade
      setTimeout(function () {
        if (!active.classList.contains('is-active')) active.removeAttribute('src');
      }, 900);
    };

    // Preload → teprve potom prolnout (žádné probliknutí prázdného slotu)
    var pre = document.createElement('img');
    pre.onload = apply;
    pre.onerror = function () { /* poškozenou fotku přeskočit */ };
    pre.src = it.image_url;
    setTimeout(apply, FADE_FALLBACK_MS);
  }

  /* ----------------------------------------------------------
     Init — statický fallback obsah oživit; CMS hydratace volá render()
  ---------------------------------------------------------- */
  function init() {
    document.querySelectorAll('[data-cms-gallery]').forEach(function (root) {
      var items = collectFromDom(root);
      if (items.length) render(root, items);
    });
  }

  window.GalleryUI = { render: render, open: openLightbox };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
