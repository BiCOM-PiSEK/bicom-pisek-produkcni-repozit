# ADR-004 — Rezervační systém s výběrem konkrétního času

## Status
APPROVED (E2E ověřeno na Round 1-8)

## Context
Bicom Písek potřebuje rezervační systém, který umožní klientům:
1. Vybrat si konkrétní čas slotu (nikoliv jen den)
2. Vidět dostupnost v reálném čase
3. Potvrzovat nebo rušit rezervace v administraci
4. Automaticky oznamovat statusem změny (email, SMS, Telegram)

## Decision
Implementujeme 3-fázový rezervační systém:
- **F1 (Schéma):** Tabulky, sloupce, seed data (nyní)
- **F2 (API+Admin):** Slot-picking API, admin UI
- **F3 (Frontend):** Klientský time-picker

## Implementation Details

### F1: Datový základ
- Tabulka `availability_rules` — pravidelná otevírací doba (po-pá 9-17)
- Tabulka `availability_exceptions` — svátky, dovolená, ad-hoc změny
- Tabulka `booking_settings` — konfigurace (slot délka, min. oznámení, atd.)
- Nové sloupce `bookings.slot_start` a `bookings.slot_end` — přesný čas

## Constraints & Notes
- Sloty jsou 60 minut (default) s 10min mezerou
- Minimální oznámení: 24 hodin dopředu
- Horizont otevírání: 60 dní
- Potvrzení povinné, zálohová konfigurace volitelná
