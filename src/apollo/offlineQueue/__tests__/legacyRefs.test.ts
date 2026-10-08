import {
  CorrectPantryItemPackageSizeDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  UpdatePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
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
import { RestockPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { withRefInputs } from '../legacyRefs';

/**
 * A write queued before the `@oneOf` references shipped replays after the
 * upgrade. The API refuses the old shape before any resolver runs, so an entry
 * not rewritten on load is a write lost.
 */
describe('withRefInputs', () => {
  it('names a pantry create’s catalog item through `item`', () => {
    expect(
      withRefInputs(CreatePantryItemDocument, {
        input: { id: 'p1', pantryId: 'pan1', itemId: 'cat1' },
      }),
    ).toEqual({ input: { id: 'p1', pantryId: 'pan1', item: { id: 'cat1' } } });
  });

  it('wraps an inline item, each of its units by reference', () => {
    const { input } = withRefInputs(CreatePantryItemDocument, {
      input: {
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
    });

    expect(input).toEqual({
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
    });
  });

  it('moves a pantry edit’s storage location and brand onto references', () => {
    expect(
      withRefInputs(UpdatePantryItemDocument, {
        input: {
          id: 'p1',
          version: 3,
          storage: { storageState: 'FROZEN', storageLocationName: 'Garage' },
          brand: { brandId: null },
        },
      }),
    ).toEqual({
      input: {
        id: 'p1',
        version: 3,
        storage: { storageState: 'FROZEN', location: { name: 'Garage' } },
        brand: null,
      },
    });
  });

  it('states a use as an amount', () => {
    expect(
      withRefInputs(CreatePantryItemUsageDocument, {
        input: { pantryItemId: 'p1', quantityUsed: 2, purpose: 'COOKING' },
      }).input,
    ).toEqual({
      pantryItemId: 'p1',
      amount: { quantity: 2 },
      purpose: 'COOKING',
    });
    expect(
      withRefInputs(CreatePantryItemUsageDocument, {
        input: { pantryItemId: 'p1', consumeAll: true, purpose: 'COOKING' },
      }).input,
    ).toEqual({
      pantryItemId: 'p1',
      amount: { all: true },
      purpose: 'COOKING',
    });
  });

  it('nests a package-size correction', () => {
    const packageSize = { netWeight: 500, netWeightUnitId: 'g' };
    expect(
      withRefInputs(CorrectPantryItemPackageSizeDocument, {
        input: { batchId: 'b1', packageSize, reason: 'label', version: 1 },
      }).input,
    ).toEqual({
      batchId: 'b1',
      correction: { packageSize },
      reason: 'label',
      version: 1,
    });
  });

  it('keeps a shopping line’s typed unit name as its label beside the id', () => {
    expect(
      withRefInputs(AddItemToShoppingListDocument, {
        input: {
          shoppingListId: 'l1',
          items: [
            {
              id: 's1',
              item: { itemName: 'Milk' },
              unit: { unitId: 'u1', unitName: 'cartons' },
              brand: { brandId: 'b1', brandName: 'Acme' },
            },
          ],
        },
      }).input,
    ).toEqual({
      shoppingListId: 'l1',
      items: [
        {
          id: 's1',
          item: { itemName: 'Milk' },
          unit: { id: 'u1' },
          unitLabel: 'cartons',
          brand: { id: 'b1' },
        },
      ],
    });
  });

  it('clears a shopping line’s unit an edit emptied', () => {
    expect(
      withRefInputs(UpdateShoppingListItemDocument, {
        input: { id: 's1', unit: { unitName: '' } },
      }).input,
    ).toEqual({ id: 's1', unit: null });
  });

  it('sends the purchased-move hints under their new name', () => {
    const hints = [{ shoppingListItemId: 's1', pantryItemId: 'p1' }];
    expect(
      withRefInputs(MovePurchasedItemsToPantryDocument, {
        input: { shoppingListId: 'l1', pantryItemIds: hints },
      }).input,
    ).toEqual({ shoppingListId: 'l1', pantryItemHints: hints });
  });

  it('turns a Title-case skill level into the enum', () => {
    expect(
      withRefInputs(UpdateDietaryProfileDocument, {
        input: { cookingSkillLevel: 'Intermediate' },
      }).input,
    ).toEqual({ cookingSkillLevel: 'INTERMEDIATE' });
  });

  it("names an inline item's category by reference", () => {
    expect(
      withRefInputs(CreatePantryItemDocument, {
        input: {
          id: 'p1',
          pantryId: 'pan1',
          item: { name: 'Kefir', category: 'Dairy' },
        },
      }).input,
    ).toEqual({
      id: 'p1',
      pantryId: 'pan1',
      item: { inline: { name: 'Kefir', category: { name: 'Dairy' } } },
    });
  });

  it('moves a restriction under its kind', () => {
    expect(
      withRefInputs(AddDietaryRestrictionDocument, {
        input: { intolerance: 'GLUTEN', severity: 'ALLERGY' },
      }).input,
    ).toEqual({ kind: { intolerance: 'GLUTEN' }, severity: 'ALLERGY' });
  });

  it('sends a date of birth as the calendar date it named', () => {
    expect(
      withRefInputs(UpdateUserProfileDocument, {
        input: { dateOfBirth: '1990-01-15T00:00:00.000Z' },
      }).input,
    ).toEqual({ dateOfBirth: '1990-01-15' });
  });

  it('leaves an add naming a barcode record alone', () => {
    const variables = {
      input: { id: 'p1', pantryId: 'pan1', item: { variation: 'var1' } },
    };
    expect(withRefInputs(CreatePantryItemDocument, variables)).toBe(variables);
  });

  it('leaves a write already in the new shape alone', () => {
    const variables = {
      input: { id: 'p1', pantryId: 'pan1', item: { id: 'cat1' } },
    };
    expect(withRefInputs(CreatePantryItemDocument, variables)).toBe(variables);
  });

  it('leaves an input type it does not rewrite alone', () => {
    const variables = { input: { recipeId: 'r1', unit: { unitId: 'u1' } } };
    expect(withRefInputs(MarkRecipeAsCookedDocument, variables)).toBe(
      variables,
    );
  });

  // A queued move or restock from before the shared stock amount: the API now
  // refuses the old fields, so each is restated as a measured amount.
  it('states a queued move and restock as a measured amount', () => {
    expect(
      withRefInputs(MoveShoppingItemToPantryDocument, {
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
      withRefInputs(RestockPantryItemDocument, {
        input: { id: 'p1', quantity: 1 },
      }).input,
    ).toEqual({ id: 'p1', amount: { measured: { quantity: 1 } } });
  });

  it('leaves a move already stating an amount alone', () => {
    const variables = {
      input: { shoppingListItemId: 'sli1', amount: { packages: { count: 2 } } },
    };
    expect(withRefInputs(MoveShoppingItemToPantryDocument, variables)).toBe(
      variables,
    );
  });
});
