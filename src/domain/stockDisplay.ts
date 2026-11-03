import { UnitType } from '#/graphql/generated/schemaTypes';

type UnitShape = { __typename?: 'Unit'; id: string; symbol: string };

/** What says whether a unit is a count multiple of another (a dozen of pieces). */
export interface CountUnitShape {
  type: UnitType;
  hasStandardCountFactor: boolean;
  baseUnitId?: string | null;
  conversionFactor: number;
}

/** A stack's display unit, as `shownStock` reads it. */
export type DisplayUnitShape = UnitShape &
  CountUnitShape & { commonFractions?: readonly number[] | null };

/** The fractions a dozen that states none is shown in (the API's glyph set). */
const DEFAULT_COMMON_FRACTIONS = [1 / 8, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4];

/** How far a stated common fraction may sit from the one it names (0.333 is ⅓). */
const FRACTION_WINDOW = 0.002;

/** How far a held count may sit from a whole one and still be it. */
const WHOLE_WINDOW = 1e-6;

/** A typed fraction of a multiple is exact to three decimals: 0.333 doz is 4 pc. */
const ENTRY_STEP = 0.001;

const wholeWithin = (value: number, window: number): number | null => {
  const whole = Math.round(value);
  return Math.abs(value - whole) <= window ? whole : null;
};

/**
 * The factor of `unit` when it is a count multiple of `baseUnitId` (12 for a
 * dozen of pieces): a standard count unit with that base and a factor over 1.
 */
export function countFactorOver(
  unit: CountUnitShape,
  baseUnitId: string | undefined,
): number | null {
  return baseUnitId !== undefined &&
    unit.type === UnitType.Count &&
    unit.hasStandardCountFactor &&
    unit.baseUnitId === baseUnitId &&
    unit.conversionFactor > 1
    ? unit.conversionFactor
    : null;
}

/**
 * An amount entered in a unit `factor` times the stack's own, in the stack's
 * own. A dozen is restated as the API does (`inBaseCount`): the whole count a
 * typed fraction stands for, never zero.
 */
export function inCountedUnit(amount: number, factor: number): number {
  if (factor === 1) return amount;
  const count = amount * factor;
  const whole = wholeWithin(count, factor * ENTRY_STEP);
  return whole !== null && whole >= 1 ? whole : count;
}

/** The base counts, out of `factor`, a common fraction names exactly: 3 4 6 8 9 of 12. */
function wholeParts(unit: DisplayUnitShape, factor: number): Set<number> {
  const listed =
    unit.commonFractions && unit.commonFractions.length > 0
      ? unit.commonFractions
      : DEFAULT_COMMON_FRACTIONS;
  const parts = new Set<number>();
  for (const fraction of listed) {
    const part = Math.round(fraction * factor);
    if (part > 0 && part < factor) {
      if (Math.abs(part / factor - fraction) <= FRACTION_WINDOW)
        parts.add(part);
    }
  }
  return parts;
}

/**
 * What a stack holds as it is shown, by the API's rule (`displayAmountOf`): in
 * its display unit when that is a count multiple of the unit it counts in and
 * the amount is whole or an exact common fraction of it (2 doz, 2⅔ doz),
 * otherwise in the unit it counts in (11 pc). Never a decimal of a dozen.
 */
export function shownStock<
  Unit extends UnitShape,
  Shown extends DisplayUnitShape,
>(
  held: number,
  unit: Unit,
  displayUnit: Shown | null | undefined,
): { quantity: number; unit: Unit | Shown } {
  const own = { quantity: held, unit };
  if (!displayUnit) return own;
  const factor = countFactorOver(displayUnit, unit.id);
  if (factor === null) return own;
  const count = wholeWithin(held, WHOLE_WINDOW);
  if (count === null || count <= 0) return own;
  const rest = count % factor;
  if (rest !== 0 && !wholeParts(displayUnit, factor).has(rest)) return own;
  return { quantity: count / factor, unit: displayUnit };
}

/** What a stack holds inside, in the unit it states it in. */
export interface HeldInside<Unit> {
  left: number;
  unit: Unit;
}

interface AmountLeftSource<Shown, Inside> {
  held: number;
  /**
   * The unopened packages among `held` (`stockBreakdown.fullPackages`), so two
   * half-used bags read as part-used though they add up to one. Unknown, a
   * whole `held` reads as unopened.
   */
  fullPackages?: number | null;
  /** `held` as the stack shows it: `shownStock`, or an amount stated in that form. */
  shown: { quantity: number; unit: Shown };
  trackingType: UnitType | null | undefined;
  commonFractions?: readonly number[] | null;
  portions?: HeldInside<Inside> | null;
  netWeight?: HeldInside<Inside> | null;
}

/**
 * The unopened packages once a local write moves `held` from `before` to
 * `after`. The server draws part-used packages first, so a use takes whole ones
 * only once none is left; packages added arrive whole. Null while unknown.
 */
export function fullPackagesAfter(
  full: number | null | undefined,
  before: number,
  after: number,
): number | null {
  if (full == null) return null;
  return after >= before
    ? full + Math.floor(after - before + WHOLE_WINDOW)
    : Math.min(full, Math.floor(after + WHOLE_WINDOW));
}

/** The API's `nearestCommonFraction`: never 0 and never a whole. */
function nearestCommonFraction(
  held: number,
  listed: readonly number[] | null | undefined,
): number {
  const whole = Math.floor(held);
  const part = held - whole;
  const fractions =
    listed && listed.length > 0 ? listed : DEFAULT_COMMON_FRACTIONS;
  return (
    whole +
    fractions.reduce((best, fraction) =>
      Math.abs(fraction - part) < Math.abs(best - part) ? fraction : best,
    )
  );
}

/**
 * What a person reads as left, by the API's rule (`amountLeftBasis`): whole
 * packages as the stack shows them, a part-used one in what is inside, portions
 * before a net weight, else a fraction of the package. A stack counted by weight
 * or volume has no package to part-use.
 */
export function amountLeftOf<Shown, Inside>({
  held,
  fullPackages,
  shown,
  trackingType,
  commonFractions,
  portions,
  netWeight,
}: AmountLeftSource<Shown, Inside>):
  | { quantity: number; unit: Shown }
  | { quantity: number; unit: Inside } {
  const isMeasure =
    trackingType === UnitType.Weight || trackingType === UnitType.Volume;
  const partUsed =
    wholeWithin(held, WHOLE_WINDOW) === null ||
    (fullPackages != null && held > fullPackages + WHOLE_WINDOW);
  if (isMeasure || !partUsed) return shown;
  if (portions) return { quantity: portions.left, unit: portions.unit };
  if (netWeight) return { quantity: netWeight.left, unit: netWeight.unit };
  return {
    quantity: nearestCommonFraction(held, commonFractions),
    unit: shown.unit,
  };
}
