import React from 'react';
import { screen } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import {
  completeMockedResponse,
  renderWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { formatCurrency } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useStore } from '#store';
import { ListBudget } from '../ListBudget';
import {
  ListBudgetDocument,
  type ListBudgetQuery,
} from '../useListBudget.generated';

jest.mock('#hooks/navigation/useAppNavigation');
// The account has Budget & prices on, so "Could you save?" shows.
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: () => true,
}));

const OWNER = {
  id: 'user-1',
  email: 'owner@example.com',
  emailVerified: true,
  onBoarded: true,
};

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  name: 'Groceries',
  isDefault: false,
  status: 'ACTIVE',
  isCompleted: false,
  completedShopDate: null,
  budgetAmount: 60,
  currency: 'USD',
  totalCost: 18.4,
  costToGo: {
    __typename: 'ShoppingListCostToGo',
    amount: 4,
    currency: 'USD',
    pricedLines: 1,
    lines: 2,
  },
  priceTracking: true,
  targetStore: { __typename: 'Store', id: 'store-1', name: 'Giant Eagle' },
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  ownerships: [
    { __typename: 'ShoppingListOwnership', id: 'own-1', userId: 'user-1' },
  ],
  homeId: null,
  home: null,
  collaboratorsConnection: { edges: [] },
};

/** The list as the screen's read left it on the device. */
function cachedList() {
  const cache = seedCache([]);
  const variables = { id: 'list-1' };
  const completed = completeMockedResponse({
    request: { query: ListBudgetDocument, variables },
    result: { data: { shoppingList: LIST } },
  }).result as (vars: typeof variables) => {
    data: Unmasked<ListBudgetQuery>;
  };
  cache.writeQuery({
    query: ListBudgetDocument,
    variables,
    data: completed(variables).data,
  });
  return cache;
}

const renderScreen = () =>
  renderWithApollo(<ListBudget route={{ params: { listId: 'list-1' } }} />, {
    cache: cachedList(),
    operationMocks: [],
  });

describe('ListBudget', () => {
  beforeEach(() => {
    useStore.setState({ user: OWNER, isOnline: false, apiReachable: false });
  });

  afterEach(() => {
    useStore.setState({ user: null, isOnline: true, apiReachable: true });
  });

  // Read from the device: the figures show with no connection.
  it("shows the list's money as text, offline", () => {
    renderScreen();

    expect(
      screen.getByTestId(shoppingListTestIDs.costToGo).props.children,
    ).toBe(`≈ ${formatCurrency(4, 'USD')}`);
    expect(screen.getByText('Priced 1 of 2 items')).toBeTruthy();
    expect(screen.getByText(formatCurrency(18.4, 'USD'))).toBeTruthy();
    // 60 budget − 18.40 spent − 4.00 to go.
    expect(
      screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children,
    ).toBe(
      `${formatCurrency(37.6, 'USD')} left of ${formatCurrency(60, 'USD')}`,
    );
  });

  it('answers first: the cost, then what other stores would save, then the settings', () => {
    renderScreen();

    const order = screen
      .getAllByTestId(/^list-(budget|savings)/)
      .map(node => node.props.testID as string);
    const at = (testID: string) => order.indexOf(testID);
    expect(at(shoppingListTestIDs.costSummary)).toBeGreaterThan(-1);
    expect(at(shoppingListTestIDs.costSummary)).toBeLessThan(
      at(shoppingListTestIDs.listSavings),
    );
    expect(at(shoppingListTestIDs.listSavings)).toBeLessThan(
      at(shoppingListTestIDs.listPriceSettings),
    );
  });

  it('offers the owner the budget, store and tracking controls', () => {
    renderScreen();

    expect(screen.getByTestId(shoppingListTestIDs.budgetInput)).toBeTruthy();
    expect(
      screen.getByTestId(shoppingListTestIDs.listBudgetStore),
    ).toBeTruthy();
    expect(
      screen.getByTestId(shoppingListTestIDs.priceTrackingSwitch),
    ).toBeTruthy();
  });

  it('shows a member who cannot edit the list every value, with no control', () => {
    useStore.setState({ user: { ...OWNER, id: 'user-2' } });
    renderScreen();

    expect(screen.getByText('Giant Eagle')).toBeTruthy();
    expect(screen.queryByTestId(shoppingListTestIDs.budgetInput)).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.listBudgetStore),
    ).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.priceTrackingSwitch),
    ).toBeNull();
  });
});
