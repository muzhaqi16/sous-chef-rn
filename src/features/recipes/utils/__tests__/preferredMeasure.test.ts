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

  it('never crosses one measure’s amount with another’s unit', () => {
    // A metric-authored recipe: `amount`/`unit` say 200 g, and the US measure
    // says 7.05 oz. Reporting 200 with "oz" is a 28-fold error.
    const metricAuthored = {
      us: { amount: 7.05, unitShort: 'oz' },
      metric: { amount: 200, unitShort: 'g' },
    };

    expect(preferredMeasure(metricAuthored, UnitSystem.Metric)).toEqual({
      amount: 200,
      unit: 'g',
    });
    expect(preferredMeasure(metricAuthored, UnitSystem.Imperial)).toEqual({
      amount: 7.05,
      unit: 'oz',
    });
  });

  it('falls back to the ingredient’s own pair, both halves together', () => {
    const own = { amount: 200, unitShort: 'g' };

    expect(preferredMeasure(undefined, UnitSystem.Metric, own)).toEqual({
      amount: 200,
      unit: 'g',
    });
  });

  it('prefers a stated measure over the ingredient’s own', () => {
    const own = { amount: 200, unitShort: 'g' };
    const stated = { us: { amount: 7.05, unitShort: 'oz' }, metric: null };

    expect(preferredMeasure(stated, UnitSystem.Imperial, own)).toEqual({
      amount: 7.05,
      unit: 'oz',
    });
  });
});
