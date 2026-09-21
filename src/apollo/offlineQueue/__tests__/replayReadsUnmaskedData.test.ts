import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { completeMockedResponse } from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { AddItemToShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { QueueManager } from '../queueManager';

/**
 * The replay's reconcilers read fields that sit inside fragment spreads, and a
 * masked `client.mutate` result hides them. Driven through a real client with
 * masking on, as the app runs; a pre-unmasked fixture cannot see the gap.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
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
  cache.writeFragment({
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
    mockClient.cache.writeFragment({
      id: mockClient.cache.identify({
        __typename: 'ShoppingListItem',
        id: 'row-minted',
      }),
      fragment: gql`
        fragment ReplayMintedRow on ShoppingListItem {
          id
          itemName
        }
      `,
      data: {
        __typename: 'ShoppingListItem',
        id: 'row-minted',
        itemName: 'Milk',
      },
    });
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
    });

    await new QueueManager()['executeMutation'](entry);

    const mintedKey = mockClient.cache.identify({
      __typename: 'ShoppingListItem',
      id: 'row-minted',
    });
    expect(mintedKey).toBeDefined();
    expect(totalItemsOf(mockClient)).toBe(4);
    expect(mockClient.cache.extract()).not.toHaveProperty([mintedKey]);
  });
});
