/*
  Bicom Písek — SPA Router (History API & View Transitions)
  Spravuje virtuální navigaci bez přeblikávání, defferované stavy a přístupnost.
*/

import { renderMarkdown } from './markdown.js';

const ORIGINAL_TITLE = "Bicom Písek | Biorezonanční poradna Písek";
const ORIGINAL_DESC = "Biorezonanční metoda Bicom Optima v Písku. Šetrná, certifikovaná a neinvazivní komplementární podpora pro děti i dospělé. Objednejte se online.";

// Router state
let servicesData = null;
let blogData = null;

// Initialize elements
let mainEl = null;
let subpageContainer = null;

/**
 * Escapes HTML string to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Resolves views and manages DOM updates.
 */
async function resolveRoute() {
  const path = window.location.pathname;
  
  // Static landing pages live outside the SPA — let the server handle them.
  if (path.startsWith('/biorezonance-')) {
    return; // _redirects rewrite serves the correct .html file
  }

  if (!mainEl) mainEl = document.querySelector("main") || document.getElementById("hero")?.parentElement;
  
  // Lazily create subpage container if missing
  if (!subpageContainer) {
    subpageContainer = document.getElementById("subpage-container");
    if (!subpageContainer) {
      subpageContainer = document.createElement("div");
      subpageContainer.id = "subpage-container";
      subpageContainer.style.display = "none";
      subpageContainer.className = "wrap";
      subpageContainer.style.paddingTop = "120px";
      subpageContainer.style.paddingBottom = "80px";
      subpageContainer.style.minHeight = "70vh";
      if (mainEl) {
        mainEl.parentElement.insertBefore(subpageContainer, mainEl);
      }
    }
  }

  // Helper to switch view mode
  const updateDOM = async () => {
    window.scrollTo(0, 0);
    
    // Reset active header links
    document.querySelectorAll("header nav a").forEach(a => a.classList.remove("active"));

    if (path === "/" || path === "/index.html") {
      // Home / main landing page
      if (subpageContainer) subpageContainer.style.display = "none";
      if (mainEl) mainEl.style.display = "block";
      
      document.title = ORIGINAL_TITLE;
      setMetaDescription(ORIGINAL_DESC);

      // Render home blog articles grid
      renderHomeBlogGrid();

      // Handle scroll to hash if present
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          setTimeout(() => {
            target.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      }
      
      // Focus restoration
      document.querySelector("h1")?.focus();
    } else if (path.startsWith("/sluzby/")) {
      const slug = path.split("/sluzby/")[1];
      await renderServiceDetail(slug);

    } else if (path === "/gdpr") {
      renderGdprPage();
    } else if (path === "/rezervace-potvrzena") {
      renderRezervacePotvrzenaPage();
    } else if (path === "/rezervace-zrusena") {
      renderRezervaceZrusenaPage();
    } else {
      // 404 fallback
      render404Page();
    }
  };

  // View transitions wrapper
  if (document.startViewTransition) {
    document.startViewTransition(updateDOM);
  } else {
    await updateDOM();
  }
}

/**
 * Renders the top 3 published blog posts on the home page.
 */
async function renderHomeBlogGrid() {
  const grid = document.getElementById("blog-grid");
  if (!grid) return;

  const articles = await fetchBlog();
  const topArticles = articles.slice(0, 3);

  if (!topArticles.length) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: #888; padding: 2rem 0;">
        Připravujeme pro vás první články. Sledujte náš Magazín.
      </div>
    `;
    return;
  }

  grid.innerHTML = topArticles.map(article => {
    const publishDate = article.published_at 
      ? new Date(article.published_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "short", year: "numeric" }) 
      : '';
    
    return `
      <div class="blog-card">
        <div class="blog-img">
          ${article.image_url ? `<img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" style="width: 100%; height: 100%; object-fit: cover;">` : `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          `}
        </div>
        <div class="blog-card-content">
          <div>
            <div class="blog-meta">${publishDate}</div>
            <h3 class="blog-title" style="font-size: 1.15rem; margin-bottom: 0.5rem; font-family: var(--font-body); font-weight:600; color: var(--c-forest);">${escapeHtml(article.title)}</h3>
            <p class="blog-excerpt" style="font-size: 0.9rem; line-height:1.5; color:#555; margin-bottom: 1rem;">${escapeHtml(article.excerpt || '')}</p>
          </div>
          <div>
            <a href="/magazin/${article.slug}" style="font-weight: 500; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 0.5rem;">
              Číst více &rarr;
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Changes meta description.
 */
function setMetaDescription(text) {
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", text);
  }
}

/**
 * Fetches services cache.
 */
async function fetchServices() {
  if (servicesData) return servicesData;
  try {
    const res = await fetch("/api/services");
    if (res.ok) {
      servicesData = await res.json();
    }
  } catch (err) {
    console.error("[router] Failed to fetch services:", err);
  }
  return servicesData || [];
}

/**
 * Fetches blog cache.
 */
async function fetchBlog() {
  if (blogData) return blogData;
  try {
    const res = await fetch("/api/blog");
    if (res.ok) {
      blogData = await res.json();
    }
  } catch (err) {
    console.error("[router] Failed to fetch blog articles:", err);
  }
  return blogData || [];
}

/**
 * Renders service detail subpage view.
 */
async function renderServiceDetail(slug) {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";
  subpageContainer.innerHTML = `<div style="text-align:center; padding: 5rem 0;">Načítám detail programu...</div>`;

  const services = await fetchServices();
  const service = services.find(s => s.slug === slug);

  if (!service) {
    render404Page();
    return;
  }

  // Update SEO
  document.title = `${escapeHtml(service.name)} Písek | Bicom Písek`;
  setMetaDescription(escapeHtml(service.short_desc || service.name));

  subpageContainer.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="/" class="btn btn-outline" style="padding: 0.5rem 1rem;" id="back-link">
        &larr; Zpět na úvodní stránku
      </a>
    </div>
    <div style="max-width: 800px; margin: 0 auto; animation: fadeIn 0.4s ease;">
      <span style="font-size: 0.9rem; font-weight:600; text-transform: uppercase; color: var(--c-champagne); letter-spacing: 0.15em;">
        Detail biorezonančního programu
      </span>
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(2rem, 5vw, 3.5rem); margin-top: 0.5rem; margin-bottom: 1.5rem;">
        ${escapeHtml(service.name)}
      </h1>
      
      <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 2rem; border: 1px solid rgba(115, 138, 117, 0.12); box-shadow: var(--shadow-sm); margin-bottom: 2.5rem;">
        <h3 style="font-family: var(--font-body); font-size: 1.1rem; text-transform: uppercase; color: var(--c-forest); margin-bottom: 1rem;">
          Zaměření a účel programu
        </h3>
        <p style="font-size: 1.1rem; line-height: 1.8; color: var(--c-charcoal);">
          ${escapeHtml(service.short_desc || '')}
        </p>
        <p style="margin-top: 1rem; line-height: 1.8;">
          ${escapeHtml(service.long_desc || '')}
        </p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem;">
        <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 1.5rem; border: 1px solid rgba(115, 138, 117, 0.1); text-align: center;">
          <h4 style="font-family: var(--font-body); font-size: 0.85rem; text-transform: uppercase; color: var(--c-sage); margin-bottom: 0.5rem;">
            Doporučený rozsah
          </h4>
          <span style="font-size: 1.25rem; font-weight: 600; color: var(--c-forest);">
            ${escapeHtml(service.sessions_typ || 'Dle dohody')}
          </span>
        </div>
        <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 1.5rem; border: 1px solid rgba(115, 138, 117, 0.1); text-align: center;">
          <h4 style="font-family: var(--font-body); font-size: 0.85rem; text-transform: uppercase; color: var(--c-sage); margin-bottom: 0.5rem;">
            Průměrná cena sezení
          </h4>
          <span style="font-size: 1.25rem; font-weight: 600; color: var(--c-forest);">
            ${escapeHtml(String(service.price_avg || '1200'))} Kč
          </span>
        </div>
      </div>

      <div style="background-color: var(--c-mist); border-radius: var(--radius); padding: 1.5rem; border: 1px solid rgba(197, 168, 128, 0.2); margin-bottom: 3rem;">
        <h4 style="font-family: var(--font-body); font-size: 0.85rem; text-transform: uppercase; color: var(--c-forest); margin-bottom: 0.5rem; letter-spacing: 0.05em;">
          Důležité informace k cenám a průběhu
        </h4>
        <p style="font-size: 0.9rem; margin: 0; line-height: 1.6; color: #555;">
          ${escapeHtml(service.price_note || '')}
        </p>
      </div>

      <div style="text-align: center;">
        <a href="/#rezervace" class="btn btn-primary btn-accent" style="padding: 1.2rem 3rem;" id="book-cta">
          Objednat se na tento program
        </a>
      </div>
    </div>
  `;

  // Focus redirection for accessibility (WCAG AA)
  document.getElementById("subpage-heading")?.focus();
}

/**
 * Renders blog article subpage view.
 */

/**
 * Renders GDPR privacy page.
 */
function renderGdprPage() {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";

  document.title = "Ochrana osobních údajů (GDPR) | Bicom Písek";
  setMetaDescription("Zásady zpracování a ochrany osobních údajů v poradně Bicom Písek.");

  subpageContainer.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="/" class="btn btn-outline" style="padding: 0.5rem 1rem;" id="back-link">
        &larr; Zpět na úvodní stránku
      </a>
    </div>
    <div style="max-width: 800px; margin: 0 auto; animation: fadeIn 0.4s ease;">
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(2rem, 4vw, 3rem); margin-bottom: 2rem;">
        Ochrana osobních údajů (GDPR)
      </h1>
      
      <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 2rem; border: 1px solid rgba(115, 138, 117, 0.1); box-shadow: var(--shadow-sm); line-height: 1.8;">
        <p><strong>1. Základní ustanovení</strong></p>
        <p>BIO ONE LIFE s.r.o., IČO 23950978, provozovatel webu bicom-pisek.cz (dále jen „správce“), prohlašuje, že veškeré osobní údaje zpracovává v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (GDPR).</p>
        
        <p><strong>2. Jaké osobní a citlivé údaje zpracováváme?</strong></p>
        <p>Při online rezervaci termínu a nastavení komunikace zpracováváme Vaše:</p>
        <ul>
          <li>Jméno a příjmení (identifikační údaj)</li>
          <li>E-mailovou adresu a telefonní číslo (kontaktní a komunikační údaje sloužící k vyřízení rezervace a zasílání automatických upomínek termínu podle Vámi vybraného kanálu)</li>
          <li>PSČ (pro agregované geografické statistiky poptávek)</li>
          <li><strong>Citlivé údaje o zdraví (čl. 9 GDPR):</strong> stručnou poznámku o Vašich potížích, kterou dobrovolně uvedete. Tyto údaje jsou chráněny nejpřísnějším šifrováním (Field-Level Encryption) a přístup k nim má výhradně správce.</li>
        </ul>

        <p><strong>3. Účel a právní základ zpracování</strong></p>
        <p>Zpracování osobních a zdravotních údajů je nezbytné pro splnění smlouvy / vyřízení Vaší poptávky termínu a poskytnutí objednané biorezonanční péče. Pro automatické zasílání upomínek na Váš termín využíváme Vaše kontaktní údaje (e-mail nebo SMS) na základě plnění smlouvy a oprávněného zájmu na řádném poskytnutí služby. V případě odběru newsletteru a marketingových sdělení je právním základem Váš výslovný a dobrovolný souhlas.</p>

        <p><strong>4. Doba uchování údajů</strong></p>
        <p>Údaje z rezervačního formuláře jsou automaticky anonymizovány po 30 dnech od plánovaného termínu sezení. E-mail pro zasílání newsletteru uchováváme do doby odhlášení odběru.</p>

        <p><strong>5. Práva subjektu údajů a odvolání souhlasu</strong></p>
        <p>Máte právo požadovat přístup k Vašim osobním údajům, jejich opravu, výmaz („právo být zapomenut“), omezení zpracování, a vznést námitku proti zpracování na e-mail: <strong>info@bicom-pisek.cz</strong>.</p>
        <p>Udělené souhlasy (např. marketingový souhlas pro newsletter) můžete kdykoli a bez jakýchkoli následků odvolat:</p>
        <ul>
          <li>Odpovědí na libovolný e-mail od nás (zasláním žádosti o odhlášení na <strong>info@bicom-pisek.cz</strong>).</li>
          <li>Kliknutím na odhlašovací odkaz v patičce každého zaslaného newsletteru.</li>
        </ul>
      </div>
    </div>
  `;

  document.getElementById("subpage-heading")?.focus();
}

/**
 * Renders Stripe payment success confirmation page.
 */
function renderRezervacePotvrzenaPage() {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";

  document.title = "Rezervace termínu | Bicom Písek";
  setMetaDescription("Vaše rezervace termínu biorezonance Bicom.");

  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id') || '';
  const isFree = urlParams.get('free') === 'true';

  let headingText = "Rezervace a platba úspěšná";
  let iconHtml = "✓";
  let iconColor = "var(--c-sage)";
  let bodyHtml = "";

  if (isFree) {
    headingText = "Předběžná rezervace odeslána";
    iconHtml = "✉";
    iconColor = "var(--c-champagne)";
    bodyHtml = `
      <p style="font-size: 1.15rem; color: var(--c-charcoal); margin-bottom: 1.5rem; line-height: 1.7;">
        Děkujeme za vaši poptávku termínu. Vaše rezervace byla úspěšně zaznamenána.
      </p>
      <p style="margin-bottom: 1.5rem; color: var(--c-charcoal); line-height: 1.7;">
        Jelikož jste zvolili možnost <strong>rezervace bez platby předem</strong>, váš termín je v tuto chvíli pouze předběžný a čeká na ověření kapacity. Během krátké doby se s vámi spojíme pro upřesnění a telefonické potvrzení termínu.
      </p>
      <div style="background-color: #f7f5f2; border-left: 4px solid var(--c-champagne); padding: 1rem 1.25rem; margin-bottom: 2rem; font-size: 0.9rem; color: #666; line-height: 1.5;">
        <strong>Doporučení:</strong> Pokud byste chtěli mít termín garantovaný přednostně a bez nutnosti dalšího potvrzování, doporučujeme příště zvolit online úhradu zálohy. Rezervace s uhrazenou zálohou mají v našem kalendáři nejvyšší prioritu.
      </div>
    `;
  } else {
    bodyHtml = `
      <p style="font-size: 1.15rem; color: var(--c-charcoal); margin-bottom: 1.5rem; line-height: 1.7;">
        Děkujeme za vaši rezervaci a úhradu rezervační zálohy ve výši <strong>500 Kč</strong>.
      </p>
      <p style="margin-bottom: 1.5rem; color: var(--c-charcoal); line-height: 1.7;">
        Platba byla úspěšně přijata. Na váš e-mail jsme odeslali potvrzení s podrobnostmi a zaplacenou zálohovou fakturu (prostřednictvím systému iDoklad). Váš termín je nyní prioritně rezervovaný a brzy se s vámi spojíme pro upřesnění času.
      </p>
    `;
  }

  subpageContainer.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="/" class="btn btn-outline" style="padding: 0.5rem 1rem;" id="back-link">
        &larr; Zpět na úvodní stránku
      </a>
    </div>
    <div style="max-width: 800px; margin: 0 auto; text-align: center; animation: fadeIn 0.4s ease;">
      <div style="font-size: 4.5rem; color: ${iconColor}; margin-bottom: 1rem; line-height: 1;">${iconHtml}</div>
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(2rem, 4vw, 3rem); margin-top: 0.5rem; margin-bottom: 1.5rem; color: var(--c-forest);">
        ${headingText}
      </h1>
      
      <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 2.5rem 2rem; border: 1px solid rgba(115, 138, 117, 0.12); box-shadow: var(--shadow-sm); text-align: left; margin-bottom: 2.5rem;">
        ${bodyHtml}
        
        <h3 style="font-family: var(--font-body); font-size: 1.05rem; text-transform: uppercase; color: var(--c-forest); margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(115, 138, 117, 0.12); padding-bottom: 0.5rem; font-weight:600;">
          Doporučená příprava před terapií
        </h3>
        <p style="font-size: 0.95rem; color: #555; margin-bottom: 0.75rem;">
          Pro dosažení nejlepších výsledků biorezonance prosím dodržujte tyto pokyny:
        </p>
        <ul style="font-size: 0.95rem; color: #555; padding-left: 1.25rem; margin-bottom: 2rem; line-height: 1.6;">
          <li style="margin-bottom: 0.5rem;"><strong>24 hodin před sezením</strong> prosím nepijte žádný alkohol ani kávu.</li>
          <li style="margin-bottom: 0.5rem;">V den terapie omezte pití silného černého či zeleného čaje a energetických nápojů.</li>
          <li style="margin-bottom: 0.5rem;">Před i po terapii pijte dostatek čisté neperlivé vody (pomáhá tělu odvádět uvolněné škodliviny).</li>
          <li style="margin-bottom: 0.5rem;">Na sezení doporučujeme obléci pohodlné oblečení (terapie probíhá v leže či sedě).</li>
        </ul>
        
        ${bookingId ? `
        <div style="background-color: var(--c-mist); border-radius: var(--radius); padding: 0.75rem 1rem; border: 1px solid rgba(197, 168, 128, 0.15); font-size: 0.85rem; font-family: monospace; text-align: center; color: #666; word-break: break-all;">
          Referenční ID rezervace: ${escapeHtml(bookingId)}
        </div>
        ` : ''}
      </div>
      
      <a href="/" class="btn btn-primary btn-accent" style="padding: 1.2rem 3rem;">
        Zpět na úvodní stránku
      </a>
    </div>
  `;

  document.getElementById("subpage-heading")?.focus();
}

/**
 * Renders Stripe payment cancelled page.
 */
function renderRezervaceZrusenaPage() {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";

  document.title = "Platba nedokončena | Bicom Písek";
  setMetaDescription("Platba rezervační zálohy byla zrušena.");

  subpageContainer.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="/" class="btn btn-outline" style="padding: 0.5rem 1rem;" id="back-link">
        &larr; Zpět na úvodní stránku
      </a>
    </div>
    <div style="max-width: 800px; margin: 0 auto; text-align: center; animation: fadeIn 0.4s ease;">
      <div style="font-size: 4.5rem; color: var(--c-error); margin-bottom: 1rem; line-height: 1;">✕</div>
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(2rem, 4vw, 3rem); margin-top: 0.5rem; margin-bottom: 1.5rem; color: var(--c-forest);">
        Platba nedokončena
      </h1>
      
      <div style="background-color: var(--c-white); border-radius: var(--radius); padding: 2.5rem 2rem; border: 1px solid rgba(115, 138, 117, 0.12); box-shadow: var(--shadow-sm); text-align: left; line-height: 1.7; margin-bottom: 2.5rem;">
        <p style="font-size: 1.1rem; color: var(--c-charcoal); margin-bottom: 1.5rem;">
          Platba rezervační zálohy byla stornována nebo nebyla dokončena.
        </p>
        <p style="color: #555;">
          Váš vybraný termín nebyl zarezervován a rezervace nebyla dokončena. Pokud si stále přejete vytvořit rezervaci termínu, přejděte prosím zpět na rezervační formulář a dokončete proces.
        </p>
        <p style="margin-top: 1rem; color: #555;">
          Pokud máte potíže s online platbou kartou, kontaktujte nás prosím na e-mailu <strong>info@bicom-pisek.cz</strong> a domluvíme se na alternativním postupu.
        </p>
      </div>
      
      <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
        <a href="/#rezervace" class="btn btn-primary" style="padding: 1rem 2.5rem;">
          Zkusit znovu rezervaci
        </a>
        <a href="/" class="btn btn-outline" style="padding: 1rem 2.5rem;">
          Zpět na úvod
        </a>
      </div>
    </div>
  `;

  document.getElementById("subpage-heading")?.focus();
}

/**
 * Renders 404 page.
 */
function render404Page() {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";

  document.title = "Stránka nenalezena | Bicom Písek";

  subpageContainer.innerHTML = `
    <div style="text-align: center; padding: 5rem 0; animation: fadeIn 0.4s ease;">
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(3rem, 8vw, 6rem); color: var(--c-champagne); margin-bottom: 1rem;">
        404
      </h1>
      <h2 style="margin-bottom: 2rem;">Omlouváme se, tato stránka neexistuje</h2>
      <p style="max-width: 500px; margin: 0 auto 2.5rem;">
        Odkaz, na který jste klikli, je pravděpodobně nefunkční nebo byla stránka přesunuta.
      </p>
      <a href="/" class="btn btn-primary" id="back-link">
        Zpět na úvodní stránku
      </a>
    </div>
  `;

  document.getElementById("subpage-heading")?.focus();
}

/**
 * Handles navigation clicks.
 */
function handleLinkClick(e) {
  const a = e.target.closest("a");
  if (!a) return;
  
  const href = a.getAttribute("href");
  if (!href) return;

  // Check if it is a relative internal link
  if (href.startsWith("/")) {
    // Bypass local landing pages so browser loads their static HTML files normally
    if (href.startsWith("/biorezonance-")) {
      return;
    }
    e.preventDefault();
    window.history.pushState(null, "", href);
    resolveRoute();
  } else if (href.startsWith("#")) {
    // Scroll link
    const path = window.location.pathname;
    if (path !== "/" && path !== "/index.html") {
      // If we are on a subpage, go home first with hash
      e.preventDefault();
      window.history.pushState(null, "", "/" + href);
      resolveRoute();
    }
  }
}

/**
 * Initializes mobile menu toggle.
 */
function initMenuToggle() {
  const menuToggle = document.getElementById("menu-toggle");
  const header = document.getElementById("header");
  const navLinks = document.querySelectorAll("header nav a");

  if (!menuToggle || !header) return;

  // Toggle menu on button click
  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    header.classList.toggle("nav-open");
    const isOpen = header.classList.contains("nav-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
  });

  // Close menu when clicking on a nav link
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("header")) {
      header.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// Listen to popstate and clicks
window.addEventListener("popstate", resolveRoute);
document.body.addEventListener("click", handleLinkClick);

// Initial routing
document.addEventListener("DOMContentLoaded", () => {
  initMenuToggle();
  resolveRoute();
});

export { resolveRoute };
