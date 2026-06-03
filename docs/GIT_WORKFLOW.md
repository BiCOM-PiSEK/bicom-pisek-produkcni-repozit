# Git Workflow & Synchronizace (Fork ↔ Upstream)

Tento dokument definuje závazná pravidla pro práci s Git repozitáři, větvení a synchronizaci kódu v projektu **Bicom Písek**. Standard MEVERIK STUDIO 2026.

---

## 1. Architektura repozitářů

V projektu pracujeme se dvěma vzdálenými repozitáři (remotes):

1.  **Upstream (Hlavní repozitář organizace):**
    *   **URL:** `https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git`
    *   **Účel:** Hlavní zdroj pravdy (Source of Truth) pro produkční nasazení. Z větve `main` tohoto repozitáře se provádí automatický deploy na Cloudflare Pages. Ten obsluhuje obě produkční domény: kanonickou **`bicom-pisek.cz`** (resp. s www) i výchozí doménu **`bicom-pisek.pages.dev`**. Obě tyto domény jsou produkční a chráněné pomocí Cloudflare Access (vyžadují přihlášení).
2.  **Origin (Osobní fork vývojáře):**
    *   **URL:** `https://github.com/MEVERIK-SOLUTION/bicom-pisek-produkcni-repozit.git`
    *   **Účel:** Vývojové a testovací prostředí pro jednotlivé vývojáře. Zde se provádí větvení a lokální testování. Větve se odsud posílají formou Pull Requestů do upstream repozitáře.

### 1.1 Cloudflare deploy: Production vs Preview

Nasazování celého projektu probíhá na Cloudflare Pages a dělí se na dva režimy:

1.  **PRODUCTION (Produkční režim):**
    *   **Větev:** `main` (automatické nasazení po sloučení Pull Requestu do upstreamu).
    *   **Zdroj:** Hlavní repozitář organizace (`BiCOM-PiSEK/bicom-pisek-produkcni-repozit`).
    *   **Nastavení:** `Automatic deployments = Enabled`, `Build output directory = public`, `Build system = v3`.
    *   **Cílové domény:** Obsluhuje obě produkční domény — kanonickou `bicom-pisek.cz` (s www) i výchozí `bicom-pisek.pages.dev`. Obě tyto domény jsou živé a chráněné pomocí Cloudflare Access.
2.  **PREVIEW (Staging / Testovací režim):**
    *   **Větve:** Všechny ne-produkční větve a otevřené Pull Requesty (`Preview branch = All non-production branches`).
    *   **Zdroj:** Automaticky z jakékoliv větve/PR nasměrované do upstreamu.
    *   **Účel:** Každá nová větev a každý Pull Request automaticky získá unikátní preview URL (např. `https://<hash>.<projekt>.pages.dev`). Toto prostředí slouží jako bezplatný staging pro testování frontendu a funkcí před sloučením do produkce.

---

## 2. Nastavení lokálního prostředí

Pro správnou funkčnost musíte mít v lokálním repozitáři správně nakonfigurované oba remotes. Zkontrolujte je příkazem `git remote -v`. Pokud chybí `upstream`, přidejte ho:

```bash
# Přidání upstream repozitáře organizace
git remote add upstream https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git

# Stažení aktuálního stavu ze všech remotes
git fetch --all
```

---

## 3. Životní cyklus úkolu (Branching Model)

Vývoj každé funkce či opravy se řídí striktním postupem od lokální větve až po nasazení:

```
 [1. Vývoj]                   [2. Kontrola & Test]                [3. Produkce]
 Lokální větev               Fork (origin)                       Organizace (upstream/main)
 ─────────────               ─────────────                       ──────────────────────────
 agent/ag-w2-XX  ──push──▶   MEVERIK-SOLUTION                    BiCOM-PiSEK
                             └── PR do upstream/main             ├── Automatický build (Pages)
                                                                 └── Ostrý start (Pages prod)
```

### Krok 1: Lokální vývoj
Všechny úpravy se provádějí ve vyhrazených větvích pojmenovaných podle formátu:
`agent/ag-w{vlna}-{id}-{kratky-popis}` (např. `agent/ag-w2-05-asset-strategy`).

Větev se zakládá z aktuální verze `upstream/main`:
```bash
git fetch upstream
git checkout -b agent/ag-w2-05-asset-strategy upstream/main
```

### Krok 2: Push na osobní fork (Origin)
Po dokončení práce a lokálním otestování se změny odešlou na Váš osobní fork:
```bash
git push origin agent/ag-w2-05-asset-strategy
```

### Krok 3: Pull Request do Upstreamu
1. Přejděte na GitHub do hlavního repozitáře `BiCOM-PiSEK/bicom-pisek-produkcni-repozit`.
2. Otevřete Pull Request ze své větve `agent/ag-w2-05-asset-strategy` (nacházející se na vašem forku `origin`) do větve `main` hlavního repozitáře `upstream`.
3. Cloudflare Pages automaticky generuje náhledy pro jednotlivé PR (Preview Deployments), kde lze změny bezpečně zkontrolovat ještě před sloučením do produkce.

### Krok 4: Synchronizace a nasazení na produkci
1. Jakmile je Pull Request schválen a sloučen (merged) do větve `main` v `upstream`, spustí se produkční deployment na Cloudflare Pages.
2. Změny se okamžitě projeví na chráněných produkčních doménách `bicom-pisek.cz` i `bicom-pisek.pages.dev`.

#### **Záložní metoda (Přes příkazovou řádku):**
Pokud je potřeba provést rychlou synchronizaci přímo z terminálu bez Pull Requestu (pouze pro administrátora s přímým přístupem do upstreamu):
```bash
# 1. Přepněte se na lokální větev main
git checkout main

# 2. Stáhněte nejnovější změny z Vašeho forku
git pull origin main

# 3. Zatlačte změny přímo do produkčního repozitáře organizace
git push upstream main
```

---

## 4. Řešení konfliktů při squash-merge
Pokud je PR do upstreamu sloučeno metodou **Squash and Merge**, historie na `upstream/main` se přepíše do jediného commitu. To může způsobit, že vaše lokální větve vytvořené před sloučením budou vykazovat fiktivní konflikty.

**Jak to vyřešit bezpečně:**
```bash
# 1. Aktualizujte lokální obraz upstreamu
git fetch upstream

# 2. Přepněte se na svou rozdělanou větev
git checkout agent/ag-w2-05-asset-strategy

# 3. Resetujte větev na nejnovější stav upstreamu
git reset --hard upstream/main

# 4. Aplikujte pouze své nové lokální commity (cherry-pick)
git cherry-pick <SHA-vašeho-nového-commitu>

# 5. Vynunuťte push na svůj fork (origin)
git push origin agent/ag-w2-05-asset-strategy --force
```
PR na GitHubu se automaticky aktualizuje a bude opět bez konfliktů připraveno ke sloučení.
