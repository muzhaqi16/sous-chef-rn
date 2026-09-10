import { UnitSystem } from '#/graphql/generated/schemaTypes';

export interface Measure {
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
  /** The ingredient's own amount and unit, which pair with each other. */
  own?: Measure | null,
): { amount?: number | null; unit: string } {
  const wantsImperial = system === UnitSystem.Imperial;
  const first = wantsImperial ? measures?.us : measures?.metric;
  const second = wantsImperial ? measures?.metric : measures?.us;

  // Either side can be absent — Spoonacular omits a measure for a bare count
  // ("1 onion"), and then the other side is bare too. Whichever is taken, the
  // amount and the unit come from the SAME measure: the two are stated in
  // different systems, so crossing them changes the quantity.
  const named = first?.unitShort ? first : second?.unitShort ? second : null;
  const measure = named ?? first ?? second ?? own;
  return { amount: measure?.amount, unit: measure?.unitShort ?? '' };
}
