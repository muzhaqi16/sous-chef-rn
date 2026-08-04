/**
 * Local-first invariant: after an optimistic add, the list query that renders
 * the new row must still read COMPLETE from the cache.
 *
 * Why this matters more than it looks. Apollo has no `returnPartialData` on
 * these hooks, so ONE missing field anywhere in the selection makes `useQuery`
 * hand back no data at all and go to the network:
 *
 *  - Online that is invisible. The background refetch returns the full node a
 *    few hundred ms later and the list repaints.
 *  - Offline there is no refetch. `offlineModeLink` re-reads the same
 *    incomplete cache, reports a miss, and `usePantryQuery`'s
 *    `errorPolicy: 'ignore'` + `usePreservedConnection` re-serve the
 *    PRE-ADD snapshot. The item is queued and replays fine on reconnect, but it
 *    is invisible for the whole offline session — the local-first promise
 *    silently broken, with no error anywhere.
 *
 * That is exactly what shipped: `buildOptimisticPantryItem` never wrote
 * `createdAt`, which `GetPantry` selects on every node.
 *
 * Three writers are covered, because all three produce the entity the list
 * reads:
 *  1. the optimistic entity written before the mutation fires,
 *  2. the mutation's own response shape (`CreatePantryItem`), and
 *  3. the offline queue's replay response (`SyncPantryItem`) — the only one of
 *     the three that lands while still offline, so a field missing there is the
 *     worst case: the row the user added stays invisible until a full network
 *     read. Its fragment carries a comment saying it must remain a superset of
 *     what `GetPantry` reads off a node; this is what holds it to that.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { graphql, print, type DocumentNode } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { gql } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import {
  UnitType,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import {
  GetPantryDocument,
  CreatePantryItemDocument,
  SyncPantryItemDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  GetShoppingListItemsFilteredDocument,
  GetShoppingListsLiteDocument,
  type GetShoppingListItemsFilteredQuery,
  type GetShoppingListsLiteQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  MyRecipesDocument,
  GetRecipeDocument,
  type MyRecipesQuery,
} from '#features/recipes/graphql/recipe.generated';
import { writeOptimisticRecipe } from '#features/recipes/screens/RecipeForm/recipeCacheWriters';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { addToPantryItemsCache } from '#features/pantry/hooks/mutations/utils';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  addOptimisticShoppingList,
  buildOptimisticShoppingList,
} from '#/apollo/utils/shoppingListCacheUpdaters';

const mockedSchema = addMocksToSchema({
  schema: makeExecutableSchema({
    typeDefs: fs.readFileSync(
      path.resolve(__dirname, '../../src/graphql/generated/schema.graphql'),
      'utf8',
    ),
  }),
  // Every field resolves to a value, so an executed operation yields a result
  // that is complete BY CONSTRUCTION for its own selection — the baseline the
  // optimistic entity has to match.
  mocks: {
    ID: () => 'mock-id',
    String: () => 'mock-string',
    Int: () => 1,
    Float: () => 1,
    Boolean: () => true,
    DateTime: () => '2026-01-01T00:00:00.000Z',
    Date: () => '2026-01-01',
    JSON: () => ({}),
    BigInt: () => '1',
    FlexibleQuantity: () => '1',
    // Result unions default to their first member (an error type), which would
    // leave the success inline fragment unmatched and the payload undefined.
    CreatePantryItemResult: () => ({ __typename: 'CreatePantryItemPayload' }),
    SyncPantryItemResult: () => ({ __typename: 'SyncPantryItemPayload' }),
  },
});

/** Adds `__typename` the way InMemoryCache does before reading/writing. */
const typenameTransformer = makeCache();

async function runAgainstSchema<T = Record<string, unknown>>(
  document: DocumentNode,
  variables: Record<string, unknown>,
): Promise<T> {
  const result = await graphql({
    schema: mockedSchema,
    source: print(typenameTransformer.transformDocument(document)),
    variableValues: variables,
  });
  if (result.errors) throw new Error(JSON.stringify(result.errors, null, 2));
  return result.data as T;
}

/** Renders `diff.missing` as a readable assertion message. */
const describeMissing = (missing: unknown): string =>
  missing ? JSON.stringify(missing, null, 2) : 'none';

/** Union of the unit fields every pantry list consumer reads. */
const TestUnitFragment = gql`
  fragment _TestUnit on Unit {
    id
    name
    symbol
    type
    displayAsFraction
  }
`;

const PANTRY_VARS = { id: 'pantry-1', itemsFirst: 50 };
const LIST_VARS = { id: 'list-1', first: 20, isPurchased: false };

async function seedPantryCache() {
  const cache = makeCache();
  // `Unmasked` because writeQuery takes the full shape, fragment spreads
  // included — the masked type hides them behind $fragmentRefs.
  const data = await runAgainstSchema<Unmasked<GetPantryQuery>>(
    GetPantryDocument,
    PANTRY_VARS,
  );
  // The mocked schema resolves every field, so the pantry is always present.
  data.pantry!.id = 'pantry-1';
  cache.writeQuery({ query: GetPantryDocument, variables: PANTRY_VARS, data });
  return cache;
}

const readPantry = (cache: ReturnType<typeof makeCache>) =>
  cache.diff<Unmasked<GetPantryQuery>>({
    query: GetPantryDocument,
    variables: PANTRY_VARS,
    optimistic: true,
    returnPartialData: true,
  });

/**
 * Asserts the diff read complete and hands back the pantry for field-by-field
 * reads. `expect(...).toBe(true)` checks at runtime but doesn't narrow the
 * DiffResult union, and the incomplete arm types every field as optional.
 */
function expectCompletePantry(
  diff: ReturnType<typeof readPantry>,
): NonNullable<Unmasked<GetPantryQuery>['pantry']> {
  expect(describeMissing(diff.missing)).toBe('none');
  expect(diff.complete).toBe(true);
  if (!diff.complete || !diff.result.pantry) {
    throw new Error('pantry diff was incomplete');
  }
  return diff.result.pantry;
}

describe('optimistic entity completeness', () => {
  describe('pantry', () => {
    it('seeded pantry reads complete (baseline)', async () => {
      const cache = await seedPantryCache();
      expect(readPantry(cache).complete).toBe(true);
    });

    it('keeps GetPantry complete after an optimistic add', async () => {
      const cache = await seedPantryCache();

      addToPantryItemsCache(
        cache,
        'pantry-1',
        buildOptimisticPantryItem(
          'client-cuid-1',
          {
            pantryId: 'pantry-1',
            itemName: 'Offline Milk',
            quantity: 2,
          },
          cache,
        ),
      );

      expectCompletePantry(readPantry(cache));
    });

    it('keeps GetPantry complete when the item carries a cached unit', async () => {
      const cache = await seedPantryCache();
      // A unit id at an add site always comes from something already fetched
      // (unit autocomplete, an item's defaultUnit), so model that.
      cache.writeFragment({
        id: cache.identify({ __typename: 'Unit', id: 'unit-1' }),
        fragment: TestUnitFragment,
        fragmentName: '_TestUnit',
        data: {
          __typename: 'Unit',
          id: 'unit-1',
          name: 'liter',
          symbol: 'L',
          type: UnitType.Volume,
          displayAsFraction: false,
        },
      });

      addToPantryItemsCache(
        cache,
        'pantry-1',
        buildOptimisticPantryItem(
          'client-cuid-2',
          {
            pantryId: 'pantry-1',
            itemName: 'Offline Milk',
            quantity: 2,
            unitId: 'unit-1',
          },
          cache,
        ),
      );

      const pantry = expectCompletePantry(readPantry(cache));
      // The cached unit is referenced, not overwritten with placeholders.
      const edge = pantry.itemsConnection.edges.find(
        e => e.node.id === 'client-cuid-2',
      );
      expect(edge?.node.unit?.symbol).toBe('L');
    });

    it('keeps GetPantry complete when the unit is NOT cached', async () => {
      const cache = await seedPantryCache();

      addToPantryItemsCache(
        cache,
        'pantry-1',
        buildOptimisticPantryItem(
          'client-cuid-3',
          {
            pantryId: 'pantry-1',
            itemName: 'Offline Milk',
            unitId: 'never-fetched-unit',
          },
          cache,
        ),
      );

      // No complete Unit to reference → no unit at all, rather than a stub that
      // would strand the read.
      expectCompletePantry(readPantry(cache));
    });

    it('keeps GetPantry complete after the CreatePantryItem response lands', async () => {
      const cache = await seedPantryCache();
      const created = await runAgainstSchema<{
        createPantryItem: { pantryItem: { id: string; pantryId: string } };
        // The mocks resolve every field regardless of the input, so this only
        // has to satisfy the required-variable check.
      }>(CreatePantryItemDocument, { input: { pantryId: 'pantry-1' } });
      const pantryItem = created.createPantryItem.pantryItem;
      pantryItem.id = 'server-item-1';
      pantryItem.pantryId = 'pantry-1';

      addToPantryItemsCache(cache, 'pantry-1', pantryItem);

      expectCompletePantry(readPantry(cache));
    });

    it('keeps GetPantry complete after a SyncPantryItem replay lands', async () => {
      // The offline queue replays a queued create as SyncPantryItem and writes
      // the response back. That happens while the app may still be offline, so
      // a field its fragment omits can't be repaired by a refetch.
      const cache = await seedPantryCache();
      const synced = await runAgainstSchema<{
        syncPantryItem: { item: { id: string; pantryId: string } };
      }>(SyncPantryItemDocument, {
        input: { clientId: 'client-cuid-5', pantryId: 'pantry-1' },
      });
      const item = synced.syncPantryItem.item;
      item.id = 'client-cuid-5';
      item.pantryId = 'pantry-1';

      addToPantryItemsCache(cache, 'pantry-1', item);

      expectCompletePantry(readPantry(cache));
    });
  });

  describe('shopping list', () => {
    const seedListCache = async () => {
      const cache = makeCache();
      const data = await runAgainstSchema<
        Unmasked<GetShoppingListItemsFilteredQuery>
      >(GetShoppingListItemsFilteredDocument, LIST_VARS);
      // The mocked schema resolves every field, so the list is always present.
      data.shoppingList!.id = 'list-1';
      cache.writeQuery({
        query: GetShoppingListItemsFilteredDocument,
        variables: LIST_VARS,
        data,
      });
      // Stats the optimistic updater recomputes; not part of this query.
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' })!,
        fields: {
          totalItems: () => 1,
          completedItems: () => 0,
          remainingItems: () => 1,
          completionRate: () => 0,
        },
      });
      return cache;
    };

    it('keeps GetShoppingListItemsFiltered complete after an optimistic add', async () => {
      const cache = await seedListCache();

      addOptimisticShoppingListItem(
        cache,
        'list-1',
        createOptimisticShoppingListItem('client-cuid-4', {
          itemName: 'Offline Bread',
          quantity: 1,
          category: 'Bakery',
          itemId: 'catalog-1',
          unitId: 'unit-2',
        }),
      );

      const diff = cache.diff({
        query: GetShoppingListItemsFilteredDocument,
        variables: LIST_VARS,
        optimistic: true,
        returnPartialData: true,
      });
      expect(describeMissing(diff.missing)).toBe('none');
      expect(diff.complete).toBe(true);
    });

    it('keeps GetShoppingListsLite complete after an optimistic list create', async () => {
      const cache = makeCache();
      const vars = { homeId: 'home-1', first: 20 };
      const data = await runAgainstSchema<Unmasked<GetShoppingListsLiteQuery>>(
        GetShoppingListsLiteDocument,
        vars,
      );
      cache.writeQuery({
        query: GetShoppingListsLiteDocument,
        variables: vars,
        data,
      });

      addOptimisticShoppingList(
        cache,
        buildOptimisticShoppingList(
          cache,
          'client-list-1',
          { name: 'Offline list', homeId: 'home-1' },
          { id: 'user-1', email: 'user@example.com' },
        ),
      );

      const diff = cache.diff({
        query: GetShoppingListsLiteDocument,
        variables: vars,
        optimistic: true,
        returnPartialData: true,
      });
      expect(describeMissing(diff.missing)).toBe('none');
      expect(diff.complete).toBe(true);
    });
  });

  describe('recipes', () => {
    const RECIPE_INPUT: CreateRecipeInput = {
      id: 'client-recipe-1',
      name: 'Offline Stew',
      instructions: [{ step: 1, text: 'Simmer' }],
      ingredients: [{ name: 'Onion', quantity: 1 }],
    };

    it('keeps MyRecipes complete after an optimistic create', async () => {
      const cache = makeCache();
      const data = await runAgainstSchema<Unmasked<MyRecipesQuery>>(
        MyRecipesDocument,
        {},
      );
      cache.writeQuery({ query: MyRecipesDocument, data });

      writeOptimisticRecipe(cache, 'client-recipe-1', RECIPE_INPUT, null);

      const diff = cache.diff({
        query: MyRecipesDocument,
        variables: {},
        optimistic: true,
        returnPartialData: true,
      });
      expect(describeMissing(diff.missing)).toBe('none');
      expect(diff.complete).toBe(true);
    });

    it('keeps GetRecipe complete after an optimistic create', async () => {
      // GetRecipe spreads useRecipeData_recipe AND RecipeForm_recipe; the
      // create has to materialize both or the detail screen (and the edit form)
      // are blank offline.
      const cache = makeCache();
      writeOptimisticRecipe(cache, 'client-recipe-1', RECIPE_INPUT, null);

      const diff = cache.diff({
        query: GetRecipeDocument,
        variables: { id: 'client-recipe-1' },
        optimistic: true,
        returnPartialData: true,
      });
      expect(describeMissing(diff.missing)).toBe('none');
      expect(diff.complete).toBe(true);
    });
  });
});
