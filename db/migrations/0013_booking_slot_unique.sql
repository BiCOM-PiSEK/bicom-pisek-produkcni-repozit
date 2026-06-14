-- Migration 0013: Parciální UNIQUE index na slot_start
-- Zajistí, že aktívní rezervace kolidují jen jednou
-- (hotové/zrušené rezervace slot uvolnit).

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_slot_unique
ON bookings(slot_start)
WHERE slot_start IS NOT NULL
  AND status IN ('pending','confirmed','pending_payment');
