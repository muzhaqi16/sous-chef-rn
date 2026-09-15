/**
 * The list counters around a refused toggle, against the REAL connection movers —
 * the sibling suite stubs them, so it cannot see a counter at all.
 */
import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  renderHookWithApollo,
  seedCache,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { ToggleShoppingListItemPurchasedDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
    track: jest.fn(() => jest.fn()),
  },
}));
jest.mock('#/utils/finallyHelpers');

const TOTAL = 3;

const LIST = gql`
  query ToggleCountersProbe($id: ID!, $isPurchased: Boolean) {
    shoppingList(id: $id) {
      __typename
      id
      totalItems
      completedItems
      remainingItems
      completionRate
      itemsConnection(filters: { isPurchased: $isPurchased }) {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
          }
        }
      }
    }
  }
`;

const COUNTS = gql`
  fragment ToggleCountersProbeCounts on ShoppingList {
    id
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

type Counts = {
  totalItems: number;
  completedItems: number;
  remainingItems: number;
  completionRate: number;
};

/** A purchased row, under a list whose counters say `completedItems`. */
function seed(completedItems: number) {
  const cache = seedCache([
    {
      __typename: 'ShoppingListItem',
      id: 'item-1',
      itemName: 'Milk',
      quantity: 1,
      quantityInput: '1',
      displayFormat: 'DECIMAL',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: true,
        movedToPantryAt: null,
        purchaseDate: null,
        purchasedById: null,
        purchasedPrice: null,
        purchasedQuantity: null,
        purchasedBy: null,
      },
      version: 3,
      updatedAt: '2026-01-01T00:00:00.000Z',
      category: null,
      notes: null,
      unitName: null,
      unit: null,
      sortOrder: '1',
      item: null,
    },
  ]);
  for (const isPurchased of [true, false]) {
    const edges = isPurchased
      ? [
          {
            __typename: 'ShoppingListItemEdge',
            cursor: 'item-1',
            node: { __typename: 'ShoppingListItem', id: 'item-1' },
          },
        ]
      : [];
    cache.writeQuery({
      query: LIST,
      variables: { id: 'list-1', isPurchased },
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: TOTAL,
          completedItems,
          remainingItems: TOTAL - completedItems,
          completionRate: completedItems / TOTAL,
          itemsConnection: {
            __typename: 'ShoppingListItemConnection',
            totalCount: edges.length,
            edges,
          },
        },
      },
    });
  }
  return cache;
}

const counts = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<Counts>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: COUNTS,
  });

const refusal: MockedResponse = {
  request: {
    query: ToggleShoppingListItemPurchasedDocument,
    variables: () => true,
  },
  result: {
    data: {
      toggleShoppingListItemPurchased: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'refused',
        field: null,
      },
    },
  },
};

describe('useToggleShoppingItem counters on a refused toggle', () => {
  const refetch = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('puts back the exact counters an un-mark could not lower', async () => {
    // `completedItems: 0` beside a purchased row: the un-mark clamps at 0, so
    // reverting it with `+1` would leave the header counting a phantom row.
    const cache = seed(0);
    const before = counts(cache);
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch }),
      { cache, operationMocks: [refusal] },
    );

    await act(async () => {
      await result.current.toggleItem('item-1');
    });

    expect(counts(cache)).toEqual(before);
  });

  it('keeps a counter another write moved while the toggle was in flight', async () => {
    const cache = seed(2);
    const { result } = renderHookWithApollo(
      () => useToggleShoppingItem({ listId: 'list-1', refetch }),
      { cache, operationMocks: [refusal] },
    );

    await act(async () => {
      const pending = result.current.toggleItem('item-1');
      // A collaborator's purchase lands between the local write and the refusal.
      cache.modify({
        id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
        fields: { completedItems: (existing: number) => existing + 1 },
      });
      await pending;
    });

    // Its value is newer than the snapshot, so the revert stays relative and the
    // list re-reads for the server's count.
    expect(counts(cache)?.completedItems).toBe(3);
    expect(refetch).toHaveBeenCalled();
  });
});
