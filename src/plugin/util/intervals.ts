const EM_DASH = "—";

export type DateInput = Date | string | null;

function toDate(input: DateInput): Date | null {
  if (input === null) return null;
  if (input instanceof Date) return input;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Render a future timestamp as a compact countdown:
 *   3d 2h | 4h 33m | 45m | 1m | <1m | —
 * Past or invalid timestamps render as em-dash to avoid faking data.
 */
export function formatCountdown(target: DateInput, now: Date = new Date()): string {
  const date = toDate(target);
  if (date === null) return EM_DASH;
  const deltaMs = date.getTime() - now.getTime();
  if (deltaMs <= 0) return EM_DASH;

  const totalSec = Math.floor(deltaMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const totalHr = Math.floor(totalMin / 60);
  const hr = totalHr % 24;
  const days = Math.floor(totalHr / 24);

  if (totalMin < 1) {
    // Sub-minute remaining (including the 0-59s tail at top of the minute).
    return sec > 0 ? "<1m" : EM_DASH;
  }
  if (days > 0) {
    return hr > 0 ? `${days}d ${hr}h` : `${days}d`;
  }
  if (hr > 0) {
    return min > 0 ? `${hr}h ${min}m` : `${hr}h`;
  }
  return `${min}m`;
}

export interface ClockFormatOptions {
  timeZone?: string;
  locale?: string;
}

/**
 * Render a reset timestamp as a glanceable clock:
 *   "Mon 08:00" for resets within 7 days, "Jun 15" beyond that, "—" for null/past.
 */
export function formatResetClock(
  target: DateInput,
  now: Date = new Date(),
  options: ClockFormatOptions = {},
): string {
  const date = toDate(target);
  if (date === null) return EM_DASH;
  if (date.getTime() <= now.getTime()) return EM_DASH;

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const timeZone = options.timeZone ?? "UTC";
  const locale = options.locale ?? "en-US";

  if (date.getTime() - now.getTime() <= sevenDays) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone }).format(date);
    const hhmm = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone,
    }).format(date);
    return `${weekday} ${hhmm}`;
  }

  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone }).format(date);
}
