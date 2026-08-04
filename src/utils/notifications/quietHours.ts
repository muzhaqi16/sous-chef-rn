/**
 * Quiet-hours evaluation, timezone-aware.
 *
 * The server suppresses notifications using the user's configured IANA timezone.
 * The client must evaluate quiet hours in that same zone (not the device's local
 * zone) so local suppression and server suppression agree — otherwise a user who
 * travels, or whose device zone differs from their configured zone, sees the two
 * disagree.
 */

interface QuietHoursConfig {
  quietHoursEnabled: boolean;
  quietHoursStart: string | null; // "HH:mm"
  quietHoursEnd: string | null; // "HH:mm"
  quietHoursTimezone: string | null; // IANA, e.g. "America/New_York"
}

/**
 * The device's IANA zone, or `null` when the engine can't report one.
 *
 * `quietHoursTimezone` is what both the server's suppression and this module's
 * banner evaluate the window in, and the API defaults it to `"UTC"`. Left at
 * that default a 22:00–08:00 window mutes 18:00–04:00 for a New York user, so
 * the client keeps the field pointed at the device's zone — that is what makes
 * the configured window mean the user's own wall clock.
 *
 * (Plain function, not a hook, so the try-catch never sits in a hook body.)
 */
export function getDeviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Minutes-since-midnight for `now` rendered in `timezone`. Falls back to the
 * device's local time when the timezone is missing or not recognized by Intl
 * (kept in a plain function so the try-catch never sits in a hook/component body).
 */
export function minutesSinceMidnightInTimezone(
  now: Date,
  timezone: string | null | undefined,
): number {
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hour = Number(parts.find(p => p.type === 'hour')?.value);
      const minute = Number(parts.find(p => p.type === 'minute')?.value);
      if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
        // `hour12: false` renders midnight as "24" in some engines — normalize.
        return (hour % 24) * 60 + minute;
      }
    } catch {
      // Unknown/unsupported timezone → device-local fallback below.
    }
  }
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * Whether `now` falls inside the configured quiet-hours window, evaluated in the
 * user's `quietHoursTimezone`. Handles windows that cross midnight
 * (e.g. 22:00 → 08:00).
 */
export function computeIsQuietTime(
  config: QuietHoursConfig,
  now: Date = new Date(),
): boolean {
  if (
    !config.quietHoursEnabled ||
    !config.quietHoursStart ||
    !config.quietHoursEnd
  ) {
    return false;
  }

  const current = minutesSinceMidnightInTimezone(
    now,
    config.quietHoursTimezone,
  );

  const [startHour, startMin] = config.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = config.quietHoursEnd.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  return startTime > endTime
    ? current >= startTime || current <= endTime // crosses midnight
    : current >= startTime && current <= endTime;
}
