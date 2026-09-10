import { preferredMeasure } from '#features/recipes/utils/preferredMeasure';
import { UnitSystem } from '#/graphql/generated/schemaTypes';

/**
 * Spoonacular states every ingredient twice. The reader picked a system, so the
 * one they picked is what they see. Without this the card shows US, while the
 * app resolves an unset preference to metric.
 */

const measures = {
  us: { amount: 8, unitShort: 'oz' },
  metric: { amount: 226.796, unitShort: 'g' },
};

describe('showing an ingredient in the reader’s system', () => {
  it('takes the metric measure for a metric reader', () => {
    expect(preferredMeasure(measures, UnitSystem.Metric)).toEqual({
      amount: 226.796,
      unit: 'g',
    });
  });

  it('takes the US measure for an imperial reader', () => {
    expect(preferredMeasure(measures, UnitSystem.Imperial)).toEqual({
      amount: 8,
      unit: 'oz',
    });
  });

  it('follows metric for the system default', () => {
    // Nothing on the device states the locale's measurement system, and metric
    // is what an unset preference resolves to.
    expect(preferredMeasure(measures, UnitSystem.System).unit).toBe('g');
  });

  it('falls back to the other side when the preferred one has no unit', () => {
    const oneSided = { us: { amount: 8, unitShort: 'oz' }, metric: null };

    expect(preferredMeasure(oneSided, UnitSystem.Metric)).toEqual({
      amount: 8,
      unit: 'oz',
    });
  });

  it('reports a bare count as having no unit', () => {
    // "1 onion" — Spoonacular states both sides with an empty unit.
    const bare = {
      us: { amount: 1, unitShort: '' },
      metric: { amount: 1, unitShort: '' },
    };

    expect(preferredMeasure(bare, UnitSystem.Metric)).toEqual({
      amount: 1,
      unit: '',
    });
  });

  it('survives an ingredient carrying no measures at all', () => {
    expect(preferredMeasure(null, UnitSystem.Metric)).toEqual({
      amount: undefined,
      unit: '',
    });
  });
});
