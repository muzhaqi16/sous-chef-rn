import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  currentReading,
  type MeasureReadingShape,
  type MeasureShape,
  type ReadingSystem,
} from '#domain/measure';

interface LineAmount<R extends MeasureReadingShape> {
  quantity: number | null | undefined;
  unit?: { id: string } | null;
  amount?: (MeasureShape<R> & { value: number; unit: { id: string } }) | null;
}

/**
 * What a line's amount reads as, while `amount` still describes its quantity: a
 * weight or volume in the user's unit system. A count keeps its own label
 * ("cans"), so it has none.
 */
export function shownLineReading<R extends MeasureReadingShape>(
  line: LineAmount<R>,
  system: ReadingSystem,
): R | null {
  const reading = currentReading(
    line.amount,
    { value: line.quantity, unitId: line.unit?.id },
    system,
  );
  return reading && reading.unit.type !== UnitType.Count ? reading : null;
}
