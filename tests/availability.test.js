import { describe, it, expect } from 'vitest';
import { computeAvailability } from '../functions/api/availability.js';

describe('Availability Engine — Slot Generation & Collision Avoidance', () => {
  const settings = {
    slot_duration_min: 60,
    slot_gap_min: 10,
    min_lead_hours: 24,
    max_horizon_days: 30,
  };

  // Mock standard Monday-Friday 9:00 - 12:00 availability rules (2 slots: 9:00-10:00, 10:10-11:10)
  const rules = [
    { weekday: 1, start_time: '09:00', end_time: '12:00' }, // Monday
  ];

  it('should generate free slots for a working day based on weekday rules', () => {
    const now = new Date(2026, 5, 21, 9, 0, 0); // Sunday June 21, 2026
    const from = '2026-06-22'; // Monday
    const to = '2026-06-22';

    const result = computeAvailability({
      rules,
      exceptions: [],
      settings,
      busySlots: [],
      from,
      to,
      now,
    });

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-06-22');
    expect(result[0].slots).toHaveLength(2);
    expect(result[0].slots[0]).toEqual({ start: '2026-06-22 09:00', end: '2026-06-22 10:00' });
    expect(result[0].slots[1]).toEqual({ start: '2026-06-22 10:10', end: '2026-06-22 11:10' });
  });

  it('should respect min_lead_hours and filter out early slots', () => {
    const now = new Date(2026, 5, 22, 10, 0, 0); // Monday June 22, 2026 10:00 AM
    const from = '2026-06-22';
    const to = '2026-06-23'; // Tuesday

    // Monday slots (June 22) should be filtered out because they are in the past or under 24h lead.
    // Tuesday (June 23) has rules? No, Tuesday has no rules in our mock `rules` array (only Monday 1).
    // Let's add Tuesday to rules.
    const rulesWithTuesday = [
      { weekday: 1, start_time: '09:00', end_time: '12:00' }, // Monday
      { weekday: 2, start_time: '09:00', end_time: '12:00' }, // Tuesday
    ];

    const result = computeAvailability({
      rules: rulesWithTuesday,
      exceptions: [],
      settings,
      busySlots: [],
      from,
      to,
      now,
    });

    // Monday (June 22) is filtered because lead time (now + 24h = Tuesday 10:00 AM).
    // Tuesday 9:00-10:00 is also before 10:00 AM. Only 10:10-11:10 should remain.
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-06-23'); // Tuesday
    expect(result[0].slots).toHaveLength(1);
    expect(result[0].slots[0].start).toBe('2026-06-23 10:10');
  });

  it('should skip days completely on vacation/holiday exceptions', () => {
    const now = new Date(2026, 5, 21, 9, 0, 0); // Sunday
    const from = '2026-06-22'; // Monday
    const to = '2026-06-22';
    const exceptions = [
      { date: '2026-06-22', type: 'holiday' }, // Full day holiday
    ];

    const result = computeAvailability({
      rules,
      exceptions,
      settings,
      busySlots: [],
      from,
      to,
      now,
    });

    expect(result).toHaveLength(0); // Monday skipped
  });

  it('should skip busy/booked slots to prevent collisions', () => {
    const now = new Date(2026, 5, 21, 9, 0, 0); // Sunday
    const from = '2026-06-22';
    const to = '2026-06-22';
    const busySlots = ['2026-06-22 09:00']; // Booked first slot

    const result = computeAvailability({
      rules,
      exceptions: [],
      settings,
      busySlots,
      from,
      to,
      now,
    });

    expect(result).toHaveLength(1);
    expect(result[0].slots).toHaveLength(1);
    expect(result[0].slots[0].start).toBe('2026-06-22 10:10'); // Only second slot remains
  });

  it('should support adhoc exceptions and block matching slots', () => {
    const now = new Date(2026, 5, 21, 9, 0, 0); // Sunday
    const from = '2026-06-22';
    const to = '2026-06-22';
    const exceptions = [
      { date: '2026-06-22', type: 'adhoc', start_time: '08:00', end_time: '09:30' }, // Overlaps first slot (09:00 - 10:00)
    ];

    const result = computeAvailability({
      rules,
      exceptions,
      settings,
      busySlots: [],
      from,
      to,
      now,
    });

    expect(result).toHaveLength(1);
    expect(result[0].slots).toHaveLength(1);
    expect(result[0].slots[0].start).toBe('2026-06-22 10:10'); // First slot was blocked by overlap
  });
});
