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
import { graphql, print, Kind, type DocumentNode } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { gql } from '@apollo/client';
import type { Unmasked } from '@apollo/client/masking';
import {
  UnitType,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import { convertToSyncMutation } from '#/apollo/offlineQueue/convertToSyncMutation';
import { QueueStatus } from '#/apollo/offlineQueue/types';
import {
  GetPantryDocument,
  GetPantryItemDocument,
  GetPantryItemBatchesDocument,
  CreatePantryItemDocument,
  SyncPantryItemDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  GetShoppingListItemsFilteredDocument,
  GetShoppingListDetailsDocument,
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
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { addToPantryItemsCache } from '#/apollo/utils/pantryCacheUpdaters';
import { AddedShoppingListItemFieldsFragmentDoc } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  addOptimisticShoppingListItem,
  addNewItemToShoppingListCache,
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

    // The LIST cases above are the only completeness this file ever asserted,
    // which is exactly why the DETAIL gap survived: an optimistic item was
    // list-complete and detail-incomplete, so tapping a freshly created row
    // sent `GetPantryItem` to a server that had no such id yet. Offline that
    // has no recovery at all.
    describe('detail queries', () => {
      it('keeps GetPantryItem complete after an optimistic add', async () => {
        const cache = await seedPantryCache();
        addToPantryItemsCache(
          cache,
          'pantry-1',
          buildOptimisticPantryItem(
            'client-cuid-detail',
            {
              pantryId: 'pantry-1',
              itemName: 'Offline Milk',
              quantity: 2,
            },
            cache,
          ),
        );
        writePantryItemDetailStub(cache, 'client-cuid-detail', {
          itemName: 'Offline Milk',
          quantity: 2,
        });

        const diff = cache.diff({
          query: GetPantryItemDocument,
          variables: { id: 'client-cuid-detail' },
          optimistic: true,
          returnPartialData: true,
        });
        expect(describeMissing(diff.missing)).toBe('none');
        expect(diff.complete).toBe(true);
      });

      it('keeps GetPantryItem complete for a row carrying a unit', async () => {
        // The regression this case exists for. `buildOptimisticPantryItem`
        // embeds the unit through `toReference(unit, true)` with the five
        // fields the LIST selects, while `PantryItemDetail_pantryItem` selects
        // eleven — so `cache.diff` came back
        // `Can't find field 'isMetric' on object { __typename: Unit, … }` and
        // the detail screen was blank offline for the rest of the session.
        //
        // It bites precisely when the Unit IS well cached, which is why every
        // case above — none of which passes a `unitId` — stayed green.
        const cache = await seedPantryCache();
        cache.writeFragment({
          id: 'Unit:unit-1',
          fragment: gql`
            fragment _SeedListShapedUnit on Unit {
              id
              name
              symbol
              type
              displayAsFraction
            }
          `,
          data: {
            __typename: 'Unit',
            id: 'unit-1',
            name: 'gram',
            symbol: 'g',
            type: 'WEIGHT',
            displayAsFraction: false,
          },
        });

        addToPantryItemsCache(
          cache,
          'pantry-1',
          buildOptimisticPantryItem(
            'client-cuid-unit',
            {
              pantryId: 'pantry-1',
              itemName: 'Offline Flour',
              quantity: 2,
              unitId: 'unit-1',
            },
            cache,
          ),
        );
        writePantryItemDetailStub(cache, 'client-cuid-unit', {
          itemName: 'Offline Flour',
          quantity: 2,
        });

        const diff = cache.diff({
          query: GetPantryItemDocument,
          variables: { id: 'client-cuid-unit' },
          optimistic: true,
          returnPartialData: true,
        });
        expect(describeMissing(diff.missing)).toBe('none');
        expect(diff.complete).toBe(true);
      });

      it('keeps GetPantryItemBatches complete after an optimistic add', async () => {
        const cache = await seedPantryCache();
        addToPantryItemsCache(
          cache,
          'pantry-1',
          buildOptimisticPantryItem(
            'client-cuid-batches',
            { pantryId: 'pantry-1', itemName: 'Offline Milk', quantity: 1 },
            cache,
          ),
        );
        writePantryItemDetailStub(cache, 'client-cuid-batches', {
          itemName: 'Offline Milk',
          quantity: 1,
        });

        const diff = cache.diff({
          query: GetPantryItemBatchesDocument,
          variables: { pantryItemId: 'client-cuid-batches' },
          optimistic: true,
          returnPartialData: true,
        });
        expect(describeMissing(diff.missing)).toBe('none');
        expect(diff.complete).toBe(true);
      });

      // The stub supplies neutral values for catalog fields the client cannot
      // know. It must never supply them for an item that HAS them: the user
      // usually picks from the catalog, and defaulting `photos`/`nutritions`
      // onto a real `Item` would blank the detail screen's carousel and
      // nutrition panel until a refetch. Group-at-a-time reads are what make
      // that safe, so this is the test that keeps the grouping honest.
      it('never overwrites catalog fields an Item already has', async () => {
        const cache = await seedPantryCache();
        const realItem = {
          __typename: 'Item' as const,
          id: 'catalog-item-1',
          name: 'Whole Milk',
          canEdit: true,
          imageUrl: 'https://example.test/milk.png',
          images: [
            { __typename: 'ItemImage' as const, url: 'https://a', kind: null },
          ],
          photos: [
            {
              __typename: 'ItemPhoto' as const,
              id: 'photo-1',
              url: 'https://p',
              perspective: 'FRONT',
              isPrimary: true,
              status: 'READY',
              variants: [],
            },
          ],
          shelfLifeDays: 7,
          shelfLifeOpenedDays: 3,
          nutritions: { calories: 42 },
          categories: [
            {
              __typename: 'ItemCategory' as const,
              isPrimary: true,
              category: {
                __typename: 'Category' as const,
                id: 'cat-1',
                name: 'Dairy',
              },
            },
          ],
        };
        cache.writeFragment({
          id: cache.identify(realItem),
          fragment: gql`
            fragment _SeedCatalogItem on Item {
              id
              name
              canEdit
              imageUrl
              images { url kind }
              photos { id url perspective isPrimary status variants { url kind } }
              shelfLifeDays
              shelfLifeOpenedDays
              nutritions
              categories { isPrimary category { id name } }
            }
          `,
          data: realItem,
        });

        addToPantryItemsCache(
          cache,
          'pantry-1',
          buildOptimisticPantryItem(
            'client-cuid-catalog',
            {
              pantryId: 'pantry-1',
              itemName: 'Whole Milk',
              itemId: 'catalog-item-1',
              quantity: 1,
            },
            cache,
          ),
        );
        writePantryItemDetailStub(cache, 'client-cuid-catalog', {
          itemId: 'catalog-item-1',
          itemName: 'Whole Milk',
        });

        const diff = cache.diff<{
          pantryItem: { item: typeof realItem } | null;
        }>({
          query: GetPantryItemDocument,
          variables: { id: 'client-cuid-catalog' },
          optimistic: true,
          returnPartialData: true,
        });
        expect(diff.complete).toBe(true);

        const readItem = diff.result?.pantryItem?.item;
        expect(readItem?.name).toBe('Whole Milk');
        expect(readItem?.canEdit).toBe(true);
        expect(readItem?.imageUrl).toBe('https://example.test/milk.png');
        expect(readItem?.photos).toHaveLength(1);
        expect(readItem?.shelfLifeDays).toBe(7);
        expect(readItem?.nutritions).toEqual({ calories: 42 });
        expect(readItem?.categories?.[0]?.category?.name).toBe('Dairy');
      });
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

    /**
     * The optimistic builder is not the only writer that CREATES a
     * `ShoppingListItem`. The recipe→list mutation creates them from its own
     * selection, and the purchase record's merge policy backfills omitted
     * fields only when a previous value exists — so a field that selection
     * misses is genuinely absent, the list read goes incomplete, and the whole
     * screen blanks rather than showing a missing value.
     *
     * Written through that mutation's OWN fragment, so a field added to the
     * list query has to reach it too.
     */
    it('keeps GetShoppingListItemsFiltered complete after a recipe-created add', async () => {
      const cache = await seedListCache();

      // Written through the fragment `createShoppingListItemsFromRecipe` now
      // spreads, so this test tracks that selection: narrow it again and the
      // list read goes incomplete here.
      const created = await runAgainstSchema<
        Unmasked<GetShoppingListItemsFilteredQuery>
      >(GetShoppingListItemsFilteredDocument, LIST_VARS);
      const sample =
        created.shoppingList!.itemsConnection!.edges![0]!.node!;

      cache.writeFragment({
        id: 'ShoppingListItem:from-recipe',
        fragment: AddedShoppingListItemFieldsFragmentDoc,
        fragmentName: 'AddedShoppingListItemFields',
        data: {
          ...sample,
          id: 'from-recipe',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            totalItems: 1,
            completedItems: 0,
            remainingItems: 1,
            completionRate: 0,
          },
        } as never,
      });
      addNewItemToShoppingListCache(cache, 'list-1', { id: 'from-recipe' });

      const diff = cache.diff({
        query: GetShoppingListItemsFilteredDocument,
        variables: LIST_VARS,
        optimistic: true,
        returnPartialData: true,
      });
      expect(describeMissing(diff.missing)).toBe('none');
      expect(diff.complete).toBe(true);
    });

    it('keeps GetShoppingListItemsFiltered complete after an optimistic add', async () => {
      const cache = await seedListCache();

      addOptimisticShoppingListItem(
        cache,
        'list-1',
        createOptimisticShoppingListItem('client-cuid-4', {
          shoppingListId: 'list-1',
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

    /**
     * The other direction of completeness, and the one that shipped broken: a
     * row can be COMPLETE for every query that displays it and still be
     * unreplayable, because the offline queue reads a field no display query
     * needs.
     *
     * `ToggleShoppingListItemPurchased` / `UpdateShoppingListItemQuantity` /
     * `UpdateShoppingListItem` send only the row id, so the replay builder has
     * to backfill `SyncShoppingListItemFieldsInput.shoppingListId` by reading
     * `shoppingList { id }` back off the cached row. No query that populates
     * the list selected it, so the read returned null, the builder threw, and
     * the queue withdrew the change — every offline toggle silently reverted on
     * reconnect with "A change couldn't be saved and has been undone".
     *
     * The builder's own tests could not catch it: they stub `readFragment`, so
     * they assert the builder works GIVEN the parent link, never that a real
     * cache holds one. This drives the real cache, seeded by the real list
     * query, through the real dispatch.
     */
    it('can build a toggle replay from a row the list query cached', async () => {
      const cache = await seedListCache();

      const row = cache.readQuery<Unmasked<GetShoppingListItemsFilteredQuery>>({
        query: GetShoppingListItemsFilteredDocument,
        variables: LIST_VARS,
      })?.shoppingList?.itemsConnection.edges[0]?.node;
      // The parent link the builder has to find, read from the same cache the
      // builder reads — so this asserts the round trip, not a literal.
      expect(row?.shoppingList?.id).toBeTruthy();

      const { syncVariables } = convertToSyncMutation(
        {
          id: 'queued-1',
          userId: 'user-1',
          operationName: 'ToggleShoppingListItemPurchased',
          mutation: { kind: Kind.DOCUMENT, definitions: [] },
          variables: { input: { id: row!.id, purchased: true } },
          status: QueueStatus.PENDING,
          createdAt: 0,
          updatedAt: 0,
          retryCount: 0,
          maxRetries: 3,
          requiresAuth: true,
        },
        cache,
      );

      const input = syncVariables.input as { item: { shoppingListId: string } };
      expect(input.item.shoppingListId).toBe(row!.shoppingList!.id);
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

    // The overview fragment and the DETAIL query select different things, so an
    // optimistic row satisfying only the first makes the list appear and then
    // dead-end when opened: Apollo serves no partial data and goes to the
    // network for an id the server does not have yet. 22 fields (status, the
    // recurring/template/reminder/budget groups, canMoveToPantry, shareLink,
    // collaboratorsConnection) come from the detail stub in
    // `addOptimisticShoppingList`.
    it('keeps GetShoppingListDetails complete after an optimistic list create', async () => {
      const cache = makeCache();
      addOptimisticShoppingList(
        cache,
        buildOptimisticShoppingList(
          cache,
          'client-list-detail',
          { name: 'Offline list', homeId: 'home-1' },
          { id: 'user-1', email: 'user@example.com' },
        ),
      );

      const diff = cache.diff({
        query: GetShoppingListDetailsDocument,
        variables: { id: 'client-list-detail' },
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

  describe('notifications', () => {
    // Notifications are never created locally, so there is no optimistic
    // entity here. The same failure mode still reaches them by a different
    // route: a live event writes the entity from the SUBSCRIPTION's fragment
    // and then adds an edge for it to the feed connection. If that fragment
    // selects less than the feed query reads off a node, the new edge points
    // at an incomplete entity — and one incomplete node makes the WHOLE
    // `GetNotifications` read incomplete, so the list goes blank on arrival
    // rather than gaining a row.
    //
    // The two fragments are identical today; nothing but this holds them that
    // way.
    it('the subscription writes every field the feed reads off a node', () => {
      const fieldsOf = (fragmentName: string, file: string): string[] => {
        const source = fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
        const body = source
          .slice(source.indexOf(`fragment ${fragmentName} on Notification {`))
          .split('}')[0];
        return body
          .split('\n')
          .slice(1)
          .map(line => line.replace(/#.*$/, '').trim())
          .filter(Boolean)
          .sort();
      };

      const feedFields = fieldsOf(
        'useNotificationsOnLaunch_notification',
        'src/features/notifications/hooks/useNotificationsOnLaunch.graphql',
      );
      const eventFields = fieldsOf(
        'useNotifications_notification',
        'src/features/notifications/hooks/useNotifications.graphql',
      );

      expect(feedFields.length).toBeGreaterThan(5);
      expect(
        feedFields.filter(field => !eventFields.includes(field)),
      ).toEqual([]);
    });
  });
});
