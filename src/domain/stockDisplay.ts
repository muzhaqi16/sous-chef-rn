import type { Reference } from '@apollo/client';

type UnitShape = { __typename?: 'Unit'; id: string; symbol: string };

/**
 * A stack's `displayAmount` for a write made before the server answers: what it
 * holds, in the unit it counts in. The server's reply restates it in the unit it
 * is shown in ("1 doz" for 12 pc), so no dozen is worked out on the device.
 */
export function heldDisplayAmount<Unit extends UnitShape | Reference>(
  heldQuantity: number,
  unit: Unit,
): { __typename: 'DisplayAmount'; quantity: number; unit: Unit } {
  return { __typename: 'DisplayAmount', quantity: heldQuantity, unit };
}
