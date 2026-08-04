import {
  computeIsQuietTime,
  getDeviceTimezone,
  minutesSinceMidnightInTimezone,
} from '../quietHours';

const base = {
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  quietHoursTimezone: 'America/New_York',
};

describe('minutesSinceMidnightInTimezone', () => {
  it('renders the wall-clock minute in the given IANA timezone', () => {
    // 2026-01-15T05:30:00Z → 00:30 in New York (UTC-5 in January).
    const utc = new Date('2026-01-15T05:30:00Z');
    expect(minutesSinceMidnightInTimezone(utc, 'America/New_York')).toBe(30);
    // Same instant is 06:30 in Berlin (UTC+1).
    expect(minutesSinceMidnightInTimezone(utc, 'Europe/Berlin')).toBe(
      6 * 60 + 30,
    );
  });

  it('falls back to device-local time for a missing/invalid timezone', () => {
    const now = new Date('2026-01-15T05:30:00Z');
    const local = now.getHours() * 60 + now.getMinutes();
    expect(minutesSinceMidnightInTimezone(now, null)).toBe(local);
    expect(minutesSinceMidnightInTimezone(now, 'Not/AZone')).toBe(local);
  });
});

describe('getDeviceTimezone', () => {
  it('reports the engine-resolved IANA zone', () => {
    expect(getDeviceTimezone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it('returns null when the engine cannot resolve one', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => {
      throw new Error('no Intl');
    }) as unknown as typeof Intl.DateTimeFormat);

    expect(getDeviceTimezone()).toBeNull();
    spy.mockRestore();
  });
});

describe('computeIsQuietTime', () => {
  it('returns false when quiet hours are disabled or incomplete', () => {
    expect(computeIsQuietTime({ ...base, quietHoursEnabled: false })).toBe(
      false,
    );
    expect(computeIsQuietTime({ ...base, quietHoursStart: null })).toBe(false);
  });

  it('evaluates the midnight-crossing window in the configured timezone', () => {
    // 03:00 UTC = 22:00 New York (in January) → inside 22:00–08:00.
    const insideNy = new Date('2026-01-15T03:00:00Z');
    expect(computeIsQuietTime(base, insideNy)).toBe(true);

    // Same instant is 04:00 in Berlin → still inside 22:00–08:00.
    expect(
      computeIsQuietTime(
        { ...base, quietHoursTimezone: 'Europe/Berlin' },
        insideNy,
      ),
    ).toBe(true);

    // 18:00 UTC = 13:00 New York → outside the window.
    const outsideNy = new Date('2026-01-15T18:00:00Z');
    expect(computeIsQuietTime(base, outsideNy)).toBe(false);
  });

  it('demonstrates the timezone matters: same instant differs by zone', () => {
    // 12:30 UTC. In New York that's 07:30 (inside 22:00–08:00); in Berlin
    // it's 13:30 (outside). The window is identical — only the zone differs.
    const instant = new Date('2026-01-15T12:30:00Z');
    expect(
      computeIsQuietTime(
        { ...base, quietHoursTimezone: 'America/New_York' },
        instant,
      ),
    ).toBe(true);
    expect(
      computeIsQuietTime(
        { ...base, quietHoursTimezone: 'Europe/Berlin' },
        instant,
      ),
    ).toBe(false);
  });
});
