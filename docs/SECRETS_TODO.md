# 📌 Stav Secrets a Klíčů (Bicom Písek — Netlify Produkce)

### ✅ Všechny potřebné API klíče a Secrets jsou kompletně nastaveny na Netlify!

| Proměnná | Stav | Účel |
| :--- | :---: | :--- |
| `SUPABASE_URL` | ✅ Aktivní | Supabase PostgreSQL REST URL |
| `SUPABASE_ANON_KEY` | ✅ Aktivní | Klientský přístup k Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Aktivní | Privátní backend přístup pro Netlify Functions |
| `RESEND_API_KEY` | ✅ Aktivní | Odesílání potvrzení rezervací e-mailem |
| `SECRET_GROQ_API_KEY` | ✅ Aktivní | AI Rádce & AI Copywriter (Llama 3.3 70B) |
| `SECRET_GEMINI_API_KEY` | ✅ Aktivní | AI záložní model (Gemini 2.0 Flash) |
| `SECRET_GOOGLE_MAPS_PLATFORM_API` | ✅ Aktivní | Google Maps Platform API |
| `SECRET_GOOGLE_CALENDAR_CLIENT_EMAIL` | ✅ Aktivní | Google Calendar Service Account |
| `SECRET_GOOGLE_CALENDAR_PRIVATE_KEY` | ✅ Aktivní | Google Calendar RSA Private Key |
| `SECRET_GOOGLE_CALENDAR_ID` | ✅ Aktivní | ID kalendáře ordinace |
| `SECRET_TELEGRAM_BOT_TOKEN` | ✅ Aktivní | Telegram bot token od @BotFather |
| `SECRET_TELEGRAM_CHAT_ID` | ✅ Aktivní | Chat ID pro notifikace ordinace |
| `IDOKLAD_CLIENT_ID` | ✅ Aktivní | iDoklad OAuth2 Client ID |
| `IDOKLAD_CLIENT_SECRET` | ✅ Aktivní | iDoklad OAuth2 Client Secret |
| `SECRET_MAPYCZ_API_KEY` | ✅ Aktivní | Mapy.cz Geocoding & Autocomplete proxy |
| `STRIPE_PUBLISHABLE_KEY` | ✅ Aktivní | Stripe platební brána (veřejný klíč) |
| `STRIPE_SECRET_KEY` | ✅ Aktivní | Stripe tajný klíč pro platby |
| `GOSMS_CLIENT_ID` + `GOSMS_CLIENT_SECRET` | ✅ Aktivní | GoSMS API pro SMS připomínky |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | ✅ Aktivní | Cloudflare Turnstile bot ochrana |
| `SECRET_ADMIN_PASSWORD` | ✅ Aktivní | Přístupové heslo do Virtual Office |
| `SECRET_SESSION_KEY` | ✅ Aktivní | 256-bit HMAC klíč pro podepisování relací |
| `SECRET_ENCRYPTION_KEY` | ✅ Aktivní | 256-bit AES klíč pro GDPR šifrování dat |
| `BASE_URL` | ✅ Aktivní | `https://bicompisek.cz` |

---

### 🔄 Před-produkční rotace klíčů (Před ostrým spuštěním pro veřejnost)
- [ ] Po dokončení finálních testů zrotovat dočasné testovací tokeny (např. Stripe test $\rightarrow$ live, nová hesla).
