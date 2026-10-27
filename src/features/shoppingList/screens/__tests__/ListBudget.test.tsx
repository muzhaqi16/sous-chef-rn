import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';
import { formatCurrency } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useStore } from '#store';
import { ListBudget } from '../ListBudget';

jest.mock('#hooks/navigation/useAppNavigation');

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
  estimatedTotal: 22,
  unpricedItems: 3,
  priceTracking: true,
  targetStore: { __typename: 'Store', id: 'store-1', name: 'Giant Eagle' },
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
  ownerships: [
    { __typename: 'ShoppingListOwnership', id: 'own-1', userId: 'user-1' },
  ],
};

const renderScreen = () =>
  renderWithApollo(<ListBudget route={{ params: { listId: 'list-1' } }} />, {
    cache: seedCache([LIST]),
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

    expect(screen.getByText(formatCurrency(22, 'USD'))).toBeTruthy();
    expect(screen.getByText('3 items without a price')).toBeTruthy();
    expect(screen.getByText(formatCurrency(18.4, 'USD'))).toBeTruthy();
    expect(
      screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children,
    ).toBe(`${formatCurrency(41.6, 'USD')} left`);
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

  it('shows a member who cannot edit the list the figures and store only', () => {
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
