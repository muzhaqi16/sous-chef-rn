import { firstNonBlank } from '#/utils/firstNonBlank';
import { refByIdOrName } from '#/utils/refInput';

/**
 * A shopping line's unit: the picked unit by id, else the typed name. The typed
 * text also rides as `unitLabel`, or an update would label a changed unit with
 * its symbol. Undefined when the line names no unit.
 */
export function lineUnitFields(
  unitId: string | null | undefined,
  unitText: string | null | undefined,
): { unit: { id: string } | { name: string }; unitLabel?: string } | undefined {
  const unit = refByIdOrName(unitId, unitText);
  if (!unit) return undefined;
  const unitLabel = firstNonBlank(unitText)?.trim();
  return unitLabel ? { unit, unitLabel } : { unit };
}
