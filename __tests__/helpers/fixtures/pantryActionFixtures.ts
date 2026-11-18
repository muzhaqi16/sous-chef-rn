/**
 * The stack a pantry action sheet reads, and the units it may act in, as the
 * production selections hold them. Shared by the action sheets' tests.
 */
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import type { UnitType } from '#/graphql/generated/schemaTypes';
import { PantryActionModal_PantryItemFragmentDoc } from '#features/pantry/components/modals/PantryActionModal.generated';
import type { ConsumptionUnitsForPantryItemDocument } from '#features/pantry/graphql/pantry.generated';

export const ACTION_ITEM_ID = 'pantry-1';

/**
 * Five pounds of flour as the list holds it, with what is stated. The
 * production selection the sheet reads, so a thin fixture fails here instead
 * of defining its own idea of complete.
 */
export function actionItemCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      fragment: PantryActionModal_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: ACTION_ITEM_ID,
        version: 1,
        itemId: 'item-1',
        itemName: 'Flour',
        quantity: 5,
        heldQuantity: 5,
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 5 },
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity: 5,
          localizedSymbol: 'lbs',
          fraction: null,
          unit: asAbbreviation({ __typename: 'Unit', id: 'u1', symbol: 'lbs' }),
        },
        activeBatchCount: 1,
        netWeight: null,
        remainingNetWeight: null,
        portionUnitId: null,
        portionUnit: null,
        remainingPortions: null,
        lastUsedAt: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u1',
          symbol: 'lbs',
          name: 'Pounds',
          type: 'WEIGHT',
          displayAsFraction: false,
        }),
        displayUnit: null,
        netWeightUnit: null,
        consumeUnit: null,
        packageBreakdown: null,
        quantityBreakdown: null,
        ...overrides,
      },
    },
  ]);
}

/** A unit an action may be measured in, as the server ranks it. */
export type RankedActionUnit = NonNullable<
  MockDataFor<
    typeof ConsumptionUnitsForPantryItemDocument
  >['consumptionUnitsForPantryItem']
>[number];

export const rankedUnit = (
  unit: { id: string; symbol: string; name: string; type: UnitType } & Record<
    string,
    unknown
  >,
  rank: number,
  defaultIncrement = 1,
): RankedActionUnit => ({
  unit: asAbbreviation({
    __typename: 'Unit',
    displayAsFraction: false,
    commonFractions: null,
    hasStandardCountFactor: false,
    baseUnitId: null,
    conversionFactor: null,
    ...unit,
  }),
  rank,
  defaultIncrement,
  commonFractions: null,
  isWholeContainer: false,
});
