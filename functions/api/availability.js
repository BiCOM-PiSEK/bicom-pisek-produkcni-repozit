// GET /api/availability
// Generátor volných slotů za běhu (ADR-004 Cesta 2).
// Počítá dostupnost z availability_rules + exceptions, odečítá obsazené z bookings.
// Čas v LOKÁLNÍM formátu Praha (string "YYYY-MM-DD HH:MM"), NE UTC.

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Parse YYYY-MM-DD into local Prague date (midnight).
 */
export function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get current time in Prague timezone.
 */
export function getNowInPrague() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach(({ type, value }) => {
    dateObj[type] = value;
  });
  const year = parseInt(dateObj.year, 10);
  const month = parseInt(dateObj.month, 10) - 1;
  const day = parseInt(dateObj.day, 10);
  const hour = parseInt(dateObj.hour, 10);
  const minute = parseInt(dateObj.minute, 10);
  return new Date(year, month, day, hour, minute, 0, 0);
}

/**
 * Format time as "HH:MM".
 */
export function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format date as "YYYY-MM-DD".
 */
export function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * Format datetime as "YYYY-MM-DD HH:MM".
 */
export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Add minutes to a date.
 */
export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Add days to a date (in local context).
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Core availability computation logic (testable, no DB).
 * @param {Object} params - { rules, exceptions, settings, busySlots, from, to, now }
 * @returns {Array} days with slots
 */
export function computeAvailability({ rules, exceptions, settings, busySlots, from, to, now }) {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);

  // Build weekday map
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

  // Build exception map
  const exceptionsByDate = {};
  exceptions.forEach((exc) => {
    const dateKey = formatDate(parseLocalDate(exc.date));
    if (!exceptionsByDate[dateKey]) {
      exceptionsByDate[dateKey] = [];
    }
    exceptionsByDate[dateKey].push({
      start_time: exc.start_time,
      end_time: exc.end_time,
      type: exc.type,
    });
  });

  // Busy slots set
  const bookedSlots = new Set(busySlots);

  // Lead and horizon times
  const minLeadDate = addMinutes(now, settings.min_lead_hours * 60);
  const maxHorizonExclusive = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), settings.max_horizon_days + 1);

  const days = [];
  let currentDate = new Date(fromDate);

  while (currentDate <= toDate) {
    const dateStr = formatDate(currentDate);
    const weekday = currentDate.getDay();

    // Check base availability
    const dayRules = rulesByWeekday[weekday];
    if (!dayRules || dayRules.length === 0) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Apply exceptions
    const dayExceptions = exceptionsByDate[dateStr] || [];
    const dayOffExceptions = dayExceptions.filter((e) => e.type === 'holiday' || e.type === 'vacation');

    if (dayOffExceptions.some((e) => !e.start_time && !e.end_time)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    // Build time ranges
    let timeRanges = [...dayRules];

    // Apply extra additions (before slot generation)
    dayExceptions.filter((e) => e.type === 'extra').forEach((exc) => {
      if (exc.start_time && exc.end_time) {
        timeRanges.push({ start_time: exc.start_time, end_time: exc.end_time });
      }
    });

    // Generate slots
    const slots = [];
    const seenSlotStarts = new Set();
    const adhocExceptions = dayExceptions.filter((e) => e.type === 'adhoc');

    timeRanges.forEach((range) => {
      const [startH, startM] = range.start_time.split(':').map(Number);
      const [endH, endM] = range.end_time.split(':').map(Number);

      let slotStart = new Date(currentDate);
      slotStart.setHours(startH, startM, 0, 0);

      const rangeEnd = new Date(currentDate);
      rangeEnd.setHours(endH, endM, 0, 0);

      while (addMinutes(slotStart, settings.slot_duration_min) <= rangeEnd) {
        const slotEnd = addMinutes(slotStart, settings.slot_duration_min);
        const slotStartStr = formatDateTime(slotStart);
        const slotEndStr = formatDateTime(slotEnd);

        if (slotStart >= minLeadDate && slotStart < maxHorizonExclusive) {
          if (!bookedSlots.has(slotStartStr) && !seenSlotStarts.has(slotStartStr)) {
            // Filter out slots that overlap with adhoc exceptions
            const isBlocked = adhocExceptions.some((exc) => {
              if (!exc.start_time || !exc.end_time) return false;
              const excStart = new Date(currentDate);
              const [excStartH, excStartM] = exc.start_time.split(':').map(Number);
              excStart.setHours(excStartH, excStartM, 0, 0);
              const excEnd = new Date(currentDate);
              const [excEndH, excEndM] = exc.end_time.split(':').map(Number);
              excEnd.setHours(excEndH, excEndM, 0, 0);
              return slotStart < excEnd && slotEnd > excStart;
            });

            if (!isBlocked) {
              seenSlotStarts.add(slotStartStr);
              slots.push({ start: slotStartStr, end: slotEndStr });
            }
          }
        }

        slotStart = addMinutes(slotStart, settings.slot_duration_min + settings.slot_gap_min);
      }
    });

    if (slots.length > 0) {
      days.push({ date: dateStr, weekday, slots });
    }

    currentDate = addDays(currentDate, 1);
  }

  return days;
}

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const requestNowPrague = getNowInPrague();

    if (!from || !DATE_REGEX.test(from)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametr "from" je povinný a musí být ve formátu YYYY-MM-DD.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (!to || !DATE_REGEX.test(to)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametr "to" je povinný a musí být ve formátu YYYY-MM-DD.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const fromDate = parseLocalDate(from);
    const toDate = parseLocalDate(to);

    if (formatDate(fromDate) !== from || formatDate(toDate) !== to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatné datum. Použijte existující datum ve formátu YYYY-MM-DD.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (fromDate > toDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametr "from" musí být menší nebo roven "to".' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cacheBucketMin = Math.floor(requestNowPrague.getTime() / 60000);
    const cacheKey = `availability:v1:${from}:${to}:${cacheBucketMin}`;
    if (env.CACHE) {
      try {
        const cached = await env.CACHE.get(cacheKey, 'text');
        if (cached) {
          return new Response(cached, { status: 200, headers: CORS_HEADERS });
        }
      } catch (err) {
        console.warn('[availability] Cache read failed:', err);
      }
    }

    // Load settings
    const settingsRow = await env.DB.prepare(
      'SELECT slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days FROM booking_settings WHERE id = 1'
    ).first();

    const settings = {
      slot_duration_min: settingsRow?.slot_duration_min ?? 60,
      slot_gap_min: settingsRow?.slot_gap_min ?? 10,
      min_lead_hours: settingsRow?.min_lead_hours ?? 24,
      max_horizon_days: settingsRow?.max_horizon_days ?? 60,
    };

    const slotStepMin = settings.slot_duration_min + settings.slot_gap_min;
    if (
      !Number.isInteger(settings.slot_duration_min) ||
      !Number.isInteger(settings.slot_gap_min) ||
      settings.slot_duration_min <= 0 ||
      settings.slot_gap_min < 0 ||
      slotStepMin <= 0
    ) {
      throw new Error('Invalid booking_settings: slot step must be positive.');
    }

    const todayPrague = new Date(requestNowPrague.getFullYear(), requestNowPrague.getMonth(), requestNowPrague.getDate());
    const maxDate = addDays(todayPrague, settings.max_horizon_days);

    if (fromDate > maxDate) {
      return new Response(
        JSON.stringify({
          success: true,
          days: [],
          meta: {
            slot_duration_min: settings.slot_duration_min,
            slot_gap_min: settings.slot_gap_min,
            min_lead_hours: settings.min_lead_hours,
            max_horizon_days: settings.max_horizon_days,
            timezone: 'Europe/Prague',
            from,
            to: formatDate(maxDate),
          },
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const constrainedToDate = toDate > maxDate ? maxDate : toDate;

    // Load rules
    const rulesRows = await env.DB.prepare(
      'SELECT weekday, start_time, end_time FROM availability_rules WHERE active = 1'
    ).all();

    // Load exceptions
    const exceptionsRows = await env.DB.prepare(
      'SELECT date, start_time, end_time, type FROM availability_exceptions WHERE date >= ? AND date <= ?'
    ).bind(from, formatDate(constrainedToDate)).all();

    // Load booked slots
    const bookedRows = await env.DB.prepare(
      'SELECT slot_start FROM bookings WHERE slot_start IS NOT NULL AND status IN (?, ?, ?) AND slot_start >= ? AND slot_start <= ?'
    ).bind('pending', 'confirmed', 'pending_payment', from + ' 00:00', formatDate(constrainedToDate) + ' 23:59').all();

    const busySlots = bookedRows.results?.map((r) => r.slot_start) ?? [];

    // Compute availability
    const days = computeAvailability({
      rules: rulesRows.results ?? [],
      exceptions: exceptionsRows.results ?? [],
      settings,
      busySlots,
      from,
      to: formatDate(constrainedToDate),
      now: requestNowPrague,
    });

    const payload = JSON.stringify({
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
    });

    if (env.CACHE) {
      const cacheWrite = env.CACHE
        .put(cacheKey, payload, { expirationTtl: 45 })
        .catch((err) => console.warn('[availability] Cache write failed:', err));
      if (waitUntil) {
        waitUntil(cacheWrite);
      } else {
        await cacheWrite;
      }
    }

    return new Response(payload, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[availability] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru. Zkuste to prosím později.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
