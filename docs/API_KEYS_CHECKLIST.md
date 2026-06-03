# Checklist API klíčů, tokenů a proměnných (Secrets & Variables)

> **Účel:** Kompletní registr všech konfiguračních parametrů, API klíčů, tokenů a proměnných prostředí (secrets & variables) potřebných pro provoz celého ekosystému Bicom Písek.
> **Základní pravidlo:** Vše ukládáme **výhradně do Cloudflare Secrets** (příkaz `wrangler secret put NAZEV` pro secrets) nebo jako **Environment Variables** v Cloudflare Pages / Workers konfiguraci. Lokálně pro vývoj využíváme výhradně `.dev.vars` (které jsou v `.gitignore`).

---

## 🔒 Backend Secrets & Variables (Stav po Sprintu S0)

Všechny níže uvedené parametry musí být správně nakonfigurovány v příslušných Cloudflare Pages a Workers projektech.

| Název v kódu | Typ | Kde je nasazen (CF Pages / Workers) | Účel |
| :--- | :--- | :--- | :--- |
| **`ENV`** | Variable | Pages, booking, cron, social | Detekce prostředí (`production` / `development` / `staging`). Ovlivňuje chování dev-fallbacků. |
| **`SECRET_MAINTENANCE_PIN`** | Secret | Pages (`bicom-pisek`) | Čtyřmístný kód pro bypass maintenance obrazovky (stránky údržby) na produkční doméně. |
| **`TURNSTILE_SITEKEY`** | Variable | Pages (`bicom-pisek`) | Veřejný klíč Cloudflare Turnstile pro ověřovací modal maintenance obrazovky. |
| **`TURNSTILE_SECRET_KEY`** | Secret | Pages (`bicom-pisek`) | Privátní klíč Cloudflare Turnstile pro server-side ověření (siteverify) maintenance tokenu. |
| **`SECRET_CF_ACCESS_TEAM`** | Secret | Pages (`bicom-pisek`) | Doména Cloudflare Access týmu (např. `meverik-solution.cloudflareaccess.com`) pro JWT validaci v admin sekci. |
| **`SECRET_CF_ACCESS_AUD`** | Secret | Pages (`bicom-pisek`) | Seznam Audience ID chráněných Access aplikací oddělený čárkou (pro dev a prod domény), sloužící k verifikaci JWT. |
| **`SECRET_ENCRYPTION_KEY`** | Secret | Pages, booking, cron | 256-bit AES klíč pro šifrování a dešifrování osobních a zdravotních údajů klientů v D1 (formát: 64-znakový hex string). |
| **`SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL`** | Secret | booking, cron | E-mail Service Accountu Google Cloud pro přístup ke kalendáři ordinace. |
| **`SECRET_GOOGLE_CALENDAR_PRIVATE_KEY`** | Secret | booking, cron | PEM privátní klíč ze staženého JSON souboru Service Accountu pro Google API autentizaci. |
| **`SECRET_GOOGLE_CALENDAR_ID`** | Secret | booking, cron | Unikátní ID sdíleného kalendáře ordinace (např. e-mail majitelky). |
| **`SECRET_GOOGLE_WORKSPACE_ADMIN_EMAIL`**| Secret | booking, cron | Admin e-mail pro Workspace správu (`admin@bicom-pisek.cz`). |
| **`SECRET_RESEND_API_KEY`** | Secret | booking, cron | API klíč pro odesílání transakčních e-mailů z domény `bicom-pisek.cz` přes resend.com. |
| **`SECRET_TELEGRAM_BOT_TOKEN`** | Secret | booking, cron, social | Token Telegram bota pro odesílání provozních upozornění a logů. |
| **`SECRET_TELEGRAM_CHAT_ID`** | Secret | booking, cron, social | ID chatovací místnosti/kanálu, kam bot zasílá provozní zprávy. |
| **`SECRET_SMS_GATEWAY_API_KEY`** | Secret | booking, cron | API klíč pro odesílání SMS upomínek (GoSMS.cz nebo BulkGate). |
| **`SECRET_META_GRAPH_ACCESS_TOKEN`** | Secret | cron | Dlouhodobý access token pro automatické čtení příspěvků z Instagramu. |
| **`SECRET_META_IG_USER_ID`** | Secret | cron | Numerické ID Instagram Business účtu. |
| **`SECRET_GROQ_API_KEY`** | Secret | Pages (`bicom-pisek`) | API klíč pro Groq Cloud (rychlé Llama 3/3.1 inference) jako primární chatovací LLM backend. |
| **`SECRET_GEMINI_API_KEY`** | Secret | Pages (`bicom-pisek`) | API klíč pro Google AI Studio (Gemini 1.5 Pro) jako backup chatovacího backendu. |
| **`SECRET_ADMIN_TOKEN`** | Secret | Pages (`bicom-pisek`) | *Záložní token pro administraci (pozn. v S0 nahrazeno Cloudflare Access JWT).* |
| **`SECRET_IDOKLAD_CLIENT_ID`** | Secret | booking, cron | *Plánováno:* Klientské ID pro integraci fakturačního systému iDoklad. |
| **`SECRET_IDOKLAD_CLIENT_SECRET`** | Secret | booking, cron | *Plánováno:* Klientský secret pro iDoklad API. |

---

## 🌐 Veřejné proměnné (Frontend / public)

Níže uvedené parametry byly původně zvažovány pro frontend, nicméně reálná implementace po S0 je následující:

-   **`NEXT_PUBLIC_MAPY_CZ_API_KEY` / `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`**
    *   *Stav:* **Nepoužívá se.** Webová prezentace používá bezplatný Mapy.cz `<iframe>` widget vložený přímo do HTML bez potřeby registrace API klíče:
        `https://api.mapy.cz/v1/iframe/index.html?center=14.1375869,49.3134106&zoom=14&mark=14.1375869,49.3134106`
-   **`NEXT_PUBLIC_GA_MEASUREMENT_ID`**
    *   *Stav:* Bude konfigurováno v příslušných HTML šablonách / skriptech pro cookies pouze v případě schválení měřících kódů na produkci.

---

## 🏗️ Infrastruktura (Cloudflare Dashboard)

Při zakládání projektů v Cloudflare se držte následujících reálných názvů zdrojů:

-   **D1 Databáze:** `bicom-pisek-db` (ID: `c04cb289-2ff4-45d7-9fa0-3243c34c3abe`)
-   **R2 Bucket:** `bicom-multimedia` (pro ukládání mediálních souborů a logů)
-   **KV Namespace:** `bicom-pisek-cache` (rate-limity, maintenance cache, atd.)
-   **Cloudflare Access:** Nastaveno nad složkou `/admin` pro obě domény `bicom-pisek.cz` i `bicom-pisek.pages.dev`.

---

## 📋 Kontaktní údaje od ordinace (pro sjednocení a ověření)

-   **IČO:** [Doplnit]
-   **Adresa ordinace:** [Doplnit přesnou adresu v Písku]
-   **E-mail ordinace:** `info@bicom-pisek.cz` (vč. MX záznamů a SPF/DKIM u Resendu)
-   **Google Calendar:** Kalendář sdílen s e-mailem Service Accountu (`SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL`) s právem provádět změny.
