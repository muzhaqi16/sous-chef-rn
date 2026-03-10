'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LowStockItems } from '../LowStockItems';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/pantry/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'p1' },
    selectedHomeId: 'h1',
  }),
}));

jest.mock('#hooks/pantry/useAddLowStockToShoppingList', () => ({
  useAddLowStockToShoppingList: () => ({
    addLowStockToShoppingList: jest.fn(),
    loading: false,
  }),
}));

const mockLowStockItems = [
  { id: 'ls1', itemName: 'Eggs', quantity: 2, unit: { symbol: 'pcs' }, isLowStock: true },
  { id: 'ls2', itemName: 'Butter', quantity: 1, unit: { symbol: 'stk' }, isLowStock: true },
];

let mockAllItems: any[] | null = mockLowStockItems;
let mockLoading = false;

jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: () => ({
    state: {
      items: mockAllItems,
      loading: mockLoading,
      hasMore: false,
      isLoadingMore: false,
    },
    actions: {
      refetch: jest.fn(() => Promise.resolve()),
      loadMore: jest.fn(),
    },
  }),
}));

jest.mock('#generated', () => ({
  useAddItemToShoppingListMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title, rightActions }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        {rightActions?.map((a: any, i: number) => (
          <View key={i} testID={a.testID} />
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({ children, onPress }: any) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));
jest.mock('#components/base/Skeleton/PantryItemSkeleton', () => ({
  PantryItemSkeleton: () => null,
}));
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    container: {},
    card: {},
    rowSpaceBetween: {},
    center: {},
    body: {},
    caption: {},
  },
}));

describe('LowStockItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllItems = mockLowStockItems;
    mockLoading = false;
  });

  it('renders the title', () => {
    render(<LowStockItems />);
    expect(screen.getByText('Low Stock Items')).toBeTruthy();
  });

  it('shows add-all button in header', () => {
    render(<LowStockItems />);
    expect(screen.getByTestId('add-all-low-stock')).toBeTruthy();
  });

  it('renders low stock item names', () => {
    render(<LowStockItems />);
    expect(screen.getByText('Eggs')).toBeTruthy();
    expect(screen.getByText('Butter')).toBeTruthy();
  });

  it('shows remaining quantities', () => {
    render(<LowStockItems />);
    expect(screen.getByText('2 pcs remaining')).toBeTruthy();
    expect(screen.getByText('1 stk remaining')).toBeTruthy();
  });

  it('shows empty state when all items are stocked', () => {
    mockAllItems = [];
    render(<LowStockItems />);
    expect(screen.getByText('All items are above minimum stock levels')).toBeTruthy();
  });

  it('renders without crashing during loading', () => {
    mockLoading = true;
    mockAllItems = null;
    render(<LowStockItems />);
    expect(screen.getByText('Low Stock Items')).toBeTruthy();
  });
});
