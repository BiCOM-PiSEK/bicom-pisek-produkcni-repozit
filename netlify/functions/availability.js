// GET /api/availability — Netlify Function
// Generátor volných slotů za běhu ze Supabase.
// Počítá dostupnost z availability_rules + exceptions, odečítá obsazené z bookings.

import { getSupabaseAdmin } from '../lib/supabase.js';
import {
  parseLocalDate,
  getNowInPrague,
  formatTime,
  formatDate,
  formatDateTime,
  addMinutes,
  addDays,
} from '../lib/time.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Core availability computation logic.
 */
export function computeAvailability({ rules, exceptions, settings, busySlots, from, to, now }) {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);

  const rulesByWeekday = {};
  rules.forEach((rule) => {
    if (!rulesByWeekday[rule.weekday]) {
      rulesByWeekday[rule.weekday] = [];
    }
    rulesByWeekday[rule.weekday].push({
      start_time: rule.start_time,
      end_time: rule.end_time,
    });
  });

  const exceptionsByDate = {};
  exceptions.forEach((exc) => {
    if (!exceptionsByDate[exc.date]) {
      exceptionsByDate[exc.date] = [];
    }
    exceptionsByDate[exc.date].push(exc);
  });

  const busySet = new Set(busySlots);
  const slotDuration = settings.slot_duration_min;
  const slotGap = settings.slot_gap_min;
  const slotStep = slotDuration + slotGap;
  const minLeadHours = settings.min_lead_hours;
  const minAllowedDateTime = addMinutes(now, minLeadHours * 60);

  const result = [];
  let current = new Date(fromDate.getTime());

  while (current <= toDate) {
    const dateStr = formatDate(current);
    const dayOfWeek = current.getDay();
    const dayExceptions = exceptionsByDate[dateStr] || [];

    const isFullDayOff = dayExceptions.some(
      (e) => (e.type === 'holiday' || e.type === 'vacation') && !e.start_time
    );

    if (isFullDayOff) {
      result.push({ date: dateStr, weekday: dayOfWeek, slots: [] });
      current = addDays(current, 1);
      continue;
    }

    let windows = [];
    const dayRules = rulesByWeekday[dayOfWeek] || [];
    dayRules.forEach((r) => windows.push({ start: r.start_time, end: r.end_time }));

    dayExceptions
      .filter((e) => e.type === 'extra' && e.start_time && e.end_time)
      .forEach((e) => windows.push({ start: e.start_time, end: e.end_time }));

    const slots = [];

    windows.forEach((win) => {
      const [startH, startM] = win.start.split(':').map(Number);
      const [endH, endM] = win.end.split(':').map(Number);

      let slotStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), startH, startM, 0, 0);
      const windowEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), endH, endM, 0, 0);

      while (true) {
        const slotEnd = addMinutes(slotStart, slotDuration);
        if (slotEnd > windowEnd) break;

        const slotStartStr = formatDateTime(slotStart);
        const slotEndStr = formatDateTime(slotEnd);
        const timeOnlyStr = formatTime(slotStart);

        let isBlockedByException = false;
        dayExceptions
          .filter((e) => (e.type === 'holiday' || e.type === 'vacation' || e.type === 'adhoc') && e.start_time && e.end_time)
          .forEach((e) => {
            const [exStartH, exStartM] = e.start_time.split(':').map(Number);
            const [exEndH, exEndM] = e.end_time.split(':').map(Number);
            const exStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), exStartH, exStartM, 0, 0);
            const exEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), exEndH, exEndM, 0, 0);

            if (slotStart < exEnd && slotEnd > exStart) {
              isBlockedByException = true;
            }
          });

        const isBusy = busySet.has(slotStartStr);
        const isPastMinLead = slotStart >= minAllowedDateTime;
        const available = !isBusy && !isBlockedByException && isPastMinLead;

        slots.push({
          time: timeOnlyStr,
          slot_start: slotStartStr,
          slot_end: slotEndStr,
          available,
        });

        slotStart = addMinutes(slotStart, slotStep);
      }
    });

    slots.sort((a, b) => a.time.localeCompare(b.time));
    result.push({ date: dateStr, weekday: dayOfWeek, slots });

    current = addDays(current, 1);
  }

  return result;
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const requestNowPrague = getNowInPrague();

    if (!from || !DATE_REGEX.test(from) || !to || !DATE_REGEX.test(to)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametry "from" a "to" jsou povinné (YYYY-MM-DD).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);

    if (fromDate > toDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametr "from" musí být menší nebo roven "to".' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const supabase = getSupabaseAdmin();

    // 1. Nastavení
    const { data: settingsRow } = await supabase
      .from('booking_settings')
      .select('slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days')
      .eq('id', 1)
      .maybeSingle();

    const settings = {
      slot_duration_min: settingsRow?.slot_duration_min ?? 60,
      slot_gap_min: settingsRow?.slot_gap_min ?? 10,
      min_lead_hours: settingsRow?.min_lead_hours ?? 24,
      max_horizon_days: settingsRow?.max_horizon_days ?? 60,
    };

    const todayPrague = new Date(requestNowPrague.getFullYear(), requestNowPrague.getMonth(), requestNowPrague.getDate());
    const maxDate = addDays(todayPrague, settings.max_horizon_days);
    const constrainedToDate = toDate > maxDate ? maxDate : toDate;

    // 2. Pravidla, výjimky, obsazené sloty
    const [rulesRes, exceptionsRes, bookedRes] = await Promise.all([
      supabase.from('availability_rules').select('weekday, start_time, end_time').eq('active', 1),
      supabase.from('availability_exceptions').select('date, start_time, end_time, type').gte('date', from).lte('date', formatDate(constrainedToDate)),
      supabase.from('bookings').select('slot_start').not('slot_start', 'is', null).in('status', ['pending', 'confirmed', 'pending_payment']).gte('slot_start', `${from} 00:00`).lte('slot_start', `${formatDate(constrainedToDate)} 23:59`),
    ]);

    const rules = rulesRes.data || [];
    const exceptions = exceptionsRes.data || [];
    const busySlots = (bookedRes.data || []).map((r) => r.slot_start);

    // 3. Výpočet
    const days = computeAvailability({
      rules,
      exceptions,
      settings,
      busySlots,
      from,
      to: formatDate(constrainedToDate),
      now: requestNowPrague,
    });

    return new Response(
      JSON.stringify({
        success: true,
        days,
        meta: {
          slot_duration_min: settings.slot_duration_min,
          slot_gap_min: settings.slot_gap_min,
          min_lead_hours: settings.min_lead_hours,
          max_horizon_days: settings.max_horizon_days,
          timezone: 'Europe/Prague',
          from,
          to: formatDate(constrainedToDate),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[api/availability] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/availability',
};
