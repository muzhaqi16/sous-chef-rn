import type { ApolloCache } from '@apollo/client';
import type { DeepPartial } from '@apollo/client/utilities';
import {
  amountLeftOf,
  countFactorOver,
  inCountedUnit,
  shownStock,
} from '#domain/stockDisplay';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  InTrackingUnit_EnteredUnitFragmentDoc,
  InTrackingUnit_PantryItemFragmentDoc,
  WriteHeldStock_AmountLeftFragmentDoc,
  WriteHeldStock_InsideFragmentDoc,
  WriteHeldStock_NotationFragmentDoc,
  WriteHeldStock_PantryItemFragmentDoc,
  WriteHeldStock_ReadingUnitFragmentDoc,
  WriteHeldStock_ShownInFragmentDoc,
  type InTrackingUnit_EnteredUnitFragment,
  type InTrackingUnit_PantryItemFragment,
  type WriteHeldStock_AmountLeftFragment,
  type WriteHeldStock_InsideFragment,
  type WriteHeldStock_NotationFragment,
  type WriteHeldStock_PantryItemFragment,
  type WriteHeldStock_ReadingUnitFragment,
  type WriteHeldStock_ShownInFragment,
} from './stock.generated';
import {
  resolveQuantityNotation,
  statedAmount,
  unitLabel,
} from '#/utils/formatQuantity';

type ShownAmount = WriteHeldStock_PantryItemFragment['displayAmount'];
type CountedIn = WriteHeldStock_PantryItemFragment['unit'];
type AmountLeft = WriteHeldStock_AmountLeftFragment['amountLeft'];

/** `heldQuantity` as the server will show it; in `unit` when the dozen is not cached. */
function shownAmount(
  cache: ApolloCache,
  id: string,
  heldQuantity: number,
  unit: CountedIn,
): ShownAmount {
  const shownIn = cache.readFragment<WriteHeldStock_ShownInFragment>({
    id,
    fragment: WriteHeldStock_ShownInFragmentDoc,
    fragmentName: 'writeHeldStock_shownIn',
    optimistic: true,
  })?.displayUnit;
  const amount = shownStock(heldQuantity, unit, shownIn);
  const notation = cache.readFragment<WriteHeldStock_NotationFragment>({
    id,
    fragment: WriteHeldStock_NotationFragmentDoc,
    fragmentName: 'writeHeldStock_notation',
    returnPartialData: true,
    optimistic: true,
  });
  const shownInUnit = [notation?.unit, notation?.displayUnit].find(
    candidate => candidate?.id === amount.unit.id,
  );
  return {
    __typename: 'DisplayAmount',
    quantity: amount.quantity,
    // As the server states it, by the same rule, until it answers.
    ...statedAmount(
      amount.quantity,
      amount.unit,
      shownInUnit?.displayAsFraction,
    ),
    unit: amount.unit,
  };
}

const readInside = (
  cache: ApolloCache,
  id: string,
): DeepPartial<WriteHeldStock_InsideFragment> | null =>
  cache.readFragment<WriteHeldStock_InsideFragment>({
    id,
    fragment: WriteHeldStock_InsideFragmentDoc,
    fragmentName: 'writeHeldStock_inside',
    returnPartialData: true,
    optimistic: true,
  });

/** `amountLeft` before the server states it, the same in both systems: only it converts. */
export function localAmountLeft(
  cache: ApolloCache,
  quantity: number,
  unitId: string,
): AmountLeft {
  const unit: DeepPartial<WriteHeldStock_ReadingUnitFragment> | null =
    cache.readFragment<WriteHeldStock_ReadingUnitFragment>({
      id: cache.identify({ __typename: 'Unit', id: unitId }),
      fragment: WriteHeldStock_ReadingUnitFragmentDoc,
      fragmentName: 'writeHeldStock_readingUnit',
      returnPartialData: true,
      optimistic: true,
    });
  const displayAsFraction = unit?.displayAsFraction ?? false;
  const reading: AmountLeft['metric'] = {
    __typename: 'MeasureReading',
    value: quantity,
    unitId,
    symbol: unit?.symbol ?? '',
    localizedSymbol: unitLabel(unit, {
      quantity,
      notation: resolveQuantityNotation(null, displayAsFraction),
    }),
    displayAsFraction,
    type: unit?.type ?? UnitType.Count,
  };
  return {
    __typename: 'Measure',
    value: quantity,
    unitId,
    metric: reading,
    imperial: reading,
  };
}

const heldInside = (
  left: number | null | undefined,
  unit: string | null | undefined,
) => (left != null && unit ? { left, unit } : null);

function writeAmountLeft(
  cache: ApolloCache,
  id: string,
  pantryItemId: string,
  amountLeft: AmountLeft,
): void {
  cache.writeFragment({
    id,
    fragment: WriteHeldStock_AmountLeftFragmentDoc,
    fragmentName: 'writeHeldStock_amountLeft',
    data: { __typename: 'PantryItem', id: pantryItemId, amountLeft },
  });
}

/**
 * The ONE pre-answer writer of a stack's `heldQuantity`, with `displayAmount`
 * by the server's rule (`shownStock`): "1 doz" never shows over 11 pc, and
 * `amountLeft` by its rule (`amountLeftOf`). `shown` states the display itself,
 * for an amount given in a unit the stack shows in.
 */
export function writeHeldStock(
  cache: ApolloCache,
  pantryItemId: string,
  next: number | ((held: number) => number),
  shown?: ShownAmount,
): void {
  const id = cache.identify({ __typename: 'PantryItem', id: pantryItemId });
  if (!id) return;
  const cached = cache.readFragment<WriteHeldStock_PantryItemFragment>({
    id,
    fragment: WriteHeldStock_PantryItemFragmentDoc,
    fragmentName: 'writeHeldStock_pantryItem',
    returnPartialData: true,
    optimistic: true,
  });
  const held = cached?.heldQuantity ?? 0;
  const heldQuantity = typeof next === 'number' ? next : next(held);
  const unit = cached?.unit;
  if (!unit) {
    // No unit to show it in: the amount still moves.
    cache.modify({ id, fields: { heldQuantity: () => heldQuantity } });
    return;
  }
  const displayAmount = shown ?? shownAmount(cache, id, heldQuantity, unit);
  cache.writeFragment({
    id,
    fragment: WriteHeldStock_PantryItemFragmentDoc,
    fragmentName: 'writeHeldStock_pantryItem',
    data: {
      __typename: 'PantryItem',
      id: pantryItemId,
      heldQuantity,
      unit,
      displayAmount,
    },
  });
  const inside = readInside(cache, id);
  const left = amountLeftOf({
    held: heldQuantity,
    shown: { quantity: displayAmount.quantity, unit: displayAmount.unit.id },
    trackingType: inside?.unit?.type,
    commonFractions: inside?.unit?.commonFractions,
    portions: heldInside(inside?.remainingPortions, inside?.portionUnit?.id),
    netWeight: heldInside(
      inside?.remainingNetWeight,
      inside?.netWeightUnit?.id,
    ),
  });
  writeAmountLeft(
    cache,
    id,
    pantryItemId,
    localAmountLeft(cache, left.quantity, left.unit),
  );
}

/**
 * A use stated in what a package holds moves that figure and the amount, by
 * subtraction: the same unit, so no conversion. False for any other unit, which
 * waits for the server. A stack with portions reads them, so a use by its net
 * weight waits too, and a stack counted by weight has no package to open.
 */
export function drawInside(
  cache: ApolloCache,
  pantryItemId: string,
  amount: number,
  unitId: string,
  now: string,
): boolean {
  const id = cache.identify({ __typename: 'PantryItem', id: pantryItemId });
  if (!id) return false;
  const inside = readInside(cache, id);
  const portionUnit = inside?.portionUnit;
  const held = portionUnit
    ? inside.remainingPortions
    : inside?.remainingNetWeight;
  const statedInside = unitId === (portionUnit ?? inside?.netWeightUnit)?.id;
  if (held == null || !statedInside || inside?.unit?.type !== UnitType.Count) {
    return false;
  }
  const left = Math.max(0, held - amount);
  cache.modify({
    id,
    fields: {
      [portionUnit ? 'remainingPortions' : 'remainingNetWeight']: () => left,
      updatedAt: () => now,
      lastUsedAt: () => now,
    },
  });
  writeAmountLeft(
    cache,
    id,
    pantryItemId,
    localAmountLeft(cache, left, unitId),
  );
  return true;
}

/**
 * An amount entered in `unitId`, in the stack's tracking unit when no
 * conversion is needed: the tracking unit itself, or a dozen of it. Null when
 * only the server can convert it.
 */
export function inTrackingUnit(
  cache: ApolloCache,
  pantryItemId: string,
  amount: number,
  unitId: string | null | undefined,
): number | null {
  const stackId = cache.identify({
    __typename: 'PantryItem',
    id: pantryItemId,
  });
  const trackingUnitId = stackId
    ? cache.readFragment<InTrackingUnit_PantryItemFragment>({
        id: stackId,
        fragment: InTrackingUnit_PantryItemFragmentDoc,
        optimistic: true,
      })?.unit.id
    : undefined;
  if (!unitId || unitId === trackingUnitId) return amount;
  const unitCacheId = cache.identify({ __typename: 'Unit', id: unitId });
  const entered = unitCacheId
    ? cache.readFragment<InTrackingUnit_EnteredUnitFragment>({
        id: unitCacheId,
        fragment: InTrackingUnit_EnteredUnitFragmentDoc,
        optimistic: true,
      })
    : null;
  const factor = entered ? countFactorOver(entered, trackingUnitId) : null;
  return factor === null ? null : inCountedUnit(amount, factor);
}

/** A use's unit, as a reference: the sheet picked it from units the cache holds. */
export function rememberConsumeUnit(
  cache: ApolloCache,
  pantryItemId: string,
  unitId: string,
): void {
  cache.modify({
    id: cache.identify({ __typename: 'PantryItem', id: pantryItemId }),
    fields: {
      consumeUnit: (_held, { toReference }) =>
        toReference({ __typename: 'Unit', id: unitId }),
    },
  });
}

/**
 * Moves the cached stock by `delta` tracking units. `heldQuantity` is what the
 * screens show; `quantity` is settled by the response. A package counted in a
 * stack takes what it holds with it, by that stack's own figures.
 */
export function bumpStock(
  cache: ApolloCache,
  pantryItemId: string,
  delta: number,
  now: string,
): void {
  const id = cache.identify({ __typename: 'PantryItem', id: pantryItemId });
  if (!id) return;
  const inside = readInside(cache, id);
  const counted = inside?.unit?.type === UnitType.Count;
  const moved = (
    left: number | null | undefined,
    perPackage: number | null | undefined,
  ) =>
    counted && left != null && perPackage != null
      ? Math.max(0, left + delta * perPackage)
      : left;
  cache.modify({
    id,
    fields: {
      quantity: (existing: number) => Math.max(0, existing + delta),
      remainingPortions: () =>
        moved(inside?.remainingPortions, inside?.portionsPerTrackingUnit),
      remainingNetWeight: () =>
        moved(inside?.remainingNetWeight, inside?.netWeight),
      updatedAt: () => now,
      lastUsedAt: () => now,
    },
  });
  writeHeldStock(cache, pantryItemId, held => Math.max(0, held + delta));
}

/** Every restock is a batch of its own. */
export function countNewBatch(cache: ApolloCache, pantryItemId: string): void {
  cache.modify({
    id: cache.identify({ __typename: 'PantryItem', id: pantryItemId }),
    fields: {
      activeBatchCount: (existing: number = 0) => existing + 1,
    },
  });
}
