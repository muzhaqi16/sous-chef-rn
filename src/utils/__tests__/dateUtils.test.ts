import { spawnSync } from 'child_process';
import { extractDateString, safeParseDate } from '../dateUtils';

describe('extractDateString', () => {
  it('extracts from ISO string with timezone offset', () => {
    expect(extractDateString('1992-04-18T00:00:00.000+00:00')).toBe(
      '1992-04-18',
    );
  });

  it('extracts from ISO string with Z', () => {
    expect(extractDateString('2024-12-25T10:30:00.000Z')).toBe('2024-12-25');
  });

  it('returns YYYY-MM-DD as-is', () => {
    expect(extractDateString('2024-01-15')).toBe('2024-01-15');
  });

  it('extracts from Date object', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(extractDateString(date)).toBe('2024-01-15');
  });

  it('returns empty string for null', () => {
    expect(extractDateString(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractDateString(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(extractDateString('')).toBe('');
  });

  it('handles numeric Unix timestamp in seconds', () => {
    // 1705276800 = 2024-01-15T00:00:00Z
    const result = extractDateString(1705276800);
    expect(result).toBe('2024-01-15');
  });

  it('handles numeric Unix timestamp in milliseconds', () => {
    const result = extractDateString(1705276800000);
    expect(result).toBe('2024-01-15');
  });
});

describe('safeParseDate', () => {
  it('returns null for null', () => {
    expect(safeParseDate(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(safeParseDate(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(safeParseDate('')).toBeNull();
  });

  it('parses valid ISO string', () => {
    const result = safeParseDate('2024-01-15T00:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('passes through valid Date object', () => {
    const date = new Date('2024-01-15');
    expect(safeParseDate(date)).toBe(date);
  });

  it('returns null for invalid Date object', () => {
    expect(safeParseDate(new Date('invalid'))).toBeNull();
  });

  it('handles Unix timestamp in seconds', () => {
    const result = safeParseDate(1705276800);
    expect(result).toBeInstanceOf(Date);
  });

  it('handles Unix timestamp in milliseconds', () => {
    const result = safeParseDate(1705276800000);
    expect(result).toBeInstanceOf(Date);
  });

  it('returns null for invalid string', () => {
    expect(safeParseDate('not-a-date')).toBeNull();
  });
});

describe('toMealDateTime', () => {
  // Jest's sandboxed `process.env` never reaches the zone the runtime reads,
  // so each zone runs the real module in its own Node process.
  const inZone = (timeZone: string, days: [number, number, number][]) => {
    const script = `
      const { toMealDateTime } = await import(${JSON.stringify(
        require.resolve('../dateUtils.ts'),
      )});
      const days = ${JSON.stringify(days)};
      console.log(JSON.stringify(days.map(([y, m, d]) => {
        const sent = toMealDateTime(new Date(y, m, d));
        const read = new Date(sent);
        return [sent.slice(0, 10), read.getDate(), new Date(y, m, d).toISOString().slice(0, 10)];
      })));`;
    const run = spawnSync(
      process.execPath,
      ['--no-warnings', '--input-type=module', '-e', script],
      { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' },
    );
    return JSON.parse(run.stdout) as [string, number, string][];
  };

  // A plan's first and last local day, as the calendar strip hands them over.
  const FIRST: [number, number, number] = [2026, 8, 21];
  const LAST: [number, number, number] = [2026, 8, 27];

  it.each([
    'Asia/Tokyo',
    'Pacific/Honolulu',
    'Pacific/Pago_Pago',
    'Pacific/Fiji',
    'UTC',
  ])(
    'sends the picked local day as the same UTC day, and reads it back on it, in %s',
    timeZone => {
      const [first, last] = inZone(timeZone, [FIRST, LAST]);
      // The API compares a meal to its plan by UTC calendar day.
      expect(first?.[0]).toBe('2026-09-21');
      expect(last?.[0]).toBe('2026-09-27');
      expect(first?.[1]).toBe(21);
      expect(last?.[1]).toBe(27);
    },
  );

  it('is needed east of UTC, where local midnight is the previous UTC day', () => {
    const [first] = inZone('Asia/Tokyo', [FIRST]);
    expect(first?.[2]).toBe('2026-09-20');
  });
});

describe('keepMealInsidePlan', () => {
  /** [sent ISO, local day it reads back on] for one picked day, in a zone. */
  const sendInZone = (
    timeZone: string,
    [y, m, d]: [number, number, number],
    bounds?: { startDate: string; endDate: string },
  ) => {
    const script = `
      const { keepMealInsidePlan, toMealDateTime } = await import(${JSON.stringify(
        require.resolve('../dateUtils.ts'),
      )});
      const sent = keepMealInsidePlan(
        toMealDateTime(new Date(${y}, ${m}, ${d})),
        ${JSON.stringify(bounds)},
      );
      console.log(JSON.stringify([sent, new Date(sent).getDate()]));`;
    const run = spawnSync(
      process.execPath,
      ['--no-warnings', '--input-type=module', '-e', script],
      { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' },
    );
    return JSON.parse(run.stdout) as [string, number];
  };

  const utcDay = (iso: string) => iso.slice(0, 10);

  it('keeps a last-day meal inside a plan that ends at local midnight, east of UTC', () => {
    // Ends at 00:00 on the 27th in Berlin (UTC+2): the 26th for the server.
    const bounds = {
      startDate: '2026-09-20T22:00:00.000Z',
      endDate: '2026-09-26T22:00:00.000Z',
    };

    const [sent, readBackOn] = sendInZone(
      'Europe/Berlin',
      [2026, 8, 27],
      bounds,
    );

    expect(utcDay(sent) <= utcDay(bounds.endDate)).toBe(true);
    expect(readBackOn).toBe(27);
  });

  it('keeps a first-day meal inside a plan that starts in the evening, west of UTC', () => {
    // Starts at 20:00 on the 21st in Bogotá (UTC-5): the 22nd for the server.
    const bounds = {
      startDate: '2026-09-22T01:00:00.000Z',
      endDate: '2026-09-28T17:00:00.000Z',
    };

    const [sent, readBackOn] = sendInZone(
      'America/Bogota',
      [2026, 8, 21],
      bounds,
    );

    expect(utcDay(sent) >= utcDay(bounds.startDate)).toBe(true);
    expect(readBackOn).toBe(21);
  });

  it('sends local noon for a day inside a plan whose boundaries do not reach it', () => {
    const bounds = {
      startDate: '2026-09-20T22:00:00.000Z',
      endDate: '2026-09-26T22:00:00.000Z',
    };

    const [sent] = sendInZone('Europe/Berlin', [2026, 8, 23], bounds);

    expect(sent).toBe('2026-09-23T10:00:00.000Z');
  });

  it('never moves a day outside the plan onto another local day', () => {
    const bounds = {
      startDate: '2026-09-20T22:00:00.000Z',
      endDate: '2026-09-26T22:00:00.000Z',
    };

    const [sent, readBackOn] = sendInZone(
      'Europe/Berlin',
      [2026, 8, 30],
      bounds,
    );

    expect(sent).toBe('2026-09-30T10:00:00.000Z');
    expect(readBackOn).toBe(30);
  });

  it('leaves the meal at local noon when the plan is not known', () => {
    const [sent] = sendInZone('Europe/Berlin', [2026, 8, 27]);

    expect(sent).toBe('2026-09-27T10:00:00.000Z');
  });
});
