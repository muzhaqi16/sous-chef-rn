'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { FilteredPantryItems } from '../FilteredPantryItems';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/ui/useTutorialSequence', () => ({
  useTutorialSequence: () => ({
    isActive: false,
    currentStep: null,
    advance: jest.fn(),
    skipAll: jest.fn(),
  }),
}));

jest.mock(
  '#components/organisms/SpotlightCoachMark/SpotlightCoachMark',
  () => ({
    SpotlightCoachMark: () => null,
  }),
);

jest.mock('#features/pantry/hooks/usePantryPermissions');

jest.mock('#features/pantry/hooks/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'p1' },
    selectedHomeId: 'h1',
  }),
}));

jest.mock('#features/pantry/hooks/useAddLowStockToShoppingList', () => ({
  useAddLowStockToShoppingList: () => ({
    addLowStockToShoppingList: jest.fn(),
    loading: false,
  }),
}));

const mockLowStockItems = [
  {
    id: 'ls1',
    itemName: 'Eggs',
    quantity: 2,
    unit: { symbol: 'pcs' },
    isLowStock: true,
  },
  {
    id: 'ls2',
    itemName: 'Butter',
    quantity: 1,
    unit: { symbol: 'stk' },
    isLowStock: true,
  },
];

const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
const in3Days = new Date(now);
in3Days.setDate(in3Days.getDate() + 3);

const mockExpiringItems = [
  {
    id: 'ex1',
    itemName: 'Milk',
    quantity: 1,
    unit: { symbol: 'gal' },
    isLowStock: false,
    expiresAt: tomorrow.toISOString(),
  },
  {
    id: 'ex2',
    itemName: 'Yogurt',
    quantity: 2,
    unit: { symbol: 'cups' },
    isLowStock: false,
    expiresAt: in3Days.toISOString(),
  },
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
  ...jest.requireActual('#generated'),
  useAddItemToShoppingListMutation: jest.fn(() => [
    jest.fn(),
    { loading: false },
  ]),
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

const makeRoute = (mode?: 'lowStock' | 'expiring') =>
  ({
    params: mode ? { mode } : undefined,
  } as any);

describe('FilteredPantryItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllItems = mockLowStockItems;
    mockLoading = false;
  });

  describe('lowStock mode', () => {
    it('renders the title', () => {
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });

    it('shows add-all button in header', () => {
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByTestId('add-all-low-stock')).toBeTruthy();
    });

    it('renders low stock item names', () => {
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Eggs')).toBeTruthy();
      expect(screen.getByText('Butter')).toBeTruthy();
    });

    it('shows remaining quantities', () => {
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('2 pcs remaining')).toBeTruthy();
      expect(screen.getByText('1 stk remaining')).toBeTruthy();
    });

    it('shows empty state when all items are stocked', () => {
      mockAllItems = [];
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(
        screen.getByText('All items are above minimum stock levels'),
      ).toBeTruthy();
    });

    it('renders without crashing during loading', () => {
      mockLoading = true;
      mockAllItems = null;
      render(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });

    it('defaults to lowStock mode when no params', () => {
      render(<FilteredPantryItems route={makeRoute()} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });
  });

  describe('expiring mode', () => {
    beforeEach(() => {
      mockAllItems = mockExpiringItems;
    });

    it('renders the title', () => {
      render(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Expiring Items')).toBeTruthy();
    });

    it('does not show add-all button in header', () => {
      render(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.queryByTestId('add-all-low-stock')).toBeNull();
    });

    it('renders expiring item names', () => {
      render(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Milk')).toBeTruthy();
      expect(screen.getByText('Yogurt')).toBeTruthy();
    });

    it('shows expiry subtitle', () => {
      render(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Expires tomorrow')).toBeTruthy();
    });

    it('shows empty state when no items are expiring', () => {
      mockAllItems = [];
      render(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('No items are expiring soon')).toBeTruthy();
    });
  });
});
