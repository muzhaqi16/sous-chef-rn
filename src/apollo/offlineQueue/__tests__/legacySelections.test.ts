/**
 * A write queued by the build before the mutation-payload cutover stores a
 * document selecting fields the API has since removed. The server refuses the
 * whole document for one of them, so the queue drops them when it loads.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildSchema, parse, print, validate } from 'graphql';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { withoutRemovedFields } from '#/apollo/offlineQueue/legacySelections';

const schema = buildSchema(
  fs.readFileSync(
    path.resolve(__dirname, '../../../graphql/generated/schema.graphql'),
    'utf8',
  ),
);

const errorsAfterRewrite = (source: string) =>
  validate(schema, withoutRemovedFields(parse(source))).map(e => e.message);

describe('withoutRemovedFields', () => {
  it('drops a batch line’s old failure fields and keeps an error member’s code', () => {
    const stored = parse(`
      mutation AddItemToShoppingList($input: AddItemsToShoppingListInput!) {
        addItemsToShoppingList(input: $input) {
          __typename
          ... on AddItemsToShoppingListPayload {
            results { index success code quantityIncremented error item { id } }
          }
          ... on Error { code message }
        }
      }
    `);

    const replayed = print(withoutRemovedFields(stored));

    expect(validate(schema, parse(replayed))).toEqual([]);
    expect(replayed).not.toMatch(/quantityIncremented|\berror\b/);
    expect(replayed).toMatch(/\.\.\. on Error \{\s+code/);
  });

  it('drops the recipe add’s old lists and the fragment only they spread', () => {
    expect(
      errorsAfterRewrite(`
        mutation CreateShoppingListItemsFromRecipe(
          $input: CreateShoppingListItemsFromRecipeInput!
        ) {
          createShoppingListItemsFromRecipe(input: $input) {
            __typename
            ... on CreateShoppingListItemsFromRecipePayload {
              addedItems { id ...Added }
              updatedItems { id ...Added }
              totalAdded
              totalUpdated
              totalSkipped
            }
          }
        }
        fragment Added on ShoppingListItem { id itemName }
      `),
    ).toEqual([]);
  });

  it('drops the batch move’s old line lists', () => {
    expect(
      errorsAfterRewrite(`
        mutation MovePurchasedItemsToPantry(
          $input: MovePurchasedItemsToPantryInput!
        ) {
          movePurchasedItemsToPantry(input: $input) {
            __typename
            ... on MovePurchasedItemsToPantryPayload {
              movedItems { shoppingListItemId }
              failedItems { itemName code errorId }
              summary { succeeded failed skipped }
            }
          }
        }
      `),
    ).toEqual([]);
  });

  it('returns a current document untouched', () => {
    expect(withoutRemovedFields(AddItemToShoppingListDocument)).toBe(
      AddItemToShoppingListDocument,
    );
  });
});
