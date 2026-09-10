import { UnitSystem } from '#/graphql/generated/schemaTypes';

interface Measure {
  amount?: number | null;
  unitShort?: string | null;
}

export interface SpoonacularMeasures {
  us?: Measure | null;
  metric?: Measure | null;
}

/**
 * Pick the measure to show from the two Spoonacular sends. `SYSTEM` follows
 * metric: nothing on the device tells us the locale's measurement system, and
 * metric is what the app already defaults an unset preference to.
 */
export function preferredMeasure(
  measures: SpoonacularMeasures | null | undefined,
  system: UnitSystem,
): { amount?: number | null; unit: string } {
  const wantsImperial = system === UnitSystem.Imperial;
  const first = wantsImperial ? measures?.us : measures?.metric;
  const second = wantsImperial ? measures?.metric : measures?.us;

  // Either side can be absent — Spoonacular omits a measure for a bare count
  // ("1 onion"), and then the other side is bare too.
  const chosen = first?.unitShort ? first : second ?? first;
  return { amount: chosen?.amount, unit: chosen?.unitShort ?? '' };
}
