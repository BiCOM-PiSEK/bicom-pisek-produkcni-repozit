# 📝 CMS — Editace obsahu webu (návod pro provozovatelky)

> **Co to umí:** Měnit texty, fotky a hlavní bannery webu **přímo z admin konzole**
> (virtuální kanceláře) — bez programátora a bez nasazování. Změny se na webu
> projeví do ~1 minuty (cache).

---

## 0. Workflow: koncept → náhled → zveřejnit (F12)

Úpravy textů, galerií, kontaktu/patičky, služeb a hero bannerů se **neukládají rovnou na web**.
Fungují jako **koncept**:

1. Upravíte text a dáte **💾 Uložit koncept** — uloží se, ale na webu se zatím nic nezmění.
2. V **náhledu vpravo** (klikněte na ↻ Obnovit) vidíte, jak změna bude vypadat.
3. Když jste spokojeni, dáte **✅ Zveřejnit** — teprve teď se změna objeví na webu (do ~1 min).
4. Nebo **↩︎ Zahodit koncept** — koncept se zruší a zůstane původní zveřejněná verze.

### Zpět/Vpřed + reset na zveřejněný stav

V editorech textů, karet, FAQ, kontaktu/patičky, SEO/Landing i Hero jsou nově tlačítka:

- **↶ Zpět** a **↷ Vpřed** — historie změn v aktuální relaci (max. 10 kroků).
- **⟲ Reset na zveřejněný stav** — vrátí formulář na hodnoty, které jsou právě publikované na webu.

Reset ani undo/redo samy nic nepublikují; stále platí **Uložit koncept → Zveřejnit**.

### Visual Builder (interaktivní výběr bloků)

U všech záložek s náhledem je tlačítko **🧩 Visual Builder**:

1. Otevře zvětšený náhled stránky (v modalu).
2. Kliknete přímo na blok na webu (text, galerie, FAQ, landing pole, kontakt, CTA, karta, formulář…).
3. Vpravo se ukáže kompletní outline stránky včetně **editovatelných**, **mediálních**, **dynamických** a **zamčených** bloků.
4. Filtry **Editovatelné / Média / Zamčené / Dynamické** pomohou najít přesně to, co chcete upravit.
5. U jednoduchých textů, landing polí, kontaktu/NAP a hero polí lze upravit hodnotu rovnou v pravém inspektoru a dát **💾 Uložit koncept**.
6. Panel **Nezveřejněné změny** ukazuje koncepty napříč texty, hero, galeriemi a službami. Vybraný podporovaný blok lze z inspektoru rovnou **✅ Zveřejnit blok** nebo **↩︎ Zahodit koncept**.
7. Tlačítko **🎯 Najít v editoru** posune aktuální záložku adminu na odpovídající formulář, pokud blok potřebuje plný specializovaný editor.

Zamčené bloky nejsou chyba načtení. Jsou to části šablony nebo funkční prvky (např. navigace, formulář, mapa,
AI widget), které builder ukazuje kvůli orientaci v celé stránce. Pokud je uvnitř zamčeného bloku napojený text,
obrázek nebo karta, má vlastní editovatelný blok. Mediální bloky jsou označené zvlášť a navádějí do galerie/hero
workflow; přímá výměna z centrální media knihovny je připravená jako navazující krok.

Visual Builder sám nic nepublikuje automaticky. I při inline úpravě stále platí workflow **uložit koncept → náhled → zveřejnit**.

### Pojmenované verze konceptu (F12-D)

U textů, karet, FAQ, kontaktu/patičky, SEO, landing textů, hero bannerů a služeb
si můžete koncept **uložit jako pojmenovanou verzi** (např. „Vánoční nabídka“,
„Letní akce“) a kdykoli se k ní vrátit:

- **🏷️ Uložit jako verzi…** — uloží aktuální koncept pod názvem (stejný název přepíše dřívější verzi).
- **🗂️ Verze konceptu** — seznam uložených verzí; u každé **Načíst** (nahraje verzi
  zpět do pracovního konceptu — publikaci neprovede, tu pak potvrdíte **Zveřejnit**),
  **Přejmenovat**, **Smazat**.

Verze jsou jen pomůcka v konzoli — na web se nikdy samy nedostanou (zveřejní se
vždy jen aktuální koncept přes **Zveřejnit**). Na položku lze uložit max. 20 verzí.

## 1. Kde to najdu

1. Přihlaste se do admin konzole (`/admin`) přes Cloudflare Access.
2. V levém menu klikněte na **„Obsah webu“**.
3. Nahoře jsou záložky: **Stránky** (texty + karty homepage), **Služby** (programy),
   **FAQ** (sdílené otázky na landing stránkách), **Footer & Kontakt** (NAP),
   **SEO** (titulky a popisy stránek pro Google/sdílení), **Landing** (texty stránek lokalit),
   **Galerie**, **Mediatéka**, **Hero bannery**, **Historie změn**.

> **Služby:** záložka Služby = tabulka programů; „Upravit" otevře editor (název, popisy,
> cena, ikona, viditelnost) s konceptem. Změny se promítnou do průvodce, rezervačního
> formuláře i do programů na landing stránkách.
>
> **FAQ / Landing / SEO** jsou sdílené přes všechny lokality: jedna úprava FAQ nebo
> služby se projeví na všech 5 landing stránkách. SEO (titulek, popis, náhledový obrázek)
> se nastavuje zvlášť pro každou stránku.

---

## 2. Texty

Každý editovatelný text má svůj **klíč** (např. `homepage-galerie-intro`) — ten určuje,
kam na webu text patří. Klíče nemažte ani neměňte, pokud nevíte, kam patří.

- **Úprava:** přepište *Nadpis* nebo *Obsah* a klikněte **💾 Uložit**.
- **Formátování:** v obsahu lze používat jednoduché HTML značky — odstavce `<p>`,
  tučné `<strong>`, kurzíva `<em>`, nadpisy `<h2>`, seznamy `<ul><li>`, odkazy `<a href="…">`.
  Vše ostatní (zejména skripty) se z bezpečnostních důvodů automaticky odstraní.
- **Nová sekce:** tlačítko **➕ Nová sekce** → zadejte klíč (malá písmena, číslice, pomlčky).
  Aby se nová sekce na webu zobrazila, musí ji vývojář napojit na konkrétní místo (viz technická část).
- **Smazání:** **🗑️ Smazat** (s potvrzením).

---

## 3. Galerie (koncept → zveřejnit)

Fotky jsou seskupené do **galerií** podle klíče (např. `ordinace`).

- **Otevření:** vyberte galerii v rozbalovači, nebo napište klíč nové galerie a dejte **Otevřít**.
- **Nahrání:** klikněte na pole *Nahrát obrázek* a vyberte jeden či více souborů.
  - Povolené formáty: **JPEG, PNG, WebP, GIF**, max **5 MB** na soubor.
- **Popisek/pořadí/smazání:** změny ukládají **koncept galerie** (na webu se zatím nic nezmění).
- **✅ Zveřejnit:** propíše aktuální koncept galerie na web.
- **↩︎ Zahodit koncept:** vrátí galerii na právě zveřejněný stav (včetně zahození nově nahraných obrázků v konceptu).
- V náhledu lze použít **🧩 Visual Builder** a kliknout přímo na galerii na stránce.

---

## 4. Mediatéka

Záložka **Mediatéka** je centrální přehled assetů používaných v galeriích a hero workflow:

- Ukazuje náhled assetu, galerii, URL, typ souboru a stav **Live/Koncept**.
- URL lze zkopírovat pro použití v SEO nebo hero poli.
- Tlačítko **Otevřít galerii** vás přesune do bezpečného konceptového workflow galerie.
- Video je v UI připravené jako typ assetu, ale produkční streamování/výběr technologie se řeší zvlášť.

Mediatéka sama nic nemaže ani nepublikuje; je to bezpečný přehled nad existujícími R2/galerijními assety.

---

## 5. Hero bannery

Hero = velký úvodní pruh stránky (nadpis, podnadpis, tlačítko, obrázek pozadí).

- Vyberte stránku (např. `homepage`), nebo přidejte novou přes **➕ Nová stránka…**.
- Vyplňte *Hlavní nadpis*, *Podnadpis*, *Text tlačítka*, *Odkaz tlačítka*.
- *Obrázek pozadí:* buď vložte cestu ručně, nebo nahrajte soubor (uloží se do galerie `hero`).
- **💾 Uložit hero**.

---

## 6. Historie změn

Záložka **Historie změn** ukazuje, **kdo**, **kdy** a **co** změnil (texty, galerie, hero).
Slouží pro přehled a dohledatelnost — nic se odsud needituje.

---

## 7. Když se něco pokazí

- **Web ukazuje starý obsah:** počkejte ~1 minutu (cache), pak obnovte stránku (Ctrl/Cmd+R).
- **Fotka se nenahrála:** zkontrolujte formát a velikost (max 5 MB). Při mnoha uploadech za sebou
  systém krátce přibrzdí (limit 10/min) — chvíli počkejte.
- **Smazal/a jsem omylem text:** texty i fotky lze vytvořit znovu; změny jsou dohledatelné v Historii.
  Strukturální obnovu (např. hromadný návrat) řeší vývojář ze zálohy DB.

---

## 7. Technická část (pro vývojáře po předání)

**Architektura (skutečný stack — Cloudflare Pages Functions, ne Vue):**

| Vrstva | Soubor(y) |
|---|---|
| DB migrace | `db/migrations/0016_cms_gallery_hero.sql`, `db/migrations/0029_gallery_drafts.sql` (+ `db/schema.sql`) |
| Texty (admin) | `functions/admin/content.js` → `/admin/content` |
| Galerie (admin) | `functions/admin/gallery.js` → `/admin/gallery` (upload do R2 `MEDIA`) |
| Hero (admin) | `functions/admin/hero.js` → `/admin/hero` |
| Veřejné API | `functions/api/content.js`, `functions/api/gallery.js`, `functions/api/hero.js` |
| Servírování médií | `functions/api/media/[[path]].js` → `/api/media/<klíč v R2>` |
| Sdílené utility | `functions/lib/sanitize.js`, `functions/lib/cms.js` |
| Admin UI (vanilla) | `public/admin/js/modules/content.js` (+ route v `router.js`, metody v `api.js`) |
| Web klient | `public/assets/js/cms-client.js` |

**Datový model:** texty využívají existující tabulku `content_blocks`, audit jde do existující
`audit_log`. Galerie mají živá data v `gallery_items` a pracovní koncept v `gallery_drafts`;
hero bannery v `hero_config`.

**Bindingy (`wrangler.toml`):** D1 = `DB`, R2 = `MEDIA`, KV = `CACHE`.

**Autentizace:** admin endpointy chrání `functions/admin/_middleware.js` (Cloudflare Access JWT →
`data.operator`). Veřejné `/api/*` jsou bez auth a cachované (KV: texty 60 s, galerie/hero 5 min).

**Jak napojit nový text/galerii/hero na stránku** (progressive enhancement, fallback zůstává v HTML):

```html
<!-- text -->
<div data-cms-section="muj-klic"><p>Fallback text…</p></div>

<!-- galerie -->
<div class="gallery-grid" data-cms-gallery="ordinace"><!-- fallback fotky --></div>

<!-- hero -->
<section data-cms-hero="homepage">
  <h1 data-cms-hero-field="headline">Fallback nadpis</h1>
  <p  data-cms-hero-field="subheadline">Fallback podnadpis</p>
  <a  data-cms-hero-field="cta_link" class="btn">Tlačítko</a>
</section>
```

A na stránce načíst klienta: `<script src="/assets/js/cms-client.js" defer></script>`.

**Migrace na produkci:**
```bash
wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0016_cms_gallery_hero.sql
wrangler d1 execute bicom-pisek-db --remote --file=db/migrations/0029_gallery_drafts.sql
```

---

*Verze 1.0 · F11 · Stack: Cloudflare Pages Functions + vanilla ES6 SPA*
