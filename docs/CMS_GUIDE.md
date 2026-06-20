# 📝 CMS — Editace obsahu webu (návod pro provozovatelky)

> **Co to umí:** Měnit texty, fotky a hlavní bannery webu **přímo z admin konzole**
> (virtuální kanceláře) — bez programátora a bez nasazování. Změny se na webu
> projeví do ~1 minuty (cache).

---

## 0. Workflow: koncept → náhled → zveřejnit (F12)

Úpravy textů, kontaktu/patičky a hero bannerů se **neukládají rovnou na web**.
Fungují jako **koncept**:

1. Upravíte text a dáte **💾 Uložit koncept** — uloží se, ale na webu se zatím nic nezmění.
2. V **náhledu vpravo** (klikněte na ↻ Obnovit) vidíte, jak změna bude vypadat.
3. Když jste spokojeni, dáte **✅ Zveřejnit** — teprve teď se změna objeví na webu (do ~1 min).
4. Nebo **↩︎ Zahodit koncept** — koncept se zruší a zůstane původní zveřejněná verze.

Galerie se publikují okamžitě (bez konceptu).

## 1. Kde to najdu

1. Přihlaste se do admin konzole (`/admin`) přes Cloudflare Access.
2. V levém menu klikněte na **„Obsah webu“**.
3. Nahoře jsou záložky: **Stránky** (texty homepage), **Footer & Kontakt** (NAP),
   **Galerie**, **Hero bannery**, **Historie změn**.

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

## 3. Galerie

Fotky jsou seskupené do **galerií** podle klíče (např. `ordinace`).

- **Otevření:** vyberte galerii v rozbalovači, nebo napište klíč nové galerie a dejte **Otevřít**.
- **Nahrání:** klikněte na pole *Nahrát obrázek* a vyberte jeden či více souborů.
  - Povolené formáty: **JPEG, PNG, WebP, GIF**, max **5 MB** na soubor.
- **Popisek:** u každé fotky vyplňte *Popisek* (slouží i jako alternativní text pro přístupnost) a dejte **💾**.
- **Pořadí:** šipkami **↑ / ↓** posouváte fotku v pořadí (tak se zobrazí i na webu).
- **Smazání:** **🗑️** odstraní fotku z webu i z úložiště.

---

## 4. Hero bannery

Hero = velký úvodní pruh stránky (nadpis, podnadpis, tlačítko, obrázek pozadí).

- Vyberte stránku (např. `homepage`), nebo přidejte novou přes **➕ Nová stránka…**.
- Vyplňte *Hlavní nadpis*, *Podnadpis*, *Text tlačítka*, *Odkaz tlačítka*.
- *Obrázek pozadí:* buď vložte cestu ručně, nebo nahrajte soubor (uloží se do galerie `hero`).
- **💾 Uložit hero**.

---

## 5. Historie změn

Záložka **Historie změn** ukazuje, **kdo**, **kdy** a **co** změnil (texty, galerie, hero).
Slouží pro přehled a dohledatelnost — nic se odsud needituje.

---

## 6. Když se něco pokazí

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
| DB migrace | `db/migrations/0016_cms_gallery_hero.sql` (+ `db/schema.sql`) |
| Texty (admin) | `functions/admin/content.js` → `/admin/content` |
| Galerie (admin) | `functions/admin/gallery.js` → `/admin/gallery` (upload do R2 `MEDIA`) |
| Hero (admin) | `functions/admin/hero.js` → `/admin/hero` |
| Veřejné API | `functions/api/content.js`, `functions/api/gallery.js`, `functions/api/hero.js` |
| Servírování médií | `functions/api/media/[[path]].js` → `/api/media/<klíč v R2>` |
| Sdílené utility | `functions/lib/sanitize.js`, `functions/lib/cms.js` |
| Admin UI (vanilla) | `public/admin/js/modules/content.js` (+ route v `router.js`, metody v `api.js`) |
| Web klient | `public/assets/js/cms-client.js` |

**Datový model:** texty využívají existující tabulku `content_blocks`, audit jde do existující
`audit_log`. Nově jen `gallery_items` a `hero_config` (migrace 0016).

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
```

---

*Verze 1.0 · F11 · Stack: Cloudflare Pages Functions + vanilla ES6 SPA*
