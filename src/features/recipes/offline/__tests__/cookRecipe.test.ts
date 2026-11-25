import { gql } from '@apollo/client';
import { PendingWrites } from '#apollo/pendingWrites/pendingWrites';
import { seedCache } from '#/test-utils/apolloMockProvider';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { UnitType } from '#graphql/generated/schemaTypes';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import {
  WriteHeldStock_InsideFragmentDoc,
  WriteHeldStock_PantryItemFragmentDoc,
} from '#entities/pantryItem/stock.generated';
import { pantryTrackingExamples } from '#/test-utils/fixtures/pantryTrackingFixtures';
import { cookRecipe, type CookRecipeInputs } from '../localWrites';

const NOW = '2026-11-15T18:00:00.000Z';

const HELD = gql`
  fragment _CookRecipeHeldProbe on PantryItem {
    id
    quantity
    heldQuantity
  }
`;

const MEAL = gql`
  fragment _CookRecipeMealProbe on MealPlanItem {
    id
    isCompleted
    completedAt
    cookingLogId
  }
`;
const COOK_02 = pantryTrackingExamples['COOK-02'];

// COOK-01's pantry: 12 eggs counted in pieces, 64 fl oz of milk held by volume.
function stocked() {
  const stack = (
    id: string,
    quantity: number,
    unitId: string,
    type: UnitType,
  ) => {
    const unit = asAbbreviation({
      __typename: 'Unit',
      id: unitId,
      symbol: unitId,
      type,
      commonFractions: [],
      displayAsFraction: false,
    });
    const data = {
      __typename: 'PantryItem',
      id,
      quantity,
      heldQuantity: quantity,
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity,
        localizedSymbol: unitId,
        fraction: null,
        unit,
      },
      unit,
      activeBatchCount: 1,
      netWeight: null,
      remainingNetWeight: null,
      netWeightUnit: null,
      portionsPerTrackingUnit: null,
      remainingPortions: null,
      portionUnit: null,
      stockBreakdown: { __typename: 'StockBreakdown', fullPackages: quantity },
    };
    return [
      { fragment: WriteHeldStock_PantryItemFragmentDoc, data },
      { fragment: WriteHeldStock_InsideFragmentDoc, data },
      { fragment: HELD, data },
    ];
  };
  const cache = seedCache([
    ...stack('pi-eggs', 12, 'pc', UnitType.Count),
    ...stack('pi-milk', 64, 'floz', UnitType.Volume),
    {
      fragment: MEAL,
      data: {
        __typename: 'MealPlanItem',
        id: COOK_02.mealPlanItemId,
        isCompleted: COOK_02.before.completed,
        completedAt: null,
        cookingLogId: null,
      },
    },
  ]);
  return {
    cache,
    writes: new PendingWrites(cache, { MarkRecipeAsCooked: cookRecipe }),
  };
}
type Device = ReturnType<typeof stocked>;

const heldOf = ({ cache }: Device, id: string) =>
  cache.readFragment<{ quantity: number; heldQuantity: number }>({
    id: cache.identify({ __typename: 'PantryItem', id }),
    fragment: HELD,
    optimistic: true,
  });

const mealOf = ({ cache }: Device) =>
  cache.readFragment<{
    isCompleted: boolean;
    completedAt: string | null;
    cookingLogId: string | null;
  }>({
    id: cache.identify({
      __typename: 'MealPlanItem',
      id: COOK_02.mealPlanItemId,
    }),
    fragment: MEAL,
    optimistic: true,
  });

const cook = ({ writes }: Device, inputs: CookRecipeInputs) =>
  writes.begin(
    MarkRecipeAsCookedDocument,
    { input: { id: 'cook-1', recipeId: 'recipe-1', deductFromPantry: true } },
    inputs,
  );

// A 2-serving recipe of 2 eggs and 8 fl oz, cooked for 4: the review states
// 4 eggs and 16 fl oz, scaled once by the server's match.
const COOK_01: CookRecipeInputs = {
  draws: [
    { pantryItemId: 'pi-eggs', delta: -4, stated: { amount: 4, unitId: 'pc' } },
    {
      pantryItemId: 'pi-milk',
      delta: -16,
      stated: { amount: 16, unitId: 'floz' },
    },
  ],
  now: NOW,
};

describe('a reviewed cook', () => {
  it('COOK-01 draws 4 eggs and 16 fl oz at once, and once however often it is rebuilt', () => {
    const device = stocked();

    cook(device, COOK_01);
    device.writes.rebuild();
    device.writes.rebuild();

    // 12 - 4 = 8 eggs; 64 - 16 = 48 fl oz.
    expect(heldOf(device, 'pi-eggs')).toMatchObject({
      quantity: 8,
      heldQuantity: 8,
    });
    expect(heldOf(device, 'pi-milk')).toMatchObject({
      quantity: 48,
      heldQuantity: 48,
    });
  });

  it('puts the stock back when the cook is refused', () => {
    const device = stocked();

    const write = cook(device, COOK_01);
    device.writes.drop(write.id);

    expect(heldOf(device, 'pi-eggs')).toMatchObject({ quantity: 12 });
    expect(heldOf(device, 'pi-milk')).toMatchObject({ quantity: 64 });
  });

  it('leaves a draw only the server can convert where it is', () => {
    const device = stocked();

    cook(device, {
      draws: [
        {
          pantryItemId: 'pi-milk',
          delta: null,
          stated: { amount: 1, unitId: 'cup' },
        },
      ],
      now: NOW,
    });

    expect(heldOf(device, 'pi-milk')).toMatchObject({ quantity: 64 });
  });

  it('draws nothing for a cook whose stacks the server picks', () => {
    const device = stocked();

    cook(device, { draws: [], now: NOW });

    expect(heldOf(device, 'pi-eggs')).toMatchObject({ quantity: 12 });
  });

  it('COOK-02 shows the planned meal it completes done and linked, with the same draws', () => {
    const device = stocked();

    cook(device, {
      ...COOK_01,
      meal: {
        id: COOK_02.mealPlanItemId,
        cookingLogId: COOK_02.cookingLogId,
      },
    });
    device.writes.rebuild();

    expect(mealOf(device)).toEqual({
      __typename: 'MealPlanItem',
      id: COOK_02.mealPlanItemId,
      isCompleted: true,
      completedAt: NOW,
      cookingLogId: 'COOK-02-log',
    });
    expect(heldOf(device, 'pi-eggs')).toMatchObject({ quantity: 8 });
    expect(heldOf(device, 'pi-milk')).toMatchObject({ quantity: 48 });
  });

  it('leaves the meal undone when its cook is refused, a competing cook included', () => {
    const device = stocked();

    const write = cook(device, {
      ...COOK_01,
      meal: {
        id: COOK_02.mealPlanItemId,
        cookingLogId: COOK_02.competingCookingLogId,
      },
    });
    device.writes.drop(write.id);

    expect(mealOf(device)).toMatchObject({
      isCompleted: false,
      cookingLogId: null,
    });
    expect(heldOf(device, 'pi-eggs')).toMatchObject({ quantity: 12 });
  });
});
