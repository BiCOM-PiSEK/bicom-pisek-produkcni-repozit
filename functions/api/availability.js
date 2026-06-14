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
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Get current time in Prague timezone.
 */
function getNowInPrague() {
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
  // Convert back to Date in local Prague context
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
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Format date as "YYYY-MM-DD".
 */
function formatDate(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

/**
 * Format datetime as "YYYY-MM-DD HH:MM".
 */
function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Add minutes to a date.
 */
function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Add days to a date (in local context).
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');

    // Validate from/to parameters
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

    if (fromDate > toDate) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parametr "from" musí být menší nebo roven "to".' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Load booking_settings (id=1, singleton)
    const settingsRow = await env.DB.prepare(
      'SELECT slot_duration_min, slot_gap_min, min_lead_hours, max_horizon_days FROM booking_settings WHERE id = 1'
    ).first();

    const settings = {
      slot_duration_min: settingsRow?.slot_duration_min ?? 60,
      slot_gap_min: settingsRow?.slot_gap_min ?? 10,
      min_lead_hours: settingsRow?.min_lead_hours ?? 24,
      max_horizon_days: settingsRow?.max_horizon_days ?? 60,
    };

    // Constrain range to max_horizon_days
    const maxDate = addDays(fromDate, settings.max_horizon_days);
    const constrainedToDate = toDate > maxDate ? maxDate : toDate;

    // Load availability_rules (active=1)
    const rulesRows = await env.DB.prepare(
      'SELECT weekday, start_time, end_time FROM availability_rules WHERE active = 1'
    ).all();

    const rulesByWeekday = {};
    rulesRows.results?.forEach((row) => {
      if (!rulesByWeekday[row.weekday]) {
        rulesByWeekday[row.weekday] = [];
      }
      rulesByWeekday[row.weekday].push({
        start_time: row.start_time,
        end_time: row.end_time,
      });
    });

    // Load availability_exceptions for range
    const exceptionsRows = await env.DB.prepare(
      'SELECT date, start_time, end_time, type FROM availability_exceptions WHERE date >= ? AND date <= ?'
    ).bind(from, formatDate(constrainedToDate)).all();

    const exceptionsByDate = {};
    exceptionsRows.results?.forEach((row) => {
      if (!exceptionsByDate[row.date]) {
        exceptionsByDate[row.date] = [];
      }
      exceptionsByDate[row.date].push({
        start_time: row.start_time,
        end_time: row.end_time,
        type: row.type,
      });
    });

    // Load occupied slots (bookings with slot_start)
    const bookedRows = await env.DB.prepare(
      'SELECT slot_start FROM bookings WHERE slot_start IS NOT NULL AND status IN (?, ?, ?) AND slot_start >= ? AND slot_start <= ?'
    ).bind('pending', 'confirmed', 'pending_payment', from + ' 00:00', formatDate(constrainedToDate) + ' 23:59').all();

    const bookedSlots = new Set();
    bookedRows.results?.forEach((row) => {
      bookedSlots.add(row.slot_start);
    });

    // Generate availability
    const now = getNowInPrague();
    const minLeadDate = addMinutes(now, settings.min_lead_hours * 60);
    const maxHorizonDate = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), settings.max_horizon_days);

    const days = [];
    let currentDate = new Date(fromDate);

    while (currentDate <= constrainedToDate) {
      const dateStr = formatDate(currentDate);
      const weekday = currentDate.getDay(); // 0=Sun..6=Sat (matches schema)

      // Check base availability for this weekday
      const rules = rulesByWeekday[weekday];
      if (!rules || rules.length === 0) {
        // Day is closed by default
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Apply exceptions for this day
      const exceptions = exceptionsByDate[dateStr] || [];
      const dayOffExceptions = exceptions.filter((e) => e.type === 'holiday' || e.type === 'vacation');

      // If day is blocked by holiday/vacation (no time range), skip entirely
      if (dayOffExceptions.some((e) => !e.start_time && !e.end_time)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      // Build time ranges for this day (start with base rules, apply adhoc/extra exceptions)
      let timeRanges = [...rules];

      // Apply adhoc exceptions (removals)
      exceptions.filter((e) => e.type === 'adhoc').forEach((exc) => {
        if (exc.start_time && exc.end_time) {
          // Remove this time range from all rules
          timeRanges = timeRanges.flatMap((range) => {
            const [rs, re] = [range.start_time, range.end_time];
            const [es, ee] = [exc.start_time, exc.end_time];
            // Simple approach: if exception fully covers range, remove; else keep range as-is
            if (es <= rs && ee >= re) return []; // fully covered
            return [range]; // keep unchanged (more complex splitting omitted for now)
          });
        }
      });

      // Apply extra exceptions (additions)
      exceptions.filter((e) => e.type === 'extra').forEach((exc) => {
        if (exc.start_time && exc.end_time) {
          timeRanges.push({ start_time: exc.start_time, end_time: exc.end_time });
        }
      });

      // Generate slots within each time range
      const slots = [];
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

          // Check if slot is in future and within lead/horizon windows
          if (slotStart >= minLeadDate && slotStart <= maxHorizonDate) {
            // Check if already booked
            if (!bookedSlots.has(slotStartStr)) {
              slots.push({
                start: slotStartStr,
                end: slotEndStr,
              });
            }
          }

          slotStart = addMinutes(slotStart, settings.slot_duration_min + settings.slot_gap_min);
        }
      });

      if (slots.length > 0) {
        days.push({
          date: dateStr,
          weekday,
          slots,
        });
      }

      currentDate = addDays(currentDate, 1);
    }

    // Return success
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
    console.error('[availability] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru. Zkuste to prosím později.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
