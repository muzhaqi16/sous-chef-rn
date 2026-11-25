import type {
  PackageSizeInput,
  StockAmountInput,
} from '#graphql/generated/schemaTypes';
import { boughtAmountOf, stockAmountOf, type HeldUnit } from './stockAmount';

/** Facts about this acquisition. Shopping requests are deliberately not evidence. */
export interface IntakeFacts {
  quantity?: number | null;
  unitId?: string | null;
  intent?: 'measured' | 'packages' | 'bought';
  packageSize?: PackageSizeInput | null;
}

/** A fact an acquisition lacks before it can be stocked. */
export type IntakeField = 'quantity' | 'unit' | 'packageSize';

/** The amount a purchase states, or the facts it still lacks. */
export function resolveIntakeDraft({
  purchased,
  heldUnit = null,
  unitFromRoute = false,
}: {
  purchased: IntakeFacts;
  heldUnit?: HeldUnit;
  /** The route's API supplies a measured amount's missing unit (a list line's). */
  unitFromRoute?: boolean;
}): { amount: StockAmountInput | null; unresolved: IntakeField[] } {
  const { quantity, unitId, packageSize, intent = 'bought' } = purchased;
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
    return { amount: null, unresolved: ['quantity'] };
  }
  if (intent === 'measured') {
    const stated = !!unitId || unitFromRoute;
    return {
      amount: stated ? stockAmountOf(quantity, { unitId }) : null,
      unresolved: stated ? [] : ['unit'],
    };
  }
  if (!Number.isInteger(quantity))
    return { amount: null, unresolved: ['quantity'] };
  if (
    packageSize &&
    (!Number.isFinite(packageSize.netWeight) ||
      packageSize.netWeight <= 0 ||
      !packageSize.netWeightUnitId)
  ) {
    return { amount: null, unresolved: ['packageSize'] };
  }
  // The API owns package arithmetic: a multipack's contained count is stated as given.
  return {
    amount:
      intent === 'packages'
        ? stockAmountOf(quantity, { asPackages: true, packageSize, unitId })
        : boughtAmountOf(quantity, { heldUnit, packageSize, unitId }),
    unresolved: [],
  };
}
