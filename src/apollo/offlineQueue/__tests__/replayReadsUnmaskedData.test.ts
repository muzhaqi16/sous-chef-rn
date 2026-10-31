import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  completeMockedResponse,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';

/**
 * The replay's reconcilers read fields that sit inside fragment spreads, and a
 * masked `client.mutate` result hides them. Driven through a real client with
 * masking on, as the app runs; a pre-unmasked fixture cannot see the gap.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const LIST_TOTALS = gql`
  fragment ReplayListTotals on ShoppingList {
    id
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

const replayClient = (
  results: Array<Record<string, unknown>>,
): ApolloClient => {
  const cache = makeCache();
  seedFragment(cache, {
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: LIST_TOTALS,
    data: {
      __typename: 'ShoppingList',
      id: 'list-1',
      totalItems: 5,
      completedItems: 0,
      remainingItems: 5,
      completionRate: 0,
    },
  });
  return new ApolloClient({
    cache,
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new MockLink([
      completeMockedResponse({
        request: {
          query: AddItemToShoppingListDocument,
          variables: () => true,
        },
        result: {
          data: {
            addItemsToShoppingList: {
              __typename: 'AddItemsToShoppingListPayload',
              shoppingList: { id: 'list-1', totalItems: 4, completedItems: 0 },
              results,
            },
          },
        },
      }),
    ]),
  });
};

const totalItemsOf = (client: ApolloClient): unknown =>
  client.cache.readFragment<{ totalItems: number }>({
    id: client.cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: LIST_TOTALS,
  })?.totalItems;

describe('a replayed batch add with a refused row', () => {
  it("leaves the list's totals at the server's count", async () => {
    mockClient = replayClient([
      {
        index: 0,
        success: true,
        item: {
          id: 'row-a',
          shoppingList: { id: 'list-1', totalItems: 4, completedItems: 0 },
        },
      },
      { index: 1, success: false, item: null },
    ]);
    const entry = makeQueuedMutation({
      ...queuedMutationFor(AddItemToShoppingListDocument),
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [
            { id: 'row-a', item: { itemName: 'Milk' } },
            { id: 'row-b', item: { itemName: 'Eggs' } },
          ],
        },
      },
    });

    await new QueueManager()['executeMutation'](entry);

    expect(totalItemsOf(mockClient)).toBe(4);
  });
});

describe('a replayed batch add the server merged into an existing row', () => {
  it("drops the minted row and keeps the server's count", async () => {
    mockClient = replayClient([
      {
        index: 0,
        success: true,
        item: {
          id: 'row-kept',
          shoppingList: { id: 'list-1', totalItems: 4, completedItems: 0 },
        },
      },
      {
        index: 1,
        success: true,
        item: {
          id: 'row-b',
          shoppingList: { id: 'list-1', totalItems: 4, completedItems: 0 },
        },
      },
    ]);
    const entry = makeQueuedMutation({
      ...queuedMutationFor(AddItemToShoppingListDocument),
      variables: {
        input: {
          shoppingListId: 'list-1',
          items: [
            { id: 'row-minted', item: { itemName: 'Milk' } },
            { id: 'row-b', item: { itemName: 'Eggs' } },
          ],
        },
      },
      pendingWrite: {
        id: 'held-add',
        inputs: {
          listId: 'list-1',
          rows: [
            {
              id: 'row-minted',
              shoppingListId: 'list-1',
              itemName: 'Milk',
            },
          ],
          now: '2026-10-30T10:00:00.000Z',
        },
      },
    });
    queueStore.setCurrentUserId(entry.userId);
    queueStore.addMutation(entry);
    const { cache } = mockClient;
    const pending = pendingWritesOf(cache);
    pending.restore(queueStore.getPendingWrites());
    const shown = () =>
      isHeld(cache, { __typename: 'ShoppingListItem', id: 'row-minted' });
    expect(shown()).toBe(true);

    await new QueueManager()['executeMutation'](entry);
    pending.rebuild();
    queueStore.removeMutation(entry.id);

    expect(shown()).toBe(false);
    expect(totalItemsOf(mockClient)).toBe(4);
  });
});
