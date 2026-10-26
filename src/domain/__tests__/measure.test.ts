import { UnitSystem } from '#/graphql/generated/schemaTypes';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  currentReading,
  formatReading,
  readingOf,
  resolveReadingSystem,
  type MeasureShape,
} from '../measure';

const lb = { symbol: 'lb', displayAsFraction: false };
const kg = { symbol: 'kg', displayAsFraction: false };
const oz = { symbol: 'oz', displayAsFraction: false };
const g = { symbol: 'g', displayAsFraction: false };
const cup = { symbol: 'cup', displayAsFraction: true };
const can = {
  symbol: 'can',
  displayAsFraction: false,
  type: UnitType.Count,
};

// The API climbs from the base whatever the stored unit: 1360.78 g and 48 oz
// both read 3 lb.
const honey: MeasureShape = {
  metric: { value: 1.36, unit: kg },
  imperial: { value: 3, unit: lb },
};

// A "6.35 oz (180 g)" can: the API's ounce reading rounds to its 0.1 step.
const tuna: MeasureShape = {
  metric: { value: 180, unit: g },
  imperial: { value: 6.3, unit: oz },
  declared: {
    metric: { value: 180, unit: g },
    imperial: { value: 6.35, unit: oz },
  },
};

describe('reading an amount in the user’s unit system', () => {
  it.each([
    [UnitSystem.Imperial, '3 lb'],
    [UnitSystem.Metric, '1.36 kg'],
  ] as const)('reads %s as %s', (system, text) => {
    expect(formatReading(readingOf(honey, system))).toBe(text);
  });

  it('prefers the label’s own figure over a rounded reading', () => {
    expect(formatReading(readingOf(tuna, UnitSystem.Imperial))).toBe('6.35 oz');
    expect(formatReading(readingOf(tuna, UnitSystem.Metric))).toBe('180 g');
  });

  it('keeps the reading where the label prints nothing in that system', () => {
    const metricOnlyLabel: MeasureShape = {
      ...tuna,
      declared: { metric: { value: 180, unit: g }, imperial: null },
    };
    expect(readingOf(metricOnlyLabel, UnitSystem.Imperial)).toEqual({
      value: 6.3,
      unit: oz,
    });
  });

  it('never converts a count', () => {
    const twoCans: MeasureShape = {
      metric: { value: 2, unit: can },
      imperial: { value: 2, unit: can },
    };
    expect(formatReading(readingOf(twoCans, UnitSystem.Metric))).toBe('2 can');
    expect(formatReading(readingOf(twoCans, UnitSystem.Imperial))).toBe(
      '2 can',
    );
  });

  it('writes a unit cooks halve as a fraction', () => {
    const flour: MeasureShape = {
      metric: { value: 180, unit: g },
      imperial: { value: 1.5, unit: cup },
    };
    expect(formatReading(readingOf(flour, UnitSystem.Imperial))).toBe(
      '1 1/2 cup',
    );
  });
});

describe('the system an amount is read in', () => {
  it.each([
    [UnitSystem.Metric, UnitSystem.Imperial, UnitSystem.Metric],
    [UnitSystem.Imperial, UnitSystem.Metric, UnitSystem.Imperial],
    [UnitSystem.System, UnitSystem.Imperial, UnitSystem.Imperial],
    [UnitSystem.System, UnitSystem.Metric, UnitSystem.Metric],
    [undefined, undefined, UnitSystem.Metric],
  ])('%s on a %s device reads %s', (preferred, device, expected) => {
    expect(resolveReadingSystem(preferred, device)).toBe(expected);
  });
});

describe('a reading kept only while it describes the stored figure', () => {
  const stored1360g = {
    value: 1360.78,
    unit: { id: 'unit-g' },
    ...honey,
  };

  it('reads the measure while the stored figure is the one it was read from', () => {
    expect(
      currentReading(
        stored1360g,
        { value: 1360.78, unitId: 'unit-g' },
        UnitSystem.Imperial,
      ),
    ).toEqual({ value: 3, unit: lb });
  });

  // A local use moved the stack to 1000 g; only the server can say what that
  // reads in pounds, so the stored figure shows until it answers.
  it('gives way once a local write moved the stored figure', () => {
    expect(
      currentReading(
        stored1360g,
        { value: 1000, unitId: 'unit-g' },
        UnitSystem.Imperial,
      ),
    ).toBeNull();
  });

  it('gives way once the stored unit changed', () => {
    expect(
      currentReading(
        stored1360g,
        { value: 1360.78, unitId: 'unit-oz' },
        UnitSystem.Imperial,
      ),
    ).toBeNull();
  });

  it('has nothing to read without a measure or a stored figure', () => {
    expect(
      currentReading(null, { value: 1, unitId: 'unit-g' }, UnitSystem.Metric),
    ).toBeNull();
    expect(
      currentReading(
        stored1360g,
        { value: null, unitId: 'unit-g' },
        UnitSystem.Metric,
      ),
    ).toBeNull();
  });

  it('writes half a can as every count reads', () => {
    expect(formatReading({ value: 1.5, unit: can })).toBe('1 1/2 can');
  });
});
