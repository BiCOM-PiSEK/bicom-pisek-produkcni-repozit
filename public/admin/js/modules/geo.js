/**
 * BICOM PÍSEK — GEO-Marketing & SEO-AEO Dashboard Module
 * Zobrazuje reálná GEO data (geo_leads), Google Mapu s poptávkami a organické SEO dotazy z Google Search Console.
 */

let activeGoogleMap = null;

export async function render(container, ctx) {
  const { api, showToast } = ctx;

  container.innerHTML = renderShell(renderLoading());

  let geoData = null;
  let seoData = null;
  let hasError = false;

  if (api) {
    try {
      const [geoRes, seoRes] = await Promise.all([
        api.getGeoAnalytics(),
        api.getSeoAnalytics().catch(err => ({ ok: false, error: err.message }))
      ]);

      if (geoRes.ok && geoRes.data) {
        geoData = geoRes.data;
      } else {
        hasError = true;
        showToast('Nepodařilo se načíst GEO data: ' + (geoRes.error || 'Neznámá chyba'), 'error');
      }

      if (seoRes.ok && seoRes.data) {
        seoData = seoRes.data;
      } else {
        console.warn('[geo-dashboard] SEO GSC query was not successful:', seoRes.error);
      }
    } catch (err) {
      hasError = true;
      showToast('Nepodařilo se načíst analytická data: ' + err.message, 'error');
    }
  }

  if (hasError || !geoData) {
    container.innerHTML = renderShell(renderEmpty('⚠️', 'Data se nepodařilo načíst', 'Zkontrolujte připojení k databázi.'));
    attachRefresh(container, ctx);
    return;
  }

  const cities = geoData.cities || [];
  const topServices = geoData.topServices || [];
  const insights = geoData.insights || [];
  const points = geoData.points || [];
  const totalLeads = geoData.totalLeads || 0;

  // SEO data variables
  const seoStats = seoData?.stats || { totalClicks: 0, totalImpressions: 0, avgPosition: 0 };
  const localQueries = seoData?.localQueries || [];
  const generalQueries = seoData?.generalQueries || [];

  // Layout formatting
  const maxCount = Math.max(...cities.map((c) => c.count), 1);
  const citiesHtml = cities.length > 0
    ? cities.map((c) => {
        const pct = Math.round((c.count / maxCount) * 100);
        return `<div class="geo-bar-item" style="margin-bottom:var(--sp-3);">
          <div class="flex justify-between items-center mb-1">
            <span style="font-size:var(--text-sm);font-weight:500;">${esc(c.name)}</span>
            <span style="font-size:var(--text-xs);color:var(--c-sage);font-weight:600;">${c.count} poptávek</span>
          </div>
          <div class="geo-bar" style="background:#ECE9E4; height:6px; border-radius:3px; overflow:hidden;">
            <div class="geo-bar-fill" style="width:${pct}%; background:var(--c-forest); height:100%; border-radius:3px;"></div>
          </div>
        </div>`;
      }).join('')
    : renderEmpty('📍', 'Žádné poptávky', 'Data se zobrazí, jakmile přijdou první poptávky.');

  const servicesHtml = topServices.length > 0
    ? `<div style="margin-top:var(--sp-4); border-top:1px solid rgba(115,138,117,0.1); padding-top:var(--sp-3);">
        <p style="font-size:0.75rem;text-transform:uppercase;color:var(--c-sage);font-weight:600;margin-bottom:var(--sp-2);letter-spacing:0.05em;">Nejžádanější služby</p>
        ${topServices.map((s) => `<div class="flex justify-between items-center" style="padding:var(--sp-1) 0; font-size:var(--text-sm);">
          <span>${esc(s.service)}</span>
          <span style="font-weight:600;color:var(--c-forest);">${s.count}×</span>
        </div>`).join('')}
      </div>`
    : '';

  const insightsHtml = insights.length > 0
    ? insights.map((r) => `
        <div class="card mb-3" style="border-left: 3px solid var(--c-champagne); padding: var(--sp-3) var(--sp-4); background:var(--c-white); box-shadow:var(--shadow-sm);">
          <p style="font-size:var(--text-sm);font-weight:600;margin-bottom:2px;color:var(--c-forest);">${esc(r.title)}</p>
          <p style="font-size:var(--text-xs);color:#555;margin:0;line-height:1.4;">${esc(r.description)}</p>
        </div>`).join('')
    : renderEmpty('💡', 'Žádné postřehy', 'Doporučení se vytvoří, jakmile budou k dispozici poptávky.');

  // GSC organic queries list renderer helper
  const renderQueriesTable = (queries) => {
    if (!queries.length) {
      return `<div style="padding:2rem; text-align:center; color:#888; font-size:var(--text-sm);">Žádné dotazy k zobrazení za toto období.</div>`;
    }
    const rows = queries.map(q => `
      <tr>
        <td style="font-weight:500; font-size:0.9rem; color:var(--c-forest);">${esc(q.query)}</td>
        <td style="text-align:center;">${q.clicks}</td>
        <td style="text-align:center;">${q.impressions}</td>
        <td style="text-align:center; color:var(--c-sage);">${(q.ctr * 100).toFixed(1)}%</td>
        <td style="text-align:center; font-weight:600;">${q.position.toFixed(1)}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap" style="max-height:350px; overflow-y:auto; border: 1px solid rgba(115,138,117,0.1); border-radius:8px;">
        <table class="table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr style="position:sticky; top:0; background:#FAF8F5; box-shadow: inset 0 -1px 0 rgba(0,0,0,0.1);">
              <th style="text-align:left;">Dotaz vyhledávání</th>
              <th style="text-align:center;">Prokliky</th>
              <th style="text-align:center;">Imprese</th>
              <th style="text-align:center;">CTR</th>
              <th style="text-align:center;">Pozice</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  container.innerHTML = renderShell(`
    <!-- KPI Analytics Cards -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
      <div class="card" style="padding:var(--sp-4); display:flex; flex-direction:column; justify-content:center;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--c-sage); font-weight:600; letter-spacing:0.05em;">Celkem poptávek (GEO)</span>
        <span style="font-size:2.25rem; font-weight:700; color:var(--c-forest); margin-top:5px; line-height:1;">${totalLeads}</span>
        <span style="font-size:0.75rem; color:#888; margin-top:5px;">Reálné geo_leads v databázi</span>
      </div>
      <div class="card" style="padding:var(--sp-4); display:flex; flex-direction:column; justify-content:center;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--c-sage); font-weight:600; letter-spacing:0.05em;">Organické kliky (GSC)</span>
        <span style="font-size:2.25rem; font-weight:700; color:var(--c-forest); margin-top:5px; line-height:1;">${seoStats.totalClicks}</span>
        <span style="font-size:0.75rem; color:#888; margin-top:5px;">Za posledních 30 dní</span>
      </div>
      <div class="card" style="padding:var(--sp-4); display:flex; flex-direction:column; justify-content:center;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--c-sage); font-weight:600; letter-spacing:0.05em;">Imprese vyhledávání</span>
        <span style="font-size:2.25rem; font-weight:700; color:var(--c-forest); margin-top:5px; line-height:1;">${seoStats.totalImpressions}</span>
        <span style="font-size:0.75rem; color:#888; margin-top:5px;">Zobrazení ve výsledcích vyhledávání</span>
      </div>
      <div class="card" style="padding:var(--sp-4); display:flex; flex-direction:column; justify-content:center;">
        <span style="font-size:0.75rem; text-transform:uppercase; color:var(--c-sage); font-weight:600; letter-spacing:0.05em;">Průměrná pozice</span>
        <span style="font-size:2.25rem; font-weight:700; color:var(--c-forest); margin-top:5px; line-height:1;">${seoStats.avgPosition.toFixed(1)}</span>
        <span style="font-size:0.75rem; color:#888; margin-top:5px;">Pozice pro měřené dotazy</span>
      </div>
    </div>

    <!-- Map and Regional breakdown -->
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:1.5rem; margin-bottom:2rem; align-items: stretch;">
      <div class="card" style="display:flex; flex-direction:column; min-height:400px;">
        <div class="card-header flex justify-between items-center" style="border-bottom:1px solid rgba(115,138,117,0.1); padding:var(--sp-3) var(--sp-4);">
          <h3 class="card-title" style="margin:0;">🗺️ Geografické rozložení poptávek</h3>
          <span style="font-size:0.75rem; color:var(--c-sage); font-weight:500;">Google Maps Platform</span>
        </div>
        <div style="flex:1; position:relative; min-height:350px;" id="geo-marketing-map">
          <div style="display:flex; align-items:center; justify-content:center; height:100%; background:var(--c-cream); color:#888; font-size:var(--text-sm);">
            Načítám mapové rozhraní...
          </div>
        </div>
      </div>
      <div class="card" style="display:flex; flex-direction:column;">
        <div class="card-header" style="border-bottom:1px solid rgba(115,138,117,0.1); padding:var(--sp-3) var(--sp-4);">
          <h3 class="card-title" style="margin:0;">📊 Poptávky podle lokalit</h3>
        </div>
        <div class="card-body" style="flex:1; display:flex; flex-direction:column; justify-content:space-between; padding:var(--sp-4);">
          <div style="flex:1; overflow-y:auto; max-height:220px; padding-right:5px;">
            ${citiesHtml}
          </div>
          ${servicesHtml}
        </div>
      </div>
    </div>

    <!-- Search console SEO queries & Insights -->
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:1.5rem; margin-bottom:1.5rem;">
      <div class="card">
        <div class="card-header flex justify-between items-center" style="border-bottom:1px solid rgba(115,138,117,0.1); padding:var(--sp-3) var(--sp-4);">
          <h3 class="card-title" style="margin:0;">🔍 Dotazy ve vyhledávačích (SEO/AEO)</h3>
          <div style="display:flex; gap:5px; background:#ECE9E4; padding:3px; border-radius:8px;">
            <button class="btn btn-sm btn-ghost active" id="tab-local-queries" style="font-size:0.75rem; padding:4px 8px; border-radius:6px;">Lokální</button>
            <button class="btn btn-sm btn-ghost" id="tab-general-queries" style="font-size:0.75rem; padding:4px 8px; border-radius:6px;">Obecné</button>
          </div>
        </div>
        <div class="card-body" id="queries-table-container" style="padding:var(--sp-4);">
          ${renderQueriesTable(localQueries)}
        </div>
      </div>
      
      <div class="card" style="display:flex; flex-direction:column;">
        <div class="card-header" style="border-bottom:1px solid rgba(115,138,117,0.1); padding:var(--sp-3) var(--sp-4);">
          <h3 class="card-title" style="margin:0;">💡 Postřehy &amp; Doporučení</h3>
        </div>
        <div class="card-body" style="flex:1; display:flex; flex-direction:column; justify-content:space-between; padding:var(--sp-4);">
          <div style="flex:1;">
            ${insightsHtml}
          </div>
          <div class="flex gap-3" style="margin-top:var(--sp-4);">
            <button class="btn btn-secondary btn-sm" data-action="geo-refresh" style="flex:1;">🔄 Obnovit data</button>
          </div>
        </div>
      </div>
    </div>
  `);

  // Handle Tab switches for SEO queries
  const btnLocal = container.querySelector('#tab-local-queries');
  const btnGeneral = container.querySelector('#tab-general-queries');
  const tableContainer = container.querySelector('#queries-table-container');

  if (btnLocal && btnGeneral && tableContainer) {
    btnLocal.addEventListener('click', () => {
      btnLocal.classList.add('active');
      btnGeneral.classList.remove('active');
      tableContainer.innerHTML = renderQueriesTable(localQueries);
    });

    btnGeneral.addEventListener('click', () => {
      btnGeneral.classList.add('active');
      btnLocal.classList.remove('active');
      tableContainer.innerHTML = renderQueriesTable(generalQueries);
    });
  }

  // Load and initialize Google Map if Key is present
  if (geoData.googleMapsApiKey) {
    try {
      await loadGoogleMapsScript(geoData.googleMapsApiKey);
      initGoogleMap(container, points);
    } catch (err) {
      console.error('[geo-dashboard] Failed to load Google Maps SDK:', err);
      const mapContainer = container.querySelector('#geo-marketing-map');
      if (mapContainer) {
        mapContainer.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:var(--c-cream); color:var(--c-error); padding:2rem; text-align:center;">
            <span>Chyba při inicializaci Google Maps API.</span>
            <span style="font-size:0.75rem; color:#888; margin-top:5px;">Zkontrolujte omezení a konfiguraci API klíče.</span>
          </div>`;
      }
    }
  } else {
    // Fallback: No API Key configured
    const mapContainer = container.querySelector('#geo-marketing-map');
    if (mapContainer) {
      mapContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:var(--c-cream); color:#888; padding:2rem; text-align:center;">
          <span>Google Maps API není nakonfigurováno.</span>
          <span style="font-size:0.75rem; color:#aa8866; margin-top:5px;">Doplňte SECRET_GOOGLE_MAPS_PLATFORM_API do Cloudflare Secrets.</span>
        </div>`;
    }
  }

  attachRefresh(container, ctx);
}

export function destroy() {
  activeGoogleMap = null;
}

/**
 * Dynamically loads Google Maps JavaScript SDK.
 */
function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-maps-js-sdk');
    if (existing) {
      // If a previous load attempt failed, remove the stale script and retry
      if (existing.getAttribute('data-failed') === 'true') {
        existing.remove();
      } else {
        // Script is already injected and loading — attach listeners
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
        return;
      }
    }
    const script = document.createElement('script');
    script.id = 'google-maps-js-sdk';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=visualization`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => {
      script.setAttribute('data-failed', 'true');
      reject(e);
    };
    document.head.appendChild(script);
  });
}

/**
 * Renders markers on Google Map container.
 */
function initGoogleMap(container, points) {
  const mapElement = container.querySelector('#geo-marketing-map');
  if (!mapElement) return;

  // Center on South Bohemia / Pisek
  const mapOptions = {
    center: { lat: 49.3134106, lng: 14.1375869 },
    zoom: 9,
    mapId: 'GEO_MARKETING_MAP',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: false,
    scaleControl: true,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: true,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ]
  };

  try {
    const map = new google.maps.Map(mapElement, mapOptions);
    activeGoogleMap = map;

    // Place markers
    points.forEach((pt) => {
      if (pt.latitude && pt.longitude) {
        const marker = new google.maps.Marker({
          position: { lat: pt.latitude, lng: pt.longitude },
          map: map,
          title: `${pt.city} - ${pt.service}`,
          animation: google.maps.Animation.DROP,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#3A4A3C', // brand color (c-forest)
            fillOpacity: 0.85,
            scale: 8,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding:5px; color:#333; font-family:sans-serif;">
            <strong style="color:var(--c-forest);">${esc(pt.city)}</strong><br>
            <span style="font-size:0.85rem;">Program: ${esc(pt.service)}</span><br>
            <span style="font-size:0.75rem; color:#888;">Poptáno: ${new Date(pt.created_at).toLocaleDateString("cs-CZ")}</span>
          </div>`
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });
      }
    });
  } catch (err) {
    console.error('[geo-dashboard] Map rendering failed:', err);
  }
}

function renderShell(inner) {
  return `
    <div class="canvas-header">
      <h1 class="canvas-title">GEO-Marketing &amp; SEO-AEO</h1>
      <p class="canvas-subtitle">Analytika a vizualizace organické akvizice ze spádových oblastí</p>
    </div>
    ${inner}
  `;
}

function renderLoading() {
  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:1.5rem; margin-bottom:2rem;">
      <div class="card"><div class="skeleton" style="height:80px;"></div></div>
      <div class="card"><div class="skeleton" style="height:80px;"></div></div>
      <div class="card"><div class="skeleton" style="height:80px;"></div></div>
      <div class="card"><div class="skeleton" style="height:80px;"></div></div>
    </div>
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:1.5rem; margin-bottom:2rem;">
      <div class="card"><div class="skeleton" style="height:350px;"></div></div>
      <div class="card"><div class="skeleton" style="height:350px;"></div></div>
    </div>
  `;
}

function renderEmpty(icon, title, text) {
  return `<div class="empty-state" style="padding: var(--sp-6) var(--sp-4); text-align:center;">
    <div style="font-size:2rem;margin-bottom:var(--sp-2);">${icon}</div>
    <h4 class="empty-state-title">${esc(title)}</h4>
    <p class="empty-state-text">${esc(text)}</p>
  </div>`;
}

function attachRefresh(container, ctx) {
  const btn = container.querySelector('[data-action="geo-refresh"]');
  if (btn) {
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Načítám…';
      render(container, ctx);
    });
  }
}

function esc(s) { if (!s) return ''; const e = document.createElement('span'); e.textContent = s; return e.innerHTML; }
