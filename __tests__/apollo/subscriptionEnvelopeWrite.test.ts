/**
 * Why the event subscriptions run with `fetchPolicy: 'no-cache'`.
 *
 * `PantryEvents` and `MyShoppingListsEvents` carry an envelope plus
 * `node { __typename id }`; every handler reads the entity back with a query.
 * Left cacheable, Apollo normalises that node — and a delete has just evicted
 * it: `removeItem` evicts before the mutation fires, and the server pushes the
 * event before the mutation resolves. The write re-creates the entity as a bare
 * `{ id }`. Its connection edge stops dangling (the `itemsConnection` read
 * policy only drops edges whose node is unreadable), the node now lacks every
 * other field the list query selects, and the list's watched result is
 * incomplete — which Apollo repairs with a network refetch. That was one full
 * page refetch per delete.
 *
 * These tests perform the write Apollo would perform, directly against the
 * real cache, and assert the incompleteness — the mechanism, checked without a
 * subscription transport. The hook tests assert the option that prevents it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { graphql, print, type DocumentNode } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import type { Unmasked } from '@apollo/client/masking';
import {
  MutationType,
  PantrySubtype,
  ShoppingListSubtype,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import {
  GetPantryDocument,
  PantryEventsDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  GetShoppingListItemsFilteredDocument,
  MyShoppingListsEventsDocument,
  type GetShoppingListItemsFilteredQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { removeFromPantryItemsCache } from '#features/pantry/cache/items';
import { removeFromShoppingListItemsCache } from '#features/shoppingList/hooks/mutations/utils';

const mockedSchema = addMocksToSchema({
  schema: makeExecutableSchema({
    typeDefs: fs.readFileSync(
      path.resolve(__dirname, '../../src/graphql/generated/schema.graphql'),
      'utf8',
    ),
  }),
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
  },
});

const typenameTransformer = makeCache();

async function runAgainstSchema<T>(
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

const PANTRY_VARS = { id: 'pantry-1', itemsFirst: 50 };
const LIST_VARS = { id: 'list-1', first: 25, isPurchased: false };

async function seedPantry() {
  const cache = makeCache();
  const data = await runAgainstSchema<Unmasked<GetPantryQuery>>(
    GetPantryDocument,
    PANTRY_VARS,
  );
  data.pantry!.id = 'pantry-1';
  cache.writeQuery({ query: GetPantryDocument, variables: PANTRY_VARS, data });
  const itemId = data.pantry!.itemsConnection.edges[0]!.node.id;
  return { cache, itemId };
}

async function seedList() {
  const cache = makeCache();
  const data = await runAgainstSchema<
    Unmasked<GetShoppingListItemsFilteredQuery>
  >(GetShoppingListItemsFilteredDocument, LIST_VARS);
  data.shoppingList!.id = 'list-1';
  cache.writeQuery({
    query: GetShoppingListItemsFilteredDocument,
    variables: LIST_VARS,
    data,
  });
  const itemId = data.shoppingList!.itemsConnection.edges[0]!.node.id;
  return { cache, itemId };
}

const diffPantry = (cache: ReturnType<typeof makeCache>) =>
  cache.diff<Unmasked<GetPantryQuery>>({
    query: GetPantryDocument,
    variables: PANTRY_VARS,
    optimistic: true,
    returnPartialData: true,
  });

const diffList = (cache: ReturnType<typeof makeCache>) =>
  cache.diff<Unmasked<GetShoppingListItemsFilteredQuery>>({
    query: GetShoppingListItemsFilteredDocument,
    variables: LIST_VARS,
    optimistic: true,
    returnPartialData: true,
  });

describe('event envelope written to the cache after a local delete', () => {
  it('pantry: the delete leaves GetPantry complete; a cached PantryEvents node makes it incomplete', async () => {
    const { cache, itemId } = await seedPantry();
    expect(diffPantry(cache).complete).toBe(true);

    // What `removeItem` does before the mutation fires.
    removeFromPantryItemsCache(cache, 'pantry-1', itemId, { evictItem: true });
    expect(cache.extract()[`PantryItem:${itemId}`]).toBeUndefined();
    // The read policy drops the dangling edge, so the list stays complete.
    expect(diffPantry(cache).complete).toBe(true);

    // What Apollo does with a cacheable subscription result.
    cache.write({
      dataId: 'ROOT_SUBSCRIPTION',
      query: PantryEventsDocument,
      variables: { pantryId: 'pantry-1' },
      result: {
        __typename: 'Subscription',
        pantryEvents: {
          __typename: 'PantryEvent',
          originatorClientId: 'device_other',
          actorUserId: 'user-2',
          mutation: MutationType.ItemRemoved,
          subtype: PantrySubtype.ItemChanged,
          pantryId: 'pantry-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          node: { __typename: 'PantryItem', id: itemId },
        },
      },
    });

    // The evicted row is back as a bare `{ id }` …
    expect(cache.extract()[`PantryItem:${itemId}`]).toEqual({
      __typename: 'PantryItem',
      id: itemId,
    });
    // … its edge is readable again, and the list query cannot be satisfied from
    // the cache. This is the state Apollo repairs by refetching.
    expect(diffPantry(cache).complete).toBe(false);
  });

  it('shopping list: the delete leaves the items query complete; a cached MyShoppingListsEvents node makes it incomplete', async () => {
    const { cache, itemId } = await seedList();
    expect(diffList(cache).complete).toBe(true);

    removeFromShoppingListItemsCache(cache, 'list-1', itemId, {
      evictItem: true,
    });
    expect(cache.extract()[`ShoppingListItem:${itemId}`]).toBeUndefined();
    expect(diffList(cache).complete).toBe(true);

    cache.write({
      dataId: 'ROOT_SUBSCRIPTION',
      query: MyShoppingListsEventsDocument,
      result: {
        __typename: 'Subscription',
        myShoppingListsEvents: {
          __typename: 'ShoppingListEvent',
          subtype: ShoppingListSubtype.ItemsChanged,
          mutation: MutationType.ItemRemoved,
          listId: 'list-1',
          originatorClientId: 'device_other',
          actorUserId: 'user-2',
          timestamp: '2026-01-01T00:00:00.000Z',
          updatedFields: [],
          clearedItemIds: [],
          node: { __typename: 'ShoppingListItem', id: itemId },
        },
      },
    });

    expect(cache.extract()[`ShoppingListItem:${itemId}`]).toEqual({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    expect(diffList(cache).complete).toBe(false);
  });
});
