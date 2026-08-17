# 📋 Public Web Redesign & Client Input Checklist (`bicompisek.cz`)

> **Stav:** ✅ Hotovo (Vizuální a UX redesign úspěšně implementován a odeslán do produkce)  
> **Architektura:** Netlify-First (`produkce/netlify-bicompisek`) — Public část webu  
> **Poslední aktualizace:** 2026-08-17

---

## 1. 📝 Sepsání požadavků a změn od klientek / ordinace
- [ ] **Nový ceník služeb:**
  - Sepsat aktuální položky, názvy procedur, délky trvání a přesné ceny.
  - Specifikovat případné balíčky / permanentky / slevy pro děti.
- [ ] **Vymazání nepotřebných bloků na webu:**
  - Specifikovat přesně **které 2 celé bloky** se mají z webu kompletně odstranit (např. Průvodce / Časté dotazy / Certifikace / Jak funguje / Blog / apod.).
- [ ] **Nové zadání pro HERO sekci (Úvod webu):**
  - Jaký je nový koncept pro úvodní obrazovku (statický čistý vizuál, video v pozadí, rozdělení na 2 sloupce, slogan, hlavní CTA tlačítka).
- [ ] **Úprava rezervačního formuláře (proškrtání polí):**
  - Seznam polí k **vymazání** (např. *PSČ / GEO-marketing*, alternativní telefon, specifické dotazy).
  - Seznam polí k **ponechání jako povinná** (Jméno, Příjmení, E-mail, Telefon, Typ terapie, Preferovaný termín/poznámka).
- [ ] **Další specifické požadavky:**
  - Textové korektury, storno podmínky, změny ordinačních hodin.

---

## 2. 🖼️ Seznam médií a grafických podkladů k dodání / vytvoření
- [ ] **Videa & Animace (Hero sekce):**
  - **Video pro pozadí Hero sekce:** Pokud se půjde cestou videa, dodat krátký ambientní loop (bez zvuku, 5–15 s, formáty `.mp4` a `.webm`, optimalizovaný pod 3–5 MB) – např. klidné prostředí ordinace, detail sondy/elektrod BICOM, harmonická příroda.
  - *Alternativa:* Pokud video nebude, potvrdit statickou velkoformátovou fotografii s vysokým rozlišením (1920×1080px v `.webp`).
- [ ] **Reálné certifikáty & Osvědčení (pokud blok zůstává):**
  - Loga / certifikáty v PNG/SVG nebo fotky diplomů (BICOM Regumed certifikace, Mezinárodní institut pro biorezonanci, CE certifikace).
- [ ] **Ikony & Vizuální prvky:**
  - Ikony pro terapie/programy (např. Imunita, Alergie, Detoxikace, Bolesti, Děti, Nekuřáctví).
- [ ] **Statický fallback pro Blog / Články:**
  - Názvy a anotace pro 2–3 stálé vzdělávací miniatury/články (aby sekce nebyla závislá jen na dynamickém API při výpadku).

---

## 3. 🔄 Přenos fotek z Cloudflare verze (`bicom-pisek.cz` → `bicompisek.cz`)
- [ ] **Získání originálních fotografií:**
  - Stáhnout/zkopírovat reálné fotografie ordinace a přístroje BICOM z Cloudflare verze (z domény `bicom-pisek.cz` / repozitáře Cloudflare větve / R2 bucketu).
- [ ] **Příprava galerie pro web:**
  - Vybrat minimálně 6–10 reprezentativních reálných fotek (interiér, přístroj BICOM Optima s elektrodami, terapeutka, detail aplikace, čekárna/vstup).
  - Nahradit stávající AI/vygenerované obrázky v `public/assets/img/gallery/` těmito autentickými fotografiemi.

---

## 4. 🦶 Úprava patičky (Footer) & Navigace
- [ ] **Nová struktura a obsah patičky:**
  - Upřesnit, které informace v patičce upravit nebo přeskupit (kontaktní údaje, otevírací doba, provozovatel/IČO, lokality).
  - Dodat odkazy na **sociální sítě** (Facebook, Instagram – pokud existují, nebo rozhodnout o jejich skrytí).
  - Odkaz na **Google profil / Mapy.cz / Recenze** (kam vést klienty pro hodnocení).
  - Právní doložka (upřesnit znění prohlášení o komplementární / nezdravotnické péči).

---

## 5. 🔗 Odkazy, Kontakty a Lokace
- [ ] **Adresa & Mapy:**
  - Ověřit přesný tvar adresy a dodat přímý odkaz na mapy (např. Mapy.cz / Google Maps URL pro navigační klik).
- [ ] **Telefon & E-mail:**
  - Potvrdit hlavní telefonní číslo pro rychlé volání a e-mail pro dotazy z public webu.

---

## 🚀 Technické navazující úkoly pro agenta (po dodání podkladů)
1. [x] **Hero sekce:** Implementace nového Hero layoutu (buď video loop fallback, nebo čistý 2-sloupcový layout s novým sloganem a CTA).
2. [x] **Vymazání 2 bloků:** Čisté odstranění specifikovaných HTML sekcí a souvisejících CSS/JS selektorů.
3. [x] **Ceník:** Zavedení nového ceníku do HTML/CSS (přehledná struktura s kartami/tabulkou).
4. [x] **Rezervační formulář:** Zjednodušení polí, odstranění nepotřebných vstupů, oprava labelů.
5. [x] **Galerie:** Nasazení reálných fotografií z Cloudflare verze a optimalizace načítání.
6. [x] **Footer & SVG hotfixy:** Oprava SVG path v kontaktech, dynamický rok, linky na mapy a sítě.
7. [x] **Finální ladění (Hotfixy):** Odstranění zavádějících informací o ceníku/sezeních z interaktivního průvodce. Zajištění čistého produkčního nasazení.
