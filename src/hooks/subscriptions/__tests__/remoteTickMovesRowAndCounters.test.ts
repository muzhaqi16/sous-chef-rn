'use no memo';

/**
 * Another member ticking a row off and back on, as the REAL cache holds it. The
 * event names the transition and the row, never the operation that caused it,
 * so the row and the list's counters move whichever mutation the sender used.
 */
import { act, waitFor } from '@testing-library/react-native';
import {
  gql,
  type InMemoryCache,
  type TypedDocumentNode,
} from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import type { SubscriptionConfig } from '#/services/subscriptions/types';
import {
  MutationType,
  ShoppingListSubtype,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store/index';
import { useShoppingListSubscriptions } from '#features/shoppingList/hooks/useShoppingListSubscriptions';
import { ShoppingListItemForEventDocument } from '#features/shoppingList/hooks/useShoppingListSubscriptions.generated';

type CapturedOnData = (data: unknown, client: unknown) => void;

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#/storage/deviceId', () => ({
  getDeviceId: jest.fn(() => 'device_this'),
}));

let mockOnData: CapturedOnData | undefined;
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    register: (config: SubscriptionConfig) => {
      mockOnData = config.customOnData as CapturedOnData | undefined;
      return {};
    },
    isParentDeleting: () => false,
  },
}));

const onData = (): CapturedOnData => {
  if (!mockOnData) throw new Error('customOnData was not captured');
  return mockOnData;
};

/** MockLink answers on a timer; the read-back then resolves a microtask later. */
const settle = async () => {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      jest.advanceTimersByTime(50);
    });
  }
};

interface ListEdge {
  __typename: 'ShoppingListItemEdge';
  node: { __typename: 'ShoppingListItem'; id: string };
}

interface ListVariant {
  shoppingList: {
    __typename: 'ShoppingList';
    id: string;
    totalItems: number;
    completedItems: number;
    remainingItems: number;
    completionRate: number;
    itemsConnection: {
      __typename: 'ShoppingListItemConnection';
      totalCount: number;
      edges: ListEdge[];
    };
  } | null;
}

const LIST_VARIANT: TypedDocumentNode<
  ListVariant,
  { id: string; isPurchased: boolean }
> = gql`
  query TestShoppingListVariant($id: ID!, $isPurchased: Boolean) {
    shoppingList(id: $id) {
      id
      totalItems
      completedItems
      remainingItems
      completionRate
      itemsConnection(first: 20, filters: { isPurchased: $isPurchased }) {
        totalCount
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

/** `list-1` holding two rows, neither bought. */
function seedList(): InMemoryCache {
  const cache = makeCache();
  const variant = (isPurchased: boolean, ids: string[]) =>
    cache.writeQuery({
      query: LIST_VARIANT,
      variables: { id: 'list-1', isPurchased },
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          totalItems: 2,
          completedItems: 0,
          remainingItems: 2,
          completionRate: 0,
          itemsConnection: {
            __typename: 'ShoppingListItemConnection',
            totalCount: ids.length,
            edges: ids.map(
              (id): ListEdge => ({
                __typename: 'ShoppingListItemEdge',
                node: { __typename: 'ShoppingListItem', id },
              }),
            ),
          },
        },
      },
    });
  variant(false, ['item-1', 'item-2']);
  variant(true, []);
  return cache;
}

const read = (cache: InMemoryCache, isPurchased: boolean) => {
  const list = cache.readQuery({
    query: LIST_VARIANT,
    variables: { id: 'list-1', isPurchased },
  })?.shoppingList;
  return {
    ids: list?.itemsConnection.edges.map(edge => edge.node.id),
    totalCount: list?.itemsConnection.totalCount,
  };
};

const counters = (cache: InMemoryCache) => {
  const list = cache.readQuery({
    query: LIST_VARIANT,
    variables: { id: 'list-1', isPurchased: false },
  })?.shoppingList;
  return {
    totalItems: list?.totalItems,
    completedItems: list?.completedItems,
    remainingItems: list?.remainingItems,
    completionRate: list?.completionRate,
  };
};

/** The row as the server holds it after the transition, for the read-back. */
const rowReadBack = (isPurchased: boolean) =>
  recordMock(ShoppingListItemForEventDocument, {
    data: {
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        shoppingList: { __typename: 'ShoppingList', id: 'list-1' },
        purchaseInfo: { isPurchased },
      },
    },
    maxUsageCount: 1,
  });

beforeEach(() => {
  jest.useFakeTimers();
  mockOnData = undefined;
  useStore.setState({ selectedShoppingListId: 'list-1' });
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ selectedShoppingListId: null });
});

describe('a row ticked off, then back on, by another member', () => {
  it('moves between the purchased variants and moves the list counters each time', async () => {
    const cache = seedList();
    const bought = rowReadBack(true);
    const unbought = rowReadBack(false);
    const { result } = renderHookWithApollo(
      () => {
        useShoppingListSubscriptions('user-1');
        return useApolloClient();
      },
      { cache, operationMocks: [bought.mock, unbought.mock] },
    );

    const announce = async (mutation: MutationType) => {
      await act(async () => {
        onData()(
          {
            subtype: ShoppingListSubtype.ItemsChanged,
            mutation,
            listId: 'list-1',
            actorUserId: 'user-2',
            originatorClientId: 'device_other',
            // What the API states for either direction of the transition.
            updatedFields: ['purchased'],
            node: { __typename: 'ShoppingListItem', id: 'item-1' },
          },
          result.current,
        );
      });
      await settle();
    };

    await announce(MutationType.ItemCompleted);
    await waitFor(() => expect(bought.fired).toEqual([{ id: 'item-1' }]));
    await settle();

    expect(read(cache, false)).toEqual({ ids: ['item-2'], totalCount: 1 });
    expect(read(cache, true)).toEqual({ ids: ['item-1'], totalCount: 1 });
    expect(counters(cache)).toEqual({
      totalItems: 2,
      completedItems: 1,
      remainingItems: 1,
      completionRate: 0.5,
    });

    await announce(MutationType.ItemUncompleted);
    await waitFor(() => expect(unbought.fired).toEqual([{ id: 'item-1' }]));
    await settle();

    expect(read(cache, false)).toEqual({
      ids: ['item-1', 'item-2'],
      totalCount: 2,
    });
    expect(read(cache, true)).toEqual({ ids: [], totalCount: 0 });
    expect(counters(cache)).toEqual({
      totalItems: 2,
      completedItems: 0,
      remainingItems: 2,
      completionRate: 0,
    });
  });
});
