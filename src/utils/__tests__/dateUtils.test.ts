import { spawnSync } from 'child_process';
import {
  addDaysToKey,
  daysBetweenKeys,
  extractDateString,
  keepDayInsidePlan,
  safeParseDate,
  type PlanBounds,
} from '../dateUtils';

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

/**
 * Jest's sandboxed `process.env` never reaches the zone the runtime reads, so
 * each zone runs the real module in its own Node process. `body` is the source
 * of a function taking the module's exports; its JSON-able return comes back.
 */
function inZone<T>(timeZone: string, body: string): T {
  const script = `
    const dateUtils = await import(${JSON.stringify(
      require.resolve('../dateUtils.ts'),
    )});
    console.log(JSON.stringify((${body})(dateUtils)));`;
  const run = spawnSync(
    process.execPath,
    ['--no-warnings', '--input-type=module', '-e', script],
    { env: { ...process.env, TZ: timeZone }, encoding: 'utf8' },
  );
  return JSON.parse(run.stdout) as T;
}

describe('toDateKey', () => {
  // A plan's first and last local day, as the calendar strip hands them over.
  const sendAndReadBack = (timeZone: string) =>
    inZone<[string, number][]>(
      timeZone,
      `({ toDateKey, fromDateKey }) =>
        [[2026, 8, 21], [2026, 8, 27]].map(([y, m, d]) => {
          const sent = toDateKey(new Date(y, m, d));
          return [sent, fromDateKey(sent).getDate()];
        })`,
    );

  it.each([
    'Asia/Tokyo',
    'Pacific/Honolulu',
    'Pacific/Pago_Pago',
    'Pacific/Kiritimati',
    'Pacific/Fiji',
    'UTC',
  ])(
    'sends the picked local day as its own key, and reads it back on it, in %s',
    timeZone => {
      const [first, last] = sendAndReadBack(timeZone);
      // The API holds a plan's days and a meal's day as `LocalDate`s.
      expect(first).toEqual(['2026-09-21', 21]);
      expect(last).toEqual(['2026-09-27', 27]);
    },
  );

  it('is not the ISO prefix east of UTC, where local midnight is the previous UTC day', () => {
    const [isoPrefix, key] = inZone<[string, string]>(
      'Asia/Tokyo',
      `({ toDateKey }) => {
        const picked = new Date(2026, 8, 21);
        return [picked.toISOString().slice(0, 10), toDateKey(picked)];
      }`,
    );

    expect(isoPrefix).toBe('2026-09-20');
    expect(key).toBe('2026-09-21');
  });
});

describe('fromDateKey', () => {
  it('reads a key as that local day west of UTC, where `new Date(key)` is the day before', () => {
    const [asUtcMidnight, asLocalDay] = inZone<[number, number]>(
      'Pacific/Honolulu',
      `({ fromDateKey }) => [
        new Date('2026-09-21').getDate(),
        fromDateKey('2026-09-21').getDate(),
      ]`,
    );

    expect(asUtcMidnight).toBe(20);
    expect(asLocalDay).toBe(21);
  });

  it('reads a day whose midnight a DST change skips as that same day', () => {
    // Chile's clocks go from 24:00 on the 5th straight to 01:00 on the 6th.
    const [hour, key] = inZone<[number, string]>(
      'America/Santiago',
      `({ fromDateKey, toDateKey }) => {
        const day = fromDateKey('2026-09-06');
        return [day.getHours(), toDateKey(day)];
      }`,
    );

    expect(hour).toBe(1);
    expect(key).toBe('2026-09-06');
  });
});

describe('purchaseDay', () => {
  it("reads a receipt's printed day as that day west of UTC, and a real instant as its local day", () => {
    const [receipt, withMillis, instant] = inZone<[string, string, string]>(
      'America/Los_Angeles',
      `({ purchaseDay, toDateKey }) => [
        toDateKey(purchaseDay('2026-10-17T00:00:00Z')),
        toDateKey(purchaseDay('2026-10-17T00:00:00.000Z')),
        toDateKey(purchaseDay('2026-10-17T03:00:00Z')),
      ]`,
    );

    expect(receipt).toBe('2026-10-17');
    expect(withMillis).toBe('2026-10-17');
    expect(instant).toBe('2026-10-16');
  });
});

describe('dayAsInstant', () => {
  // A phone in Paris whose account still holds New York: the API reads the
  // reminder's day there, six hours behind.
  const dayIn = (timeZone: string, instant: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(instant));

  it('sends a picked day as an instant that is that day west of the phone too', () => {
    const [midnight, sent] = inZone<[string, string]>(
      'Europe/Paris',
      `({ dayAsInstant, fromDateKey }) => {
        const picked = fromDateKey('2026-10-20');
        return [picked.toISOString(), dayAsInstant(picked)];
      }`,
    );

    expect(dayIn('America/New_York', midnight)).toBe('2026-10-19');
    expect(dayIn('America/New_York', sent)).toBe('2026-10-20');
    expect(dayIn('Europe/Paris', sent)).toBe('2026-10-20');
    expect(dayIn('Asia/Tokyo', sent)).toBe('2026-10-20');
  });

  it('keeps the day of a date that carries a time', () => {
    const sent = inZone<string>(
      'Europe/Paris',
      `({ dayAsInstant }) => dayAsInstant(new Date(2026, 9, 20, 23, 30))`,
    );

    expect(dayIn('Europe/Paris', sent)).toBe('2026-10-20');
    expect(dayIn('America/New_York', sent)).toBe('2026-10-20');
  });
});

describe('keepDayInsidePlan', () => {
  const week = { startDate: '2026-09-21', endDate: '2026-09-27' };
  const instant = '2026-09-30T10:00:00.000Z';

  // The plan, the days, and where each day lands.
  it.each<[string, PlanBounds | undefined, string[], string[]]>([
    [
      'leaves a day inside the plan where it is',
      week,
      ['2026-09-23'],
      ['2026-09-23'],
    ],
    [
      'leaves the first and the last day where they are: both are days of the plan',
      week,
      ['2026-09-21', '2026-09-27'],
      ['2026-09-21', '2026-09-27'],
    ],
    [
      'brings a day before the plan onto its first day',
      week,
      ['2026-09-20', '2025-12-31'],
      ['2026-09-21', '2026-09-21'],
    ],
    [
      'brings a day after the plan onto its last day',
      week,
      ['2026-09-28', '2026-10-01'],
      ['2026-09-27', '2026-09-27'],
    ],
    [
      'holds every day on the one day of a one-day plan',
      { startDate: '2026-09-21', endDate: '2026-09-21' },
      ['2026-09-20', '2026-09-21', '2026-09-22'],
      ['2026-09-21', '2026-09-21', '2026-09-21'],
    ],
    [
      'spans a month boundary by the keys alone',
      { startDate: '2026-09-28', endDate: '2026-10-04' },
      ['2026-10-01', '2026-09-27', '2026-10-05'],
      ['2026-10-01', '2026-09-28', '2026-10-04'],
    ],
    [
      'leaves the day unchanged when the plan is not known',
      undefined,
      ['2026-09-30'],
      ['2026-09-30'],
    ],
    [
      'leaves a day that is not a date key unchanged',
      week,
      [instant, ''],
      [instant, ''],
    ],
  ])('%s', (_, bounds, days, landsOn) => {
    expect(days.map(day => keepDayInsidePlan(day, bounds))).toEqual(landsOn);
  });

  it('leaves the day unchanged when a boundary is not a date key', () => {
    // An instant orders against a key by its text, not by its day.
    expect(
      keepDayInsidePlan('2026-09-30', {
        startDate: '2026-09-20T22:00:00.000Z',
        endDate: '2026-09-27',
      }),
    ).toBe('2026-09-30');
    expect(
      keepDayInsidePlan('2026-09-30', {
        startDate: '2026-09-21',
        endDate: '2026-09-26T22:00:00.000Z',
      }),
    ).toBe('2026-09-30');
  });

  it.each(['Pacific/Pago_Pago', 'Pacific/Kiritimati'])(
    'keeps the first and last day on themselves in %s: no key is read as an instant',
    timeZone => {
      const days = inZone<string[]>(
        timeZone,
        `({ keepDayInsidePlan }) => {
          const week = { startDate: '2026-09-21', endDate: '2026-09-27' };
          return ['2026-09-20', '2026-09-21', '2026-09-27', '2026-09-28'].map(
            day => keepDayInsidePlan(day, week),
          );
        }`,
      );

      expect(days).toEqual([
        '2026-09-21',
        '2026-09-21',
        '2026-09-27',
        '2026-09-27',
      ]);
    },
  );
});

/**
 * Zones whose clocks change, with the day before and the day after the lost
 * hour and the gained one: enough to pin calendar-day arithmetic over 24-hour
 * spans, which date-fns' own suite covers zone by zone. Chile's change is AT
 * midnight: the day it springs forward on has no 00:00 for `fromDateKey`.
 */
const DST_ZONES: [string, [string, string], [string, string]][] = [
  [
    'America/New_York',
    ['2026-03-07', '2026-03-09'],
    ['2026-10-31', '2026-11-02'],
  ],
  [
    'America/Santiago',
    ['2026-09-05', '2026-09-07'],
    ['2026-04-04', '2026-04-06'],
  ],
];

describe('daysBetweenKeys', () => {
  it('counts whole days across a month boundary', () => {
    expect(daysBetweenKeys('2026-01-30', '2026-02-02')).toBe(3);
    expect(daysBetweenKeys('2026-02-27', '2026-03-01')).toBe(2);
  });

  it('counts the leap day and the turn of the year', () => {
    expect(daysBetweenKeys('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetweenKeys('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('is zero for one day and negative when the second is earlier', () => {
    expect(daysBetweenKeys('2026-09-21', '2026-09-21')).toBe(0);
    expect(daysBetweenKeys('2026-02-02', '2026-01-30')).toBe(-3);
  });

  it.each(DST_ZONES)(
    'counts a 23-hour and a 25-hour day as one day each in %s',
    (timeZone, [beforeLost, afterLost], [beforeGained, afterGained]) => {
      const spans = inZone<number[]>(
        timeZone,
        `({ daysBetweenKeys }) => [
          daysBetweenKeys(${JSON.stringify(beforeLost)}, ${JSON.stringify(
          afterLost,
        )}),
          daysBetweenKeys(${JSON.stringify(beforeGained)}, ${JSON.stringify(
          afterGained,
        )}),
          daysBetweenKeys(${JSON.stringify(afterLost)}, ${JSON.stringify(
          beforeLost,
        )}),
          daysBetweenKeys('2026-01-01', '2027-01-01'),
        ]`,
      );

      expect(spans).toEqual([2, 2, -2, 365]);
    },
  );
});

describe('addDaysToKey', () => {
  it('steps across a month boundary', () => {
    expect(addDaysToKey('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('steps onto the leap day and over the turn of the year', () => {
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('returns the same day for no days', () => {
    expect(addDaysToKey('2026-09-21', 0)).toBe('2026-09-21');
  });

  it.each(DST_ZONES)(
    'steps one calendar day over a 23-hour and a 25-hour day in %s',
    (timeZone, [beforeLost, afterLost], [beforeGained, afterGained]) => {
      const days = inZone<string[]>(
        timeZone,
        `({ addDaysToKey, daysBetweenKeys }) => [
          addDaysToKey(${JSON.stringify(beforeLost)}, 2),
          addDaysToKey(${JSON.stringify(beforeGained)}, 2),
          addDaysToKey(${JSON.stringify(afterLost)}, -2),
          addDaysToKey(addDaysToKey(${JSON.stringify(beforeLost)}, 1), 1),
          addDaysToKey('2026-01-01', daysBetweenKeys('2026-01-01', '2026-12-31')),
        ]`,
      );

      expect(days).toEqual([
        afterLost,
        afterGained,
        beforeLost,
        afterLost,
        '2026-12-31',
      ]);
    },
  );
});
