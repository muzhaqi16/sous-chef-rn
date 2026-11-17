import type {
  PackageSizeInput,
  StockAmountInput,
} from '#/graphql/generated/schemaTypes';
import { boughtAmountOf, stockAmountOf, type HeldUnit } from './stockAmount';

/** Facts about this acquisition. Shopping requests are deliberately not evidence. */
export interface IntakeFacts {
  quantity?: number | null;
  unitId?: string | null;
  intent?: 'measured' | 'packages' | 'bought';
  packageSize?: PackageSizeInput | null;
}

/** Preserve explicit corrections, even a cleared field, ahead of printed/catalog facts. */
export function resolveIntakeDraft({
  purchased,
  catalog,
  correction,
  heldUnit = null,
}: {
  purchased: IntakeFacts;
  catalog?: IntakeFacts;
  correction?: IntakeFacts;
  heldUnit?: HeldUnit;
}): {
  facts: IntakeFacts;
  amount: StockAmountInput | null;
  unresolved: ('quantity' | 'unit' | 'packageSize')[];
} {
  const facts = { ...catalog, ...purchased, ...correction };
  const { quantity, unitId, packageSize, intent = 'bought' } = facts;
  if (quantity == null || !Number.isFinite(quantity) || quantity <= 0) {
    return { facts, amount: null, unresolved: ['quantity'] };
  }
  if (intent === 'measured') {
    return {
      facts,
      amount: unitId ? stockAmountOf(quantity, { unitId }) : null,
      unresolved: unitId ? [] : ['unit'],
    };
  }
  if (!Number.isInteger(quantity))
    return { facts, amount: null, unresolved: ['quantity'] };
  if (
    packageSize &&
    (!Number.isFinite(packageSize.netWeight) ||
      packageSize.netWeight <= 0 ||
      !packageSize.netWeightUnitId)
  ) {
    return { facts, amount: null, unresolved: ['packageSize'] };
  }
  // The API owns package arithmetic: a multipack's contained count is stated as given.
  return {
    facts,
    amount:
      intent === 'packages'
        ? stockAmountOf(quantity, { asPackages: true, packageSize, unitId })
        : boughtAmountOf(quantity, { heldUnit, packageSize, unitId }),
    unresolved: [],
  };
}
