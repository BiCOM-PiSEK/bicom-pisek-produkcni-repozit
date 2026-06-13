# WORK-DIARY

## 2026-06-13 (pátek) — F1 B-fáze: Migrace 0012 na produkci

**Branch:** `feat/booking-f1-schema`

**Cíl:** Spustit migraci 0012_booking_system.sql na produkční D1, přidat deprecated komentář ke calendar_slots.

### ✅ Hotovo:

1. **Deprecated komentář (schema.sql)**
   - Přidán DEPRECATED tag ke calendar_slots ve schema.sql
   - Commit: `e2a34d8` — "docs(schema): mark calendar_slots as deprecated (ADR-004 Cesta 2)"

2. **Backup produkční DB**
   - Export: `backups/pre-0012-booking-20260613.sql` (49 KB)
   - Timestamp: 2026-06-13 19:14 UTC

3. **Stav PŘED migrací (read-only)**
   - Tabulky `availability_rules`, `availability_exceptions`, `booking_settings` neexistovaly ✓
   - Query: `SELECT name FROM sqlite_master WHERE type='table' AND name IN (...)` → 0 řádků

4. **Aplikace migrace 0012**
   - `wrangler d1 migrations apply bicom-pisek-db --remote` → **✅ 0012_booking_system.sql**
   - Runtime: 1.48 ms (10 SQL příkazů v jedné transakci)

5. **Ověření PO migraci:**

   **a) bookings tabulka — nové sloupce:**
   ```
   cid 23: slot_start (TEXT, nullable)
   cid 24: slot_end   (TEXT, nullable)
   ```
   
   **b) booking_settings (1 řádek, seed):**
   ```
   id: 1
   slot_duration_min: 60
   slot_gap_min: 10
   min_lead_hours: 24
   max_horizon_days: 60
   require_confirmation: 1
   require_deposit: 0
   deposit_amount: null
   ```
   
   **c) availability_rules (5 řádků, seed — pondělí-pátek 09:00-17:00):**
   ```
   weekday 1: 09:00–17:00
   weekday 2: 09:00–17:00
   weekday 3: 09:00–17:00
   weekday 4: 09:00–17:00
   weekday 5: 09:00–17:00
   ```
   
   **d) availability_exceptions (0 řádků):**
   ```
   exc_count: 0 (prázdná, připravena pro budoucí svátky/dovolenou)
   ```

6. **Architektura potvrzena:**
   - Cesta 2: sloty se počítají za běhu z `availability_rules` + `bookings.slot_start`
   - `calendar_slots` zůstává jako legacy (deprecated, NEMAŽ, nekliduj)
   - F1 schéma bez změn obsahu, všechny seed hodnoty validní

---

### 📌 Poznámky:

- Migrace proběhla bez chyb, bez varování o neúplných staršších migrací
- DB velikost po migraci: 274 KB (zvýšeno z 245 KB o 29 KB na nové tabulky + indexy)
- Ověření obsahu proběhlo 100% — všechny sloupce, seed data a indexy OK
- calendar_slots deprecated komentář je nyní v schématu pro budoucí vývojáře

---

### ⏳ Příští krok:

- Merge PR #45 (feat/booking-f1-schema) potvrzuji AŽ POTÉ, co si to ověříš
- F2 (slot-picking API) začne na nové větvi `feat/booking-f2-api`

---

**Status:** ✅ HOTOVO — F1 B-fáze produkce completní
