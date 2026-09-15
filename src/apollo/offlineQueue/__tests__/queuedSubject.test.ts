import { queuedSubject } from '../queuedSubject';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { UpdateDietaryProfileDocument } from '#operations/user/user.generated';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';

describe('queuedSubject', () => {
  it('reads a fork as creating the new recipe and deriving from the source', () => {
    expect(
      queuedSubject({
        mutation: ForkRecipeDocument,
        variables: { input: { id: 'recipe-src', newRecipeId: 'recipe-fork' } },
      }),
    ).toEqual({ subjectIds: ['recipe-fork'], sourceIds: ['recipe-src'] });
  });

  it.each([
    [
      'a move names the row it moves',
      MoveShoppingListItemDocument,
      { itemId: 'row-1', afterItemId: 'row-0' },
      ['row-1'],
    ],
    [
      'a quantity update names the pantry item',
      UpdatePantryItemQuantityDocument,
      { pantryItemId: 'pi-1', quantity: '2' },
      ['pi-1'],
    ],
    [
      'a batch add names every row it mints',
      AddItemToShoppingListDocument,
      { shoppingListId: 'list-1', items: [{ id: 'row-a' }, { id: 'row-b' }] },
      ['row-a', 'row-b'],
    ],
    [
      'an entity input names itself by id',
      DeletePantryItemDocument,
      { id: 'pi-9' },
      ['pi-9'],
    ],
  ])('%s', (_label, mutation, input, expected) => {
    expect(queuedSubject({ mutation, variables: { input } })).toEqual({
      subjectIds: expected,
      sourceIds: [],
    });
  });

  it('never takes a parent reference as the subject', () => {
    expect(
      queuedSubject({
        mutation: AddItemToShoppingListDocument,
        variables: { input: { shoppingListId: 'list-1', items: [] } },
      }).subjectIds,
    ).toEqual([]);
  });

  it('gives an input with no subject field no subject', () => {
    expect(
      queuedSubject({
        mutation: UpdateDietaryProfileDocument,
        variables: { input: { mealsPerDay: 3 } },
      }),
    ).toEqual({ subjectIds: [], sourceIds: [] });
  });
});
