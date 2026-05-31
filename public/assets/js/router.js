/*
  Bicom Písek — SPA Router (History API & View Transitions)
  Spravuje virtuální navigaci bez přeblikávání, defferované stavy a přístupnost.
*/

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
    } else if (path.startsWith("/magazin/")) {
      const slug = path.split("/magazin/")[1];
      await renderBlogDetail(slug);
    } else if (path === "/gdpr") {
      renderGdprPage();
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
async function renderBlogDetail(slug) {
  if (mainEl) mainEl.style.display = "none";
  subpageContainer.style.display = "block";
  subpageContainer.innerHTML = `<div style="text-align:center; padding: 5rem 0;">Načítám článek...</div>`;

  const articles = await fetchBlog();
  const article = articles.find(a => a.slug === slug);

  if (!article) {
    render404Page();
    return;
  }

  // Update SEO
  document.title = `${escapeHtml(article.title)} | Bicom Písek Magazín`;
  setMetaDescription(escapeHtml(article.excerpt || article.title));

  const publishDate = article.published_at 
    ? new Date(article.published_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" }) 
    : '';

  subpageContainer.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <a href="/" class="btn btn-outline" style="padding: 0.5rem 1rem;" id="back-link">
        &larr; Zpět na úvodní stránku
      </a>
    </div>
    <article style="max-width: 800px; margin: 0 auto; animation: fadeIn 0.4s ease;">
      <span style="font-size: 0.85rem; font-weight:600; text-transform: uppercase; color: var(--c-champagne); letter-spacing: 0.15em;">
        Magazín / ${publishDate}
      </span>
      <h1 id="subpage-heading" tabindex="-1" style="font-size: clamp(2rem, 5vw, 3.5rem); margin-top: 0.5rem; margin-bottom: 2rem;">
        ${escapeHtml(article.title)}
      </h1>
      
      ${article.image_url ? `
        <div style="border-radius: var(--radius-lg); overflow: hidden; border: 1px solid rgba(115,138,117,0.15); margin-bottom: 2.5rem; max-height: 400px; display: flex; justify-content:center; align-items:center; background-color: var(--c-mist);">
          <img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" style="width:100%; height:auto; object-fit:cover;">
        </div>
      ` : ''}

      <div style="background-color: var(--c-white); border-radius: var(--radius); padding: var(--space); border: 1px solid rgba(115, 138, 117, 0.1); box-shadow: var(--shadow-sm); margin-bottom: 3rem;">
        <p style="font-size: 1.15rem; line-height: 1.8; color: var(--c-forest); font-family: var(--font-head); font-style: italic; margin-bottom: 2rem; border-left: 3px solid var(--c-champagne); padding-left: 1.5rem;">
          ${escapeHtml(article.excerpt || '')}
        </p>
        <div style="line-height: 1.9; font-size: 1.05rem; color: var(--c-charcoal); white-space: pre-wrap;">
          ${escapeHtml(article.content)}
        </div>
      </div>

      <div style="text-align: center; border-top: 1px solid rgba(115,138,117,0.15); padding-top: 3rem;">
        <h3 style="margin-bottom: 1.5rem;">Zaujalo vás toto téma?</h3>
        <a href="/#rezervace" class="btn btn-primary" style="padding: 1rem 2.5rem;">
          Objednat se na konzultaci
        </a>
      </div>
    </article>
  `;

  document.getElementById("subpage-heading")?.focus();
}

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
        <p>Provozovatel (dále jen „správce“), se sídlem Písek, prohlašuje, že veškeré osobní údaje zpracovává v souladu s Nařízením Evropského parlamentu a Rady (EU) 2016/679 (GDPR).</p>
        
        <p><strong>2. Jaké osobní a citlivé údaje zpracováváme?</strong></p>
        <p>Při online rezervaci termínu zpracováváme Vaše:</p>
        <ul>
          <li>Jméno a příjmení (identifikační údaj)</li>
          <li>E-mailovou adresu a telefonní číslo (kontaktní údaje)</li>
          <li>PSČ (pro agregované geografické statistiky poptávek)</li>
          <li><strong>Citlivé údaje o zdraví:</strong> stručnou poznámku o Vašich potížích, kterou dobrovolně uvedete. Tyto údaje jsou chráněny nejpřísnějším šifrováním (Field-Level Encryption) a přístup k nim má výhradně správce.</li>
        </ul>

        <p><strong>3. Účel a právní základ zpracování</strong></p>
        <p>Zpracování je nezbytné pro splnění smlouvy / vyřízení Vaší poptávky termínu a poskytnutí doplňkové poradenské péče. V případě odběru newsletteru je právním základem Váš výslovný souhlas.</p>

        <p><strong>4. Doba uchování údajů</strong></p>
        <p>Údaje z rezervačního formuláře jsou automaticky anonymizovány po 30 dnech od plánovaného termínu sezení. E-mail pro zasílání newsletteru uchováváme do doby odhlášení odběru.</p>

        <p><strong>5. Práva subjektu údajů</strong></p>
        <p>Máte právo požadovat přístup k Vašim osobním údajům, jejich opravu, výmaz („právo být zapomenut“), omezení zpracování, a vznést námitku proti zpracování na e-mail: <strong>info@bicom-pisek.cz</strong>.</p>
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

// Listen to popstate and clicks
window.addEventListener("popstate", resolveRoute);
document.body.addEventListener("click", handleLinkClick);

// Initial routing
document.addEventListener("DOMContentLoaded", () => {
  resolveRoute();
});

export { resolveRoute };
