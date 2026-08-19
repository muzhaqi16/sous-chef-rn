'use no memo';
import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
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
};

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
    };
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([unpriced])],
    });
    await waitFor(() => expect(screen.getByText('1 kg')).toBeTruthy());
    expect(screen.queryByText('Price:')).toBeNull();
  });

  it('renders empty state when no purchases', async () => {
    renderWithApollo(<PurchaseHistoryScreen route={route} />, {
      operationMocks: [historyMock([])],
    });
    expect(await screen.findByText('No purchase history')).toBeTruthy();
  });
});
