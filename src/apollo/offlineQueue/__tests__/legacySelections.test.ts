/**
 * A write queued by the build before the mutation-payload cutover stores a
 * document selecting fields the API has since removed. The server refuses the
 * whole document for one of them, so the queue drops them when it loads — from
 * the payload that removed them only, as another type may still offer the name.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildSchema,
  Kind,
  parse,
  print,
  validate,
  visit,
  type ASTNode,
  type DefinitionNode,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
} from 'graphql';
import { SRC, authoredMutations, walk } from '#/test-utils/queueableOperations';
import { withoutRemovedFields } from '#/apollo/offlineQueue/legacySelections';

const SCHEMA_FILE = path.resolve(
  __dirname,
  '../../../graphql/generated/schema.graphql',
);

const schema = buildSchema(fs.readFileSync(SCHEMA_FILE, 'utf8'));

// Without token locations, which are circular and fail a worker's report.
const parseStored = (source: string) => parse(source, { noLocation: true });

const errorsAfterRewrite = (source: string) =>
  validate(schema, withoutRemovedFields(parseStored(source))).map(
    e => e.message,
  );

const isFragment = (
  definition: DefinitionNode,
): definition is FragmentDefinitionNode =>
  definition.kind === Kind.FRAGMENT_DEFINITION;

const authoredFragments = new Map(
  walk(SRC, name => name.endsWith('.graphql'))
    .filter(file => file !== SCHEMA_FILE)
    .flatMap(file => parseStored(fs.readFileSync(file, 'utf8')).definitions)
    .filter(isFragment)
    .map(fragment => [fragment.name.value, fragment] as const),
);

/** The mutation as the queue stores it: with every fragment it spreads. */
function storedDocument(operation: OperationDefinitionNode): DocumentNode {
  const spread = new Map<string, FragmentDefinitionNode>();
  const collect = (node: ASTNode) => {
    visit(node, {
      FragmentSpread: ({ name }) => {
        const fragment = authoredFragments.get(name.value);
        if (fragment && !spread.has(name.value)) {
          spread.set(name.value, fragment);
          collect(fragment);
        }
      },
    });
  };
  collect(operation);
  return parseStored(
    print({
      kind: Kind.DOCUMENT,
      definitions: [operation, ...spread.values()],
    }),
  );
}

describe('withoutRemovedFields', () => {
  it('drops a batch line’s old failure fields and keeps an error member’s code', () => {
    const stored = parseStored(`
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

    expect(validate(schema, parseStored(replayed))).toEqual([]);
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

  it('drops a removed field a fragment on its payload selects', () => {
    expect(
      errorsAfterRewrite(`
        mutation MovePurchasedItemsToPantry(
          $input: MovePurchasedItemsToPantryInput!
        ) {
          movePurchasedItemsToPantry(input: $input) { __typename ...Moved }
        }
        fragment Moved on MovePurchasedItemsToPantryPayload {
          movedItems { shoppingListItemId }
          summary { succeeded }
        }
      `),
    ).toEqual([]);
  });

  it.each([
    [
      'a consumption’s failed lines',
      `mutation ConfirmRecipeConsumption($input: ConfirmRecipeConsumptionInput!) {
        confirmRecipeConsumption(input: $input) {
          __typename
          ... on ConfirmRecipeConsumptionPayload {
            failedItems { recipeIngredientId code errorId }
          }
        }
      }`,
    ],
    [
      'a low-stock add’s lines',
      `mutation AddLowStock($input: AddLowStockItemsToShoppingListInput!) {
        addLowStockItemsToShoppingList(input: $input) {
          __typename
          ... on AddLowStockItemsToShoppingListPayload {
            addedItems { shoppingListItemId }
            skippedItems { pantryItemId code }
          }
        }
      }`,
    ],
    [
      'a stack’s ledger total',
      `mutation UpdatePantryItem($input: UpdatePantryItemInput!) {
        updatePantryItem(input: $input) {
          __typename
          ... on UpdatePantryItemPayload {
            pantryItem { id ledger { totalAdded } }
          }
        }
      }`,
    ],
    [
      'a ledger fragment’s total',
      `mutation UpdatePantryItem($input: UpdatePantryItemInput!) {
        updatePantryItem(input: $input) {
          __typename
          ... on UpdatePantryItemPayload {
            pantryItem { id ledger { ...StackLedger } }
          }
        }
      }
      fragment StackLedger on LedgerSummary { totalAdded }`,
    ],
  ])('keeps %s, a live field another payload dropped', (_, source) => {
    const stored = parseStored(source);

    expect(validate(schema, stored)).toEqual([]);
    expect(withoutRemovedFields(stored)).toBe(stored);
  });

  it.each([...authoredMutations()])(
    'returns the current %s untouched',
    (_, operation) => {
      const stored = storedDocument(operation);

      expect(withoutRemovedFields(stored)).toBe(stored);
    },
  );
});
