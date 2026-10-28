import { UnitSystem, UnitType } from '#/graphql/generated/schemaTypes';
import {
  formatQuantityWithUnit,
  resolveQuantityNotation,
  type QuantityNotation,
} from '#/utils/formatQuantity';

/** A unit system an amount is shown in: SYSTEM resolved to one of these. */
export type ReadingSystem =
  | typeof UnitSystem.Metric
  | typeof UnitSystem.Imperial;

/**
 * The user's METRIC or IMPERIAL, else what SYSTEM means on their device; metric,
 * the API's own fallback, until either is known.
 */
export function resolveReadingSystem(
  preferred: UnitSystem | null | undefined,
  device: UnitSystem | null | undefined,
): ReadingSystem {
  if (preferred === UnitSystem.Metric || preferred === UnitSystem.Imperial) {
    return preferred;
  }
  return device === UnitSystem.Imperial
    ? UnitSystem.Imperial
    : UnitSystem.Metric;
}

/** One system's figure for an amount, as the API rounds it for display. */
export interface MeasureReadingShape {
  value: number;
  symbol: string;
  localizedSymbol?: string | null;
  displayAsFraction?: boolean | null;
  type?: UnitType | null;
}

/**
 * An amount's readings in both systems. Generic over the reading, so a caller
 * keeps the fields it selected.
 */
export interface MeasureShape<
  R extends MeasureReadingShape = MeasureReadingShape,
> {
  metric: R;
  imperial: R;
}

const IN_SYSTEM: Record<ReadingSystem, 'metric' | 'imperial'> = {
  [UnitSystem.Metric]: 'metric',
  [UnitSystem.Imperial]: 'imperial',
};

/**
 * The figure shown in `system`. The API reads the label's own figure where it
 * prints one (6.35 oz, not a rounded 6.3 oz); a count reads the same in both.
 */
export function readingOf<R extends MeasureReadingShape>(
  measure: MeasureShape<R>,
  system: ReadingSystem,
): R {
  return measure[IN_SYSTEM[system]];
}

/** A reading's unit's own notation; a count as every count reads. */
export function readingNotation(
  reading: Pick<MeasureReadingShape, 'displayAsFraction' | 'type'>,
): QuantityNotation {
  return reading.type === UnitType.Count
    ? 'mixed'
    : resolveQuantityNotation(null, reading.displayAsFraction);
}

/** "3 lb", "1 1/2 cup", "1 1/2 can": a measure in its unit's own notation. */
export function formatReading(reading: MeasureReadingShape): string {
  return formatQuantityWithUnit(reading.value, reading, {
    notation: readingNotation(reading),
  });
}

/** The stored figure a cached field holds, which its `Measure` was read from. */
export interface StoredFigure {
  value: number | null | undefined;
  unitId: string | null | undefined;
}

// A stored figure and its Measure are one number; this only absorbs float noise.
const SAME_FIGURE = 1e-9;

/**
 * `measure` read in `system` while it still describes `stored`; null once a
 * local write has moved the stored figure past the server's readings. Only the
 * server converts, so the caller then shows the stored figure until it answers.
 */
export function currentReading<R extends MeasureReadingShape>(
  measure:
    | (MeasureShape<R> & { value: number; unitId: string })
    | null
    | undefined,
  stored: StoredFigure,
  system: ReadingSystem,
): R | null {
  if (!measure || stored.value == null || stored.unitId !== measure.unitId) {
    return null;
  }
  const scale = Math.max(1, Math.abs(stored.value));
  if (Math.abs(measure.value - stored.value) > SAME_FIGURE * scale) return null;
  return readingOf(measure, system);
}
