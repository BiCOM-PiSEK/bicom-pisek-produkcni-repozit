// functions/_middleware.js
// Intercepts requests on custom domains to show a premium technical maintenance screen.
// Bypasses maintenance for the development domain (bicom-pisek.pages.dev) and local development.

const MAINTENANCE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technická údržba — Bicom Písek</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    :root {
      --c-alabaster: #FAF8F5;
      --c-sage: #738A75;
      --c-forest: #3A4A3C;
      --c-champagne: #C5A880;
      --c-charcoal: #2B2B2B;
      --c-mist: #EAEFE9;
      --font-head: "Cormorant Garamond", Georgia, serif;
      --font-body: "Montserrat", system-ui, sans-serif;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      background-color: var(--c-alabaster);
      color: var(--c-charcoal);
      font-family: var(--font-body);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 20px;
      overflow-x: hidden;
    }
    
    .card {
      background: #ffffff;
      border: 1px solid var(--c-mist);
      border-radius: 20px;
      padding: 50px 40px;
      max-width: 550px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 40px rgba(58, 74, 60, 0.05);
      position: relative;
      z-index: 1;
    }
    
    .logo-container {
      margin-bottom: 30px;
      display: flex;
      justify-content: center;
    }
    
    .logo-icon {
      width: 64px;
      height: 64px;
      fill: none;
      stroke: var(--c-champagne);
      stroke-width: 1.2;
    }
    
    h1 {
      font-family: var(--font-head);
      color: var(--c-forest);
      font-size: 2.2rem;
      font-weight: 500;
      margin-bottom: 20px;
      letter-spacing: -0.5px;
    }
    
    p {
      font-size: 0.95rem;
      line-height: 1.7;
      color: #555;
      margin-bottom: 35px;
      font-weight: 300;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: var(--c-forest);
      color: var(--c-alabaster);
      border: none;
      border-radius: 30px;
      padding: 16px 32px;
      font-size: 0.9rem;
      font-weight: 500;
      font-family: var(--font-body);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      letter-spacing: 0.5px;
      box-shadow: 0 4px 15px rgba(58, 74, 60, 0.15);
    }
    
    .btn:hover {
      background-color: var(--c-sage);
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(115, 138, 117, 0.25);
    }
    
    .btn svg {
      margin-left: 8px;
      transition: transform 0.3s ease;
    }
    
    .btn:hover svg {
      transform: translateX(4px);
    }
    
    .footer {
      margin-top: 40px;
      font-size: 0.8rem;
      color: #999;
      font-weight: 300;
      letter-spacing: 0.5px;
    }
    
    /* Modal / Overlay */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(58, 74, 60, 0.15);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      padding: 20px;
    }
    
    .modal-overlay.active {
      opacity: 1;
      pointer-events: auto;
    }
    
    .modal {
      background: #ffffff;
      border: 1px solid var(--c-mist);
      border-radius: 20px;
      padding: 40px;
      max-width: 450px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(58, 74, 60, 0.12);
      transform: scale(0.95) translateY(10px);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .modal-overlay.active .modal {
      transform: scale(1) translateY(0);
    }
    
    .modal-title {
      font-family: var(--font-head);
      color: var(--c-forest);
      font-size: 1.8rem;
      margin-bottom: 10px;
    }
    
    .modal-desc {
      font-size: 0.85rem;
      line-height: 1.5;
      color: #666;
      margin-bottom: 25px;
      font-weight: 300;
    }
    
    .pin-container {
      display: flex;
      justify-content: center;
      gap: 12px;
      margin-bottom: 25px;
    }
    
    .pin-input {
      width: 55px;
      height: 55px;
      border: 1px solid var(--c-mist);
      border-radius: 12px;
      font-size: 1.5rem;
      text-align: center;
      font-family: var(--font-body);
      font-weight: 500;
      color: var(--c-forest);
      background-color: var(--c-alabaster);
      transition: all 0.2s ease;
    }
    
    .pin-input:focus {
      outline: none;
      border-color: var(--c-champagne);
      background-color: #ffffff;
      box-shadow: 0 0 10px rgba(197, 168, 128, 0.2);
    }
    
    .turnstile-container {
      display: flex;
      justify-content: center;
      margin-bottom: 25px;
      min-height: 65px;
    }
    
    .close-btn {
      background: none;
      border: none;
      color: #888;
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: underline;
      transition: color 0.2s ease;
      font-family: var(--font-body);
    }
    
    .close-btn:hover {
      color: var(--c-forest);
    }
    
    .error-msg {
      color: var(--c-error);
      font-size: 0.85rem;
      margin-bottom: 15px;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.2s ease;
      min-height: 20px;
    }
    
    .error-msg.active {
      opacity: 1;
    }
    
    .decor-blob {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(115,138,117,0.06) 0%, rgba(250,248,245,0) 70%);
      z-index: 0;
    }
    
    .blob-1 {
      top: -100px;
      left: -100px;
    }
    
    .blob-2 {
      bottom: -100px;
      right: -100px;
    }
  </style>
</head>
<body>
  <div class="decor-blob blob-1"></div>
  <div class="decor-blob blob-2"></div>
  
  <main class="card">
    <div class="logo-container">
      <svg class="logo-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a30 30 0 0 1 0 20M12 2a30 30 0 0 0 0 20M2 12a30 30 0 0 1 20 0M2 12a30 30 0 0 0 20 0" />
      </svg>
    </div>
    
    <h1>Technická údržba</h1>
    <p>Naše webové stránky právě procházejí plánovanou technickou údržbou, abychom Vám mohli nabídnout ještě lepší služby. Omlouváme se za dočasné nepříjemnosti a děkujeme za Vaši trpělivost.</p>
    
    <button class="btn" id="open-btn">
      Vstoupit do vývojové verze
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    </button>
  </main>
  
  <footer class="footer">
    © 2026 Bicom Písek. Všechna práva vyhrazena.
  </footer>
  
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal">
      <h2 class="modal-title">Ověření přístupu</h2>
      <p class="modal-desc">Pro přesměrování na prezentační verzi zadejte čtyřmístný přístupový kód a potvrďte bezpečnostní ověření.</p>
      
      <div class="error-msg" id="error-msg"></div>
      
      <div class="pin-container">
        <input type="text" maxlength="1" class="pin-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" autofocus>
        <input type="text" maxlength="1" class="pin-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
        <input type="text" maxlength="1" class="pin-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
        <input type="text" maxlength="1" class="pin-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      </div>
      
      <div class="turnstile-container">
        <div class="cf-turnstile" data-sitekey="1x00000000000000000000AA" data-callback="onTurnstileSuccess"></div>
      </div>
      
      <button class="close-btn" id="close-btn">Zpět na úvod</button>
    </div>
  </div>

  <script>
    let turnstileToken = null;
    
    function onTurnstileSuccess(token) {
      turnstileToken = token;
      checkAndRedirect();
    }
    
    const openBtn = document.getElementById('open-btn');
    const closeBtn = document.getElementById('close-btn');
    const overlay = document.getElementById('modal-overlay');
    const pinInputs = document.querySelectorAll('.pin-input');
    const errorMsg = document.getElementById('error-msg');
    
    openBtn.addEventListener('click', () => {
      overlay.classList.add('active');
      pinInputs[0].focus();
    });
    
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
      errorMsg.classList.remove('active');
      pinInputs.forEach(i => i.value = '');
    });
    
    pinInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        
        if (e.target.value.length === 1 && index < 3) {
          pinInputs[index + 1].focus();
        }
        checkAndRedirect();
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
          pinInputs[index - 1].focus();
        }
      });
    });
    
    function showError(msg) {
      errorMsg.textContent = msg;
      errorMsg.classList.add('active');
    }
    
    function checkAndRedirect() {
      const pin = Array.from(pinInputs).map(i => i.value).join('');
      if (pin.length < 4) return;
      
      if (pin !== '1994') {
        showError('Neplatný přístupový kód');
        pinInputs.forEach(i => i.value = '');
        pinInputs[0].focus();
        return;
      }
      
      if (!turnstileToken) {
        showError('Potvrďte prosím ověření Turnstile');
        return;
      }
      
      errorMsg.classList.remove('active');
      
      // Verification successful! Set cookie and redirect to the presentation domain.
      document.cookie = "bypass_maintenance=1994; path=/; max-age=2592000; secure; samesite=strict";
      window.location.href = 'https://bicom-pisek.pages.dev';
    }
  </script>
</body>
</html>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const hostname = url.hostname;

  // We only run this maintenance logic on the main production domain(s)
  if (hostname === 'bicom-pisek.cz' || hostname === 'www.bicom-pisek.cz') {
    
    // Check if the user has the bypass cookie
    const cookieHeader = context.request.headers.get('Cookie') || '';
    const hasBypass = cookieHeader.includes('bypass_maintenance=1994');
    
    if (!hasBypass) {
      // If requesting API, return 503 JSON
      if (url.pathname.startsWith('/api/')) {
        return new Response(
          JSON.stringify({ error: 'technical_maintenance', message: 'Stránky právě procházejí technickou údržbou.' }),
          {
            status: 503,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
      
      // Otherwise, return the standalone Maintenance HTML page
      return new Response(MAINTENANCE_HTML, {
        status: 503,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    }
  }

  // Pass-through to normal Pages routes/static content
  return context.next();
}
