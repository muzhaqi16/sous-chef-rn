import { parse } from 'graphql';
import {
  CorrectPantryItemPackageSizeDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  RestockPantryItemDocument,
  UpdatePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  CreateMealPlanDocument,
  CreateMealPlanItemDocument,
} from '#features/mealPlan/graphql/mealPlan.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingItemToPantryDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { MarkRecipeAsCookedDocument } from '#features/recipes/graphql/recipe.generated';
import { MovePurchasedItemsToPantryDocument } from '#features/shoppingList/hooks/useBatchMoveToPantry.generated';
import {
  AddDietaryRestrictionDocument,
  UpdateDietaryProfileDocument,
} from '#operations/user/user.generated';
import { UpdateUserProfileDocument } from '#operations/auth/user.generated';
import { withCurrentInput } from '../legacyRefs';

/**
 * A write queued before the `@oneOf` references shipped replays after the
 * upgrade. The API refuses the old shape before any resolver runs, so an entry
 * not rewritten on load is a write lost.
 */
describe('references', () => {
  it.each([
    [
      'names a pantry create’s catalog item through `item`',
      CreatePantryItemDocument,
      { id: 'p1', pantryId: 'pan1', itemId: 'cat1' },
      { id: 'p1', pantryId: 'pan1', item: { id: 'cat1' } },
    ],
    [
      'wraps an inline item, each of its units by reference',
      CreatePantryItemDocument,
      {
        id: 'p1',
        pantryId: 'pan1',
        unit: { unitName: 'can' },
        item: {
          name: 'Beans',
          units: [
            {
              unitName: 'can',
              packageSize: 400,
              contentUnitId: 'g',
              retailUnit: true,
            },
            { unitId: 'g', isDefault: true },
          ],
          netWeights: [{ value: 400, unitName: 'gram' }],
        },
      },
      {
        id: 'p1',
        pantryId: 'pan1',
        unit: { name: 'can' },
        item: {
          inline: {
            name: 'Beans',
            units: [
              {
                unit: { name: 'can' },
                packageSize: 400,
                contentUnit: { id: 'g' },
                retailUnit: true,
              },
              { unit: { id: 'g' }, isDefault: true },
            ],
            netWeights: [{ value: 400, unit: { name: 'gram' } }],
          },
        },
      },
    ],
    [
      'moves a pantry edit’s storage location and brand onto references',
      UpdatePantryItemDocument,
      {
        id: 'p1',
        version: 3,
        storage: { storageState: 'FROZEN', storageLocationName: 'Garage' },
        brand: { brandId: null },
      },
      {
        id: 'p1',
        version: 3,
        storage: { storageState: 'FROZEN', location: { name: 'Garage' } },
        brand: null,
      },
    ],
    [
      'nests a package-size correction',
      CorrectPantryItemPackageSizeDocument,
      {
        batchId: 'b1',
        packageSize: { netWeight: 500, netWeightUnitId: 'g' },
        reason: 'label',
        version: 1,
      },
      {
        batchId: 'b1',
        correction: { packageSize: { netWeight: 500, netWeightUnitId: 'g' } },
        reason: 'label',
        version: 1,
      },
    ],
    [
      'keeps a shopping line’s typed unit name as its label beside the id',
      AddItemToShoppingListDocument,
      {
        shoppingListId: 'l1',
        items: [
          {
            id: 's1',
            item: { itemId: 'cat1' },
            unit: { unitId: 'u1', unitName: 'cartons' },
            brand: { brandId: 'b1', brandName: 'Acme' },
          },
        ],
      },
      {
        shoppingListId: 'l1',
        items: [
          {
            id: 's1',
            item: { itemId: 'cat1' },
            unit: { id: 'u1' },
            unitLabel: 'cartons',
            brand: { id: 'b1' },
          },
        ],
      },
    ],
    [
      'leaves a shopping line already sending its item inline as it is',
      AddItemToShoppingListDocument,
      {
        shoppingListId: 'l1',
        items: [{ id: 's1', item: { inline: { id: 'item-1', name: 'Milk' } } }],
      },
      {
        shoppingListId: 'l1',
        items: [{ id: 's1', item: { inline: { id: 'item-1', name: 'Milk' } } }],
      },
    ],
    [
      'clears a shopping line’s unit an edit emptied',
      UpdateShoppingListItemDocument,
      { id: 's1', unit: { unitName: '' } },
      { id: 's1', unit: null },
    ],
    [
      'sends the purchased-move hints under their new name',
      MovePurchasedItemsToPantryDocument,
      {
        shoppingListId: 'l1',
        pantryItemIds: [{ shoppingListItemId: 's1', pantryItemId: 'p1' }],
      },
      {
        shoppingListId: 'l1',
        pantryItemHints: [{ shoppingListItemId: 's1', pantryItemId: 'p1' }],
      },
    ],
    [
      'turns a Title-case skill level into the enum',
      UpdateDietaryProfileDocument,
      { cookingSkillLevel: 'Intermediate' },
      { cookingSkillLevel: 'INTERMEDIATE' },
    ],
    [
      "names an inline item's category by reference",
      CreatePantryItemDocument,
      {
        id: 'p1',
        pantryId: 'pan1',
        item: { name: 'Kefir', category: 'Dairy' },
      },
      {
        id: 'p1',
        pantryId: 'pan1',
        item: { inline: { name: 'Kefir', category: { name: 'Dairy' } } },
      },
    ],
    [
      'moves a restriction under its kind',
      AddDietaryRestrictionDocument,
      { intolerance: 'GLUTEN', severity: 'ALLERGY' },
      { kind: { intolerance: 'GLUTEN' }, severity: 'ALLERGY' },
    ],
    [
      'sends a date of birth as the calendar date it named',
      UpdateUserProfileDocument,
      { dateOfBirth: '1990-01-15T00:00:00.000Z' },
      { dateOfBirth: '1990-01-15' },
    ],
  ])('%s', (_, document, input, expected) => {
    expect(withCurrentInput(document, { input })).toEqual({ input: expected });
  });

  it('states a use as an amount', () => {
    expect(
      withCurrentInput(CreatePantryItemUsageDocument, {
        input: { pantryItemId: 'p1', quantityUsed: 2, purpose: 'COOKING' },
      }).input,
    ).toEqual({
      pantryItemId: 'p1',
      amount: { quantity: 2 },
      purpose: 'COOKING',
    });
    expect(
      withCurrentInput(CreatePantryItemUsageDocument, {
        input: { pantryItemId: 'p1', consumeAll: true, purpose: 'COOKING' },
      }).input,
    ).toEqual({
      pantryItemId: 'p1',
      amount: { all: true },
      purpose: 'COOKING',
    });
  });

  // The API removes `itemName`; a line queued with it would be refused.
  it('sends a shopping line’s typed name inline, under an item id minted for it', () => {
    const { input } = withCurrentInput(AddItemToShoppingListDocument, {
      input: {
        shoppingListId: 'l1',
        items: [
          { id: 's1', item: { itemName: 'Milk' } },
          { id: 's2', item: { itemName: 'Eggs' } },
        ],
      },
    });

    expect(input).toEqual({
      shoppingListId: 'l1',
      items: [
        {
          id: 's1',
          item: { inline: { id: expect.any(String), name: 'Milk' } },
        },
        {
          id: 's2',
          item: { inline: { id: expect.any(String), name: 'Eggs' } },
        },
      ],
    });
    const [milk, eggs] = (
      input as { items: { item: { inline: { id: string } } }[] }
    ).items;
    expect(milk?.item.inline.id).not.toBe(eggs?.item.inline.id);
  });

  // A queued move or restock from before the shared stock amount: the API now
  // refuses the old fields, so each is restated as a measured amount.
  it('states a queued move and restock as a measured amount', () => {
    expect(
      withCurrentInput(MoveShoppingItemToPantryDocument, {
        input: {
          shoppingListItemId: 'sli1',
          pantryId: 'pan1',
          actualQuantity: 2,
          actualUnitId: 'u-pc',
          packageSize: { netWeight: 22, netWeightUnitId: 'u-oz' },
          actualPrice: 1.5,
        },
      }).input,
    ).toEqual({
      shoppingListItemId: 'sli1',
      pantryId: 'pan1',
      amount: { measured: { quantity: 2, unitId: 'u-pc' } },
      actualPrice: 1.5,
    });
    expect(
      withCurrentInput(RestockPantryItemDocument, {
        input: { id: 'p1', quantity: 1 },
      }).input,
    ).toEqual({ id: 'p1', amount: { measured: { quantity: 1 } } });
  });

  it.each([
    [
      'an add naming a barcode record',
      CreatePantryItemDocument,
      { id: 'p1', pantryId: 'pan1', item: { variation: 'var1' } },
    ],
    [
      'a write already in the new shape',
      CreatePantryItemDocument,
      { id: 'p1', pantryId: 'pan1', item: { id: 'cat1' } },
    ],
    [
      'an input type it does not rewrite',
      MarkRecipeAsCookedDocument,
      { recipeId: 'r1', unit: { unitId: 'u1' } },
    ],
    [
      'a move already stating an amount',
      MoveShoppingItemToPantryDocument,
      { shoppingListItemId: 'sli1', amount: { packages: { count: 2 } } },
    ],
  ])('leaves %s alone', (_, document, input) => {
    const variables = { input };
    expect(withCurrentInput(document, variables)).toBe(variables);
  });
});

// An invite's expiry is still an instant.
const InviteDocument = parse(
  'mutation Invite($input: InviteToShoppingListInput!) { inviteToShoppingList(input: $input) { __typename } }',
);

describe('an expiry stored as an instant', () => {
  it.each([
    [
      'replays a queued local-midnight instant as that local day',
      new Date(2026, 8, 21).toISOString(),
      '2026-09-21',
    ],
    ['keeps a cleared expiry cleared', null, null],
  ])('%s', (_, expiresAt, expiresOn) => {
    expect(
      withCurrentInput(RestockPantryItemDocument, {
        input: { id: 'p1', expiresAt },
      }),
    ).toEqual({ input: { id: 'p1', expiresOn } });
  });

  it.each([
    [
      'a write that already sends expiresOn',
      RestockPantryItemDocument,
      { id: 'p1', expiresOn: '2026-09-21' },
    ],
    [
      'an input whose expiresAt did not move',
      InviteDocument,
      { listId: 'l1', expiresAt: '2026-09-21T10:00:00.000Z' },
    ],
  ])('leaves %s alone', (_, document, input) => {
    const variables = { input };
    expect(withCurrentInput(document, variables)).toBe(variables);
  });
});

describe('a meal-plan day stored as an instant', () => {
  // The previous build sent a day as local noon, whose local day is the pick.
  const localNoon = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12).toISOString();

  it.each([
    [
      'replays a queued meal instant as the local day it stood for',
      CreateMealPlanItemDocument,
      { id: 'meal-1', mealPlanId: 'plan-1', date: localNoon(2026, 8, 21) },
      { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    ],
    [
      'replays both ends of a queued plan as days',
      CreateMealPlanDocument,
      {
        id: 'plan-1',
        startDate: localNoon(2026, 8, 21),
        endDate: localNoon(2026, 8, 27),
      },
      { id: 'plan-1', startDate: '2026-09-21', endDate: '2026-09-27' },
    ],
  ])('%s', (_, document, input, expected) => {
    expect(withCurrentInput(document, { input })).toEqual({ input: expected });
  });

  it.each([
    [
      'a write that already sends a day',
      CreateMealPlanItemDocument,
      { id: 'meal-1', mealPlanId: 'plan-1', date: '2026-09-21' },
    ],
    // `expiresAt` on a restock is another input's field: not this rewrite's.
    [
      'an input that holds no plan day',
      RestockPantryItemDocument,
      { id: 'p1', date: localNoon(2026, 8, 21) },
    ],
  ])('leaves %s alone', (_, document, input) => {
    const variables = { input };
    expect(withCurrentInput(document, variables)).toBe(variables);
  });
});
