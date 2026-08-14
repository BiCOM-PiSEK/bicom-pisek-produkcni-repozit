# 📌 Zbývající Secrets a Klíče k doplnění (Bicom Písek — Netlify Produkce)

Tento soubor eviduje zbývající 3 klíče, které je potřeba vygenerovat a doplnit do Netlify Environment Variables před ostrým provozem:

---

### 1. `SECRET_TELEGRAM_BOT_TOKEN`
- **Účel:** Odesílání okamžitých notifikací o nových rezervacích a týdenních reportů do mobilu administrátora.
- **Aktuální stav:** Chat ID je nastaveno (`8737895841`), chybí API token bota.
- **Kde získat:** V aplikaci Telegram kontaktujte `@BotFather`, zadejte příkaz `/newbot`, pojmenujte bota (např. *Bicom Písek Notifikace*) a zkopírujte vygenerovaný HTTP API Token (formát: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
- **Kam vložit:** Netlify Dashboard $\rightarrow$ Site configuration $\rightarrow$ Environment variables $\rightarrow$ `SECRET_TELEGRAM_BOT_TOKEN`.

---

### 2. `IDOKLAD_CLIENT_ID` & `IDOKLAD_CLIENT_SECRET` (Volitelné)
- **Účel:** Automatické vystavování daňových dokladů a faktur v iDokladu při dokončení terapie nebo online platbě.
- **Aktuální stav:** Vypnuto / simulovaný režim.
- **Kde získat:** V účtu [app.idoklad.cz](https://app.idoklad.cz) $\rightarrow$ Nastavení $\rightarrow$ Integrace / API $\rightarrow$ Nová aplikace.
- **Kam vložit:** Netlify Dashboard $\rightarrow$ Environment variables $\rightarrow$ `IDOKLAD_CLIENT_ID` a `IDOKLAD_CLIENT_SECRET`.

---

### 3. Rotace klíčů před oficiálním spuštěním
- **Účel:** Po dokončení všech integračních testů a před veřejným otevřením domény `bicompisek.cz` zrotovat veškeré dočasné testovací tokeny (Stripe, heslo administrátora, šifrovací klíče).
- **Termín:** Fáze 7 (před ostrým přepnutím DNS).
