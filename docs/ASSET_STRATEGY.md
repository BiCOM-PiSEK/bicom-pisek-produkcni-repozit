# Asset & Imagery Strategy — Bicom Písek

> **Závazný dokument pro všechny vývojáře, designéry a AI agenty.**
> Definuje, kde se uchovávají vizuální podklady, jak se zpracovávají a jak se dostanou na web.
> Verze: 1.0 · 2026-05-31

---

## 1. Přehled architektury assetů

```
 ORIGINÁLY (plné rozlišení)          VÝROBNÍ VERZE (web)
 ──────────────────────────          ────────────────────
 docs/assets/originals/              public/assets/img/
 ├── logo/                           ├── logo/
 ├── hero/                           ├── hero/
 ├── og/                             ├── og/
 ├── icons/                          ├── icons/
 ├── gallery/                        └── gallery/
 └── certificates/
                                     DYNAMICKÁ MEDIA (runtime)
                                     ──────────────────────────
                                     Cloudflare R2: bicom-multimedia
                                     ├── blog/        (Instagram sync)
                                     ├── gallery/     (admin upload)
                                     └── backups/     (DB zálohy)
```

---

## 2. Tři vrstvy úložiště

### 2.1 Originály — `docs/assets/originals/`

**Účel:** Zdrojové soubory v plném rozlišení. Figma exporty, RAW fotky, SVG zdroje, PSD/AI soubory.

**Pravidla:**
- Commitovány do Gitu (zdrojový archiv, vždy dostupné)
- Pojmenovávání: `kebab-case`, bez mezer, bez diakritiky
- Formáty: SVG (vektorové), PNG (rastrové podklady), JPEG (fotky plné kvality)
- Maximální velikost jednoho souboru: **5 MB** (větší soubory → R2)
- Složka slouží jako **zdroj pravdy** pro designéry i agenty

**Struktura:**
```
docs/assets/originals/
├── logo/
│   ├── bicom-pisek-logo-full.svg       (hlavní logo, vektorové)
│   ├── bicom-pisek-logo-icon.svg       (ikona/symbol bez textu)
│   └── bicom-pisek-logo-wordmark.svg   (jen text)
├── hero/
│   ├── hero-lifestyle-main.png         (hlavní hero vizuál)
│   └── hero-device-bicom-optima.png    (zařízení Bicom Optima)
├── og/
│   └── og-card-source.png              (OG sdílecí obrázek, 1200×630)
├── icons/
│   ├── favicon-source.svg              (zdrojový SVG pro favicon generátor)
│   └── apple-touch-icon-source.png     (1024×1024 zdroj)
├── gallery/
│   ├── ordinace-01.jpg
│   ├── ordinace-02.jpg
│   └── lenka-portret.jpg
└── certificates/
    ├── cert-bicom-regumed.jpg
    └── cert-iso-medical.jpg
```

---

### 2.2 Výrobní statika — `public/assets/img/`

**Účel:** Optimalizované soubory přímo servírované Cloudflare Pages. Malé, rychlé, commitovány do Gitu.

**Pravidla:**
- **Formáty:** WebP (primární), AVIF (progressive enhancement), SVG (vektory), ICO (favicon)
- **Rozlišení:** max 1920px šířka (hero), 1200×630 (OG), 512px (ikony)
- **Kvalita:** WebP 80%, AVIF 70%
- **Pojmenování:** shodné s originálem, jen jiná přípona
- **Celková velikost složky:** cíl pod **2 MB** (aby Git zůstal svižný)

**Struktura:**
```
public/assets/img/
├── og.jpg                    (1200×630 — OG sdílecí karta, JPEG pro max kompatibilitu)
├── hero-lifestyle.webp       (hlavní hero vizuál, optimalizovaný)
├── hero-device.webp          (Bicom Optima zařízení)
├── logo/
│   ├── logo.svg              (hlavní logo pro web)
│   └── logo-icon.svg         (ikona pro mobilní/kompaktní zobrazení)
├── gallery/
│   ├── ordinace-01.webp
│   └── lenka-portret.webp
└── certificates/
    ├── cert-bicom.webp
    └── cert-iso.webp
```

**Speciální soubory v rootu `public/`** (ne v `img/`):
```
public/
├── favicon.ico              (multi-size: 16×16, 32×32, 48×48)
├── icon.svg                 (SVG favicon — moderní prohlížeče)
├── apple-touch-icon.png     (180×180 PNG — iOS)
└── manifest.json            (PWA manifest s icon referencemi)
```

---

### 2.3 Dynamická média — R2 bucket `bicom-multimedia`

**Účel:** Runtime obrázky generované systémem — Instagram sync, blog cover fotky z admin panelu, zálohy DB.

**Pravidla:**
- **NIKDY** se necommitují do Gitu
- Přístup přes Worker binding `MEDIA` (viz wrangler.toml)
- Servírované přes URL `/media/{path}` (Worker route)
- Automatický cleanup starých záloh (cron, max 4 zálohy)

**Struktura v R2:**
```
bicom-multimedia/
├── blog/
│   ├── ig-{instagram-id}.jpg    (Instagram sync, viz _cron-instagram.js)
│   └── manual-{slug}.webp       (admin upload)
├── gallery/
│   └── upload-{uuid}.webp       (admin galerie — budoucí)
└── backups/
    └── d1-backup-{date}.json    (automatické zálohy DB)
```

---

## 3. Workflow: Od originálu po web

```
1. Designér/vlastník vytvoří vizuál
   │
2. Uloží originál do docs/assets/originals/{kategorie}/ (nebo do Inboxu)
   │
3. Optimalizace (manuální nebo skript):
   │  - Ořez na správný poměr stran
   │  - Export do WebP/AVIF (squoosh.app / ImageMagick / Figma export)
   │  - Resize na max rozlišení dle pravidel výše
   │
4. Optimalizovaný soubor → public/assets/img/{kategorie}/
   │
5. Git commit obou verzí (originál + web)
   │
6. Cloudflare Pages deploy → soubory jsou globálně dostupné
```

### 3.1 Rychlý import přes uživatelskou složku (Inbox)

Pro maximální pohodlí je v repozitáři připravena rychlá schránka (inbox):
`docs/assets/Matěj - dokumenty, soubory a multimédia (ke zpracovani)/`

**Jak tento workflow funguje:**
1. Vlastník (Matěj) vygeneruje obrázky (např. přes Gemini Omni) a jednoduše je přetáhne do této složky.
2. AI agent při svém dalším spuštění:
   - Rozpozná a roztřídí obrázky podle obsahu a názvu.
   - Provede automatické oříznutí (včetně detekce okrajů u favicon a ikon).
   - Zkonvertuje soubory do správných formátů (WebP, JPEG pro OG, ICO pro favicon).
   - Přemístí originály do `docs/assets/originals/` a výrobní verze do `public/assets/img/` a `public/`.
   - Vše automaticky commitne a připraví pro deploy.

Tento workflow je plně aktivní a ověřený. Jakékoli budoucí obrázky stačí hodit do této složky a požádat agenta o zpracování.

### Doporučené nástroje pro optimalizaci
- **[Squoosh](https://squoosh.app/)** — jednorázová konverze v prohlížeči (WebP/AVIF)
- **ImageMagick** — hromadná konverze v terminálu:
  ```bash
  # JPEG → WebP, kvalita 80%, max šířka 1920px
  magick input.jpg -resize '1920x>' -quality 80 output.webp

  # PNG → AVIF, kvalita 70%
  magick input.png -quality 70 output.avif

  # Multi-size favicon z SVG
  magick icon.svg -define icon:auto-resize=48,32,16 favicon.ico
  ```
- **Figma** — export přímo do WebP/SVG z design souborů

---

## 4. Pojmenovací konvence

| Pravidlo | Příklad |
|----------|---------|
| `kebab-case`, bez diakritiky | `hero-lifestyle-main.webp` |
| Kategorie jako prefix | `cert-bicom-regumed.webp` |
| Originály zachovávají plný popisný název | `bicom-pisek-logo-full.svg` |
| Výrobní verze mohou být kratší | `logo.svg` |
| Instagram sync: `ig-{id}` | `ig-18234567890.jpg` |
| Admin upload: `upload-{uuid}` | `upload-a3f8c2e1.webp` |

---

## 5. Referenční tabulka — co kde hledat

| Asset | Originál | Web verze | Kde se používá |
|-------|----------|-----------|----------------|
| Logo (SVG) | `docs/assets/originals/logo/` | `public/assets/img/logo/logo.svg` | Header, footer, OG |
| Hero vizuál | `docs/assets/originals/hero/` | `public/assets/img/hero-lifestyle.webp` | Sekce #hero |
| OG sdílecí karta | `docs/assets/originals/og/` | `public/assets/img/og.jpg` | `<meta og:image>` |
| Favicon | `docs/assets/originals/icons/` | `public/favicon.ico` | `<link rel="icon">` |
| SVG favicon | `docs/assets/originals/icons/` | `public/icon.svg` | `<link rel="icon">` |
| Apple Touch | `docs/assets/originals/icons/` | `public/apple-touch-icon.png` | `<link rel="apple-touch-icon">` |
| Blog fotky (IG) | — (dynamické) | R2 `blog/ig-{id}.jpg` | Sekce #magazín |
| Galerie ordinace | `docs/assets/originals/gallery/` | `public/assets/img/gallery/` | Sekce galerie |
| Certifikáty | `docs/assets/originals/certificates/` | `public/assets/img/certificates/` | Sekce důvěra |

---

## 6. Co agent smí a nesmí

| ✅ Smí | ❌ Nesmí |
|--------|---------|
| Číst originály z `docs/assets/originals/` | Commitovat obrázky větší než 5 MB |
| Odkazovat na `public/assets/img/` v HTML/CSS | Vkládat obrázky přímo do HTML jako base64 |
| Nahrávat dynamický obsah do R2 přes binding `MEDIA` | Mazat existující originály |
| Přidávat nové optimalizované verze do `public/assets/img/` | Používat obrázky s cizími vodoznaky na produkci |
| Odkazovat na R2 média přes `/media/{path}` | Ukládat statické branding vizuály do R2 |

---

## 7. Vizuální DNA — povinné dodržet u každého vizuálu

Každý vizuál MUSÍ respektovat design systém definovaný v:
- `docs/STYLE_BRIEF.md` — Quiet Luxury zákoník
- `MEVERIK_vyvojovy_balik/07_DESIGN_DNA/01_Vizualni_DNA_a_design_system.md` — plná DNA

**Barevná paleta:**
```css
--c-alabaster:  #FAF8F5;   /* hřejivá smetanová — primární pozadí */
--c-sage:       #738A75;   /* šalvějová — příroda, obnova */
--c-forest:     #3A4A3C;   /* hluboká lesní — tech/bezpečí */
--c-champagne:  #C5A880;   /* champagne gold — akcenty */
--c-charcoal:   #2B2B2B;   /* uhlová — text */
--c-mist:       #EAEFE9;   /* světlá šalvějová — karty */
```

**Anti-vzory (ZAKÁZÁNO):**
- ❌ Ezoterika (krystaly, čakry, fialová, „vibrace")
- ❌ Klinický chlad (bílá nemocnice, modrá korporace, stock doktoři)
- ❌ Křiklavé barvy, neon, přehnané gradienty
- ❌ Cizí loga, vodoznaky (NotebookLM apod.)
- ❌ Stock klišé (zkumavky, EKG, „před/po")

**Povinný styl:**
- Difuzní přirozené světlo, žádné tvrdé stíny
- Organické materiály ve fotografiích (dřevo, kámen, látka)
- Autentičtí lidé (ne stock), cílová skupina 40–55 let
- Serif nadpisy (Cormorant Garamond), sans-serif text (Montserrat)
- Tenké linkové ikony v champagne gold

---

## 8. Checklist — co je potřeba vytvořit

| # | Soubor | Cíl | Priorita | Prompt ID |
|---|--------|-----|----------|-----------|
| 1 | `favicon.ico` | `public/favicon.ico` | 🔴 Kritický | PROMPT-01 |
| 2 | `icon.svg` | `public/icon.svg` | 🔴 Kritický | PROMPT-02 |
| 3 | `apple-touch-icon.png` | `public/apple-touch-icon.png` | 🔴 Kritický | PROMPT-03 |
| 4 | `og.jpg` | `public/assets/img/og.jpg` | 🔴 Kritický | PROMPT-04 |
| 5 | Hero lifestyle vizuál | `public/assets/img/hero-lifestyle.webp` | 🟠 Vysoká | PROMPT-05 |
| 6 | Logo SVG | `public/assets/img/logo/logo.svg` | 🟡 Střední | PROMPT-06 |
