import { readFileSync } from 'fs';
import { join } from 'path';
import { queuedSubject } from '../queuedSubject';
import {
  AddRecipeToFavoritesDocument,
  ForkRecipeDocument,
  UpdateFavoriteRecipeDocument,
} from '#features/recipes/graphql/recipe.generated';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UpdatePantryItemQuantityDocument } from '#features/pantry/graphql/pantry.generated';
import { UpdateDietaryProfileDocument } from '#operations/user/user.generated';
import {
  CreatePantryItemDocument,
  DeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';

describe('queuedSubject', () => {
  it('reads a fork as creating the new recipe and deriving from the source', () => {
    expect(
      queuedSubject({
        mutation: ForkRecipeDocument,
        variables: { input: { id: 'recipe-src', newRecipeId: 'recipe-fork' } },
      }),
    ).toEqual({
      subjectIds: ['recipe-fork'],
      sourceIds: ['recipe-src'],
      mintedIds: ['recipe-fork'],
    });
  });

  it.each([
    [
      'a move names the row it moves',
      MoveShoppingListItemDocument,
      { itemId: 'row-1', afterItemId: 'row-0' },
      ['row-1'],
      [],
    ],
    [
      'a quantity update names the pantry item',
      UpdatePantryItemQuantityDocument,
      { pantryItemId: 'pi-1', quantity: '2' },
      ['pi-1'],
      [],
    ],
    [
      'a batch add names every row it mints',
      AddItemToShoppingListDocument,
      { shoppingListId: 'list-1', items: [{ id: 'row-a' }, { id: 'row-b' }] },
      ['row-a', 'row-b'],
      ['row-a', 'row-b'],
    ],
    [
      'an entity input names itself by id',
      DeletePantryItemDocument,
      { id: 'pi-9' },
      ['pi-9'],
      [],
    ],
  ])('%s', (_label, mutation, input, expected, minted) => {
    expect(queuedSubject({ mutation, variables: { input } })).toEqual({
      subjectIds: expected,
      sourceIds: [],
      mintedIds: minted,
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

  it('gives a saved-recipe edit no subject, so its refusal never evicts the recipe it names', () => {
    expect(
      queuedSubject({
        mutation: UpdateFavoriteRecipeDocument,
        variables: { input: { recipeId: 'recipe-1', notes: 'less salt' } },
      }),
    ).toEqual({ subjectIds: [], sourceIds: [], mintedIds: [] });
  });

  // The field names are typed against codegen; the input-type names are keys
  // the typechecker cannot see. A misspelt one never matches and falls to `id`.
  it('names only input types the schema declares', () => {
    const read = (path: string) =>
      readFileSync(join(process.cwd(), path), 'utf8');
    const schema = read('src/graphql/generated/schema.graphql');
    const table = /const SUBJECT_KEYS[^=]*=\s*\{([^}]*)\}/.exec(
      read('src/apollo/offlineQueue/queuedSubject.ts'),
    )?.[1];
    const names = [...(table ?? '').matchAll(/^\s*(\w+):/gm)].flatMap(m =>
      m[1] ? [m[1]] : [],
    );
    expect(names.length).toBeGreaterThan(5);
    const undeclared = names.filter(
      name => !new RegExp(`^input ${name} \\{`, 'm').test(schema),
    );
    expect(undeclared).toEqual([]);
  });

  it('gives an input with no subject field no subject', () => {
    expect(
      queuedSubject({
        mutation: UpdateDietaryProfileDocument,
        variables: { input: { mealsPerDay: 3 } },
      }),
    ).toEqual({ subjectIds: [], sourceIds: [], mintedIds: [] });
  });
});

describe('which subjects the server has never seen', () => {
  // `unconfirmedCreates` and the connection merges ask "does the server have
  // this row yet?". A pending usage or quantity change names a row it owns.
  it('does not count a row a pending quantity change names', () => {
    const subject = queuedSubject({
      mutation: UpdatePantryItemQuantityDocument,
      variables: { input: { pantryItemId: 'pi-owned', quantity: 2 } },
    });
    expect(subject.subjectIds).toEqual(['pi-owned']);
    expect(subject.mintedIds).toEqual([]);
  });

  it('counts the id a create minted', () => {
    const subject = queuedSubject({
      mutation: CreatePantryItemDocument,
      variables: { input: { id: 'pi-new', itemName: 'Oats' } },
    });
    expect(subject.mintedIds).toEqual(['pi-new']);
  });

  it('counts the saved-recipe id a favourite minted', () => {
    const subject = queuedSubject({
      mutation: AddRecipeToFavoritesDocument,
      variables: { input: { id: 'saved-new', recipeId: 'recipe-1' } },
    });
    expect(subject.mintedIds).toEqual(['saved-new']);
  });

  it('does not count the row an update names', () => {
    const subject = queuedSubject({
      mutation: DeletePantryItemDocument,
      variables: { input: { id: 'pi-owned' } },
    });
    expect(subject.mintedIds).toEqual([]);
  });
});
