'use no memo';
import React from 'react';
import { makeCache } from '#/apollo/cache';
import { screen, waitFor } from '@testing-library/react-native';
import { GraphQLError } from 'graphql';
import {
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetItemPurchaseHistoryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { PurchaseHistoryScreen } from '../PurchaseHistoryScreen';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#hooks/navigation/useAppNavigation');

type PurchaseNode = {
  __typename: 'Purchase';
  id: string;
  purchaseDate: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: { __typename: 'Currency'; id: string; code: string };
  unitSymbol: string;
  user: {
    __typename: 'User';
    id: string;
    email: string | null;
    profile: {
      __typename: 'UserProfile';
      id: string;
      displayName: string | null;
    } | null;
  };
};

// Distinct ids matter: two fixtures sharing one id are the SAME normalized
// User, so a display name or email on either would be read for both.
const purchaser = (
  displayName: string | null,
  email: string | null = null,
  id = 'u1',
): PurchaseNode['user'] => ({
  __typename: 'User',
  id,
  email,
  profile: displayName
    ? { __typename: 'UserProfile', id: `profile-${id}`, displayName }
    : null,
});

const historyMock = (nodes: PurchaseNode[]): MockedResponse => ({
  request: {
    query: GetItemPurchaseHistoryDocument,
    variables: () => true,
  },
  result: {
    data: {
      shoppingListItem: {
        __typename: 'ShoppingListItem',
        id: '1',
        purchasesConnection: {
          __typename: 'PurchaseConnection',
          edges: nodes.map(node => ({ __typename: 'PurchaseEdge', node })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: nodes.length,
        },
      },
    },
  },
});

const purchase: PurchaseNode = {
  __typename: 'Purchase',
  id: 'p1',
  purchaseDate: '2026-01-15T10:00:00Z',
  quantity: 2,
  unitPrice: 2.5,
  totalPrice: 5,
  currency: { __typename: 'Currency', id: 'c1', code: 'USD' },
  unitSymbol: 'kg',
  user: purchaser('Sam'),
};

// The shape a failure takes on this query: every hop from `Purchase.currency`
// up through `node!` → `edges!` → `purchasesConnection!` is non-null, so one
// field error nulls `shoppingListItem` and the screen gets an error alongside
// a response that contains nothing. Empty and failed must not render alike.
const failingMock: MockedResponse = {
  request: {
    query: GetItemPurchaseHistoryDocument,
    variables: () => true,
  },
  result: {
    data: { shoppingListItem: null },
    errors: [
      new GraphQLError(
        'Cannot return null for non-nullable field Purchase.currency.',
      ),
    ],
  },
};

const route = { params: { itemId: '1', itemName: 'Milk' } };

describe('PurchaseHistoryScreen', () => {
  it('renders header with item name', () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([purchase])],
    });
    // Header is independent of the query and renders immediately.
    expect(screen.getByText('Purchase History')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders fetched purchase entries', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([purchase])],
    });
    expect(await screen.findByText('2 kg')).toBeTruthy();
  });

  it('renders the per-purchase price and spending summary', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([purchase])],
    });
    // Per-row total price and the header total/average (one priced purchase, so
    // total and average are both $5.00).
    await waitFor(() =>
      expect(screen.getAllByText('$5.00').length).toBeGreaterThan(0),
    );
  });

  it('omits price when a purchase has no recorded amount', async () => {
    const unpriced: PurchaseNode = {
      __typename: 'Purchase',
      id: 'p2',
      purchaseDate: '2026-02-01T10:00:00Z',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      currency: { __typename: 'Currency', id: 'c1', code: 'USD' },
      unitSymbol: 'kg',
      user: purchaser('Sam'),
    };
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([unpriced])],
    });
    await waitFor(() => expect(screen.getByText('1 kg')).toBeTruthy());
    expect(screen.queryByText('Price:')).toBeNull();
  });

  it('names who recorded the purchase', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([purchase])],
    });
    expect(await screen.findByText('Sam')).toBeTruthy();
  });

  it('falls back through email to "Someone" when there is no display name', async () => {
    const noProfile: PurchaseNode = {
      ...purchase,
      id: 'p3',
      user: purchaser(null, 'sam@example.com', 'u2'),
    };
    const anonymous: PurchaseNode = {
      ...purchase,
      id: 'p4',
      // `email` is null for every purchaser but the caller themself — the API
      // gates the address to self-or-admin.
      user: purchaser(null, null, 'u3'),
    };

    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([noProfile, anonymous])],
    });

    expect(await screen.findByText('sam@example.com')).toBeTruthy();
    expect(screen.getByText('Someone')).toBeTruthy();
  });

  it('renders empty state when no purchases', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([])],
    });
    expect(await screen.findByText('No purchase history')).toBeTruthy();
  });

  it('renders an error state, not an empty history, when the query fails', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [failingMock],
    });

    expect(await screen.findByText("Couldn't load this")).toBeTruthy();
    // "Mark this item as purchased to start tracking history" is advice to buy
    // something the person may already have bought — wrong precisely when the
    // app doesn't know what the history holds.
    expect(screen.queryByText('No purchase history')).toBeNull();
  });

  // `purchasesConnection` is `PurchaseConnection!`, so a field error inside it
  // nulls `shoppingListItem` all the way up — and that is the SAME root field
  // `GetShoppingListItem` reads. Written to the cache, it tells the ItemDetail
  // screen still mounted underneath that the item does not exist, and it
  // persists to MMKV, so the item stays missing across a restart.
  it('does not write its failure over the item every other screen reads', async () => {
    const cache = makeCache();

    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [failingMock],
      cache,
    });

    expect(await screen.findByText("Couldn't load this")).toBeTruthy();

    const rootQuery = cache.extract().ROOT_QUERY ?? {};
    const itemFields = Object.keys(rootQuery).filter(field =>
      field.startsWith('shoppingListItem'),
    );
    expect(itemFields).toEqual([]);
  });
});
