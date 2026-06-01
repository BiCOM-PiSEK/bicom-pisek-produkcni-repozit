# Git Workflow & Synchronizace (Fork ↔ Upstream)

Tento dokument definuje závazná pravidla pro práci s Git repozitáři, větvení a synchronizaci kódu v projektu **Bicom Písek**. Standard MEVERIK STUDIO 2026.

---

## 1. Architektura repozitářů

V projektu pracujeme se dvěma vzdálenými repozitáři (remotes):

1.  **Upstream (Hlavní repozitář organizace):**
    *   **URL:** `https://github.com/BiCOM-PiSEK/bicom-pisek-produkcni-repozit.git`
    *   **Účel:** Hlavní zdroj pravdy (Source of Truth) pro produkční nasazení. Z větve `main` tohoto repozitáře se provádí ostrý deploy na produkční doménu `bicom-pisek.cz` (resp. `bicompisek.cz`).
2.  **Origin (Osobní fork vývojáře):**
    *   **URL:** `https://github.com/MEVERIK-SOLUTION/bicom-pisek-produkcni-repozit.git`
    *   **Účel:** Vývojové a testovací prostředí. Zde se provádí větvení a testování. Větev `main` tohoto forku je propojena s Cloudflare Pages pro automatický preview build na adrese `https://bicom-pisek.pages.dev/`.

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
 Lokální větev               Fork (origin/main)                  Organizace (upstream/main)
 ─────────────               ──────────────────                  ──────────────────────────
 agent/ag-w2-XX  ──push──▶   MEVERIK-SOLUTION                    BiCOM-PiSEK
                             ├── PR na main                      └── PR z forku do main
                             └── Live Preview (Pages dev)        └── Ostrý start (Pages prod)
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

### Krok 3: Pull Request a testování v preview (Origin/main)
1. Přejděte na GitHub do svého forku `MEVERIK-SOLUTION/bicom-pisek-produkcni-repozit`.
2. Otevřete Pull Request z vaší větve `agent/ag-w2-05-asset-strategy` do **své** větve `main`.
3. Sloučením (merge) tohoto PR se spustí automatický build na Cloudflare Pages, který nasadí kód na testovací doménu `https://bicom-pisek.pages.dev/`.
4. Proveďte vizuální a funkční kontrolu na testovacím webu.

### Krok 4: Synchronizace a nasazení na produkci (Upstream/main)
Jakmile jsou změny otestovány a schváleny, synchronizují se do hlavního repozitáře organizace.

#### **Primární metoda (Přes GitHub Pull Request - Doporučeno):**
1. Otevřete Pull Request na GitHubu z větve `main` (nebo přímo z vaší agent větve) Vašeho osobního forku `MEVERIK-SOLUTION` do větve `main` repozitáře organizace `BiCOM-PiSEK`.
2. Schválením a sloučením tohoto PR se automaticky spustí produkční nasazení na ostrou doménu.

#### **Záložní metoda (Přes příkazovou řádku):**
Pokud je potřeba provést rychlou synchronizaci přímo z terminálu:
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
