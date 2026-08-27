'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
import { FilteredPantryItems } from '../FilteredPantryItems';

// Structural shape consumed by the screen via the mocked `usePantryManagement`.
type MockPantryItem = {
  id: string;
  itemName: string;
  quantity: number;
  unit: { symbol: string } | null;
  isLowStock: boolean;
  expiresAt?: string;
};

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

const sixDaysAgo = new Date(now);
sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

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

const mockExpiredItems = [
  {
    id: 'exp1',
    itemName: 'Salmon',
    quantity: 1,
    unit: { symbol: 'steak' },
    isLowStock: false,
    expiresAt: sixDaysAgo.toISOString(),
  },
];

let mockAllItems: MockPantryItem[] | null = mockLowStockItems;
let mockLoading = false;
let mockError: Error | undefined;
let mockHasResult = true;

jest.mock('#features/pantry/hooks/usePantryManagement', () => ({
  usePantryManagement: () => ({
    state: {
      items: mockAllItems,
      loading: mockLoading,
      error: mockError,
      // A response arrived — separates an empty result from a fetch that
      // never answered, which must not render the same way.
      hasResult: mockHasResult,
      hasMore: false,
      isLoadingMore: false,
    },
    actions: {
      refetch: jest.fn(() => Promise.resolve()),
      loadMore: jest.fn(),
    },
  }),
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({
    title,
    rightActions,
  }: {
    title?: string;
    rightActions?: HeaderAction[];
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="header">
        <Text>{title}</Text>
        {rightActions?.map((a, i) => (
          <View key={i} testID={a.testID} />
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({
    children,
    onPress,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
  }) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));
jest.mock('#features/pantry/components/skeletons/PantryItemSkeleton', () => ({
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

const makeRoute = (
  mode?: 'lowStock' | 'expiring' | 'expired',
): React.ComponentProps<typeof FilteredPantryItems>['route'] => ({
  params: mode ? { mode } : undefined,
});

describe('FilteredPantryItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAllItems = mockLowStockItems;
    mockLoading = false;
    mockError = undefined;
    mockHasResult = true;
  });

  describe('lowStock mode', () => {
    it('renders the title', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });

    it('shows add-all button in header', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByTestId('add-all-low-stock')).toBeTruthy();
    });

    it('renders low stock item names', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Eggs')).toBeTruthy();
      expect(screen.getByText('Butter')).toBeTruthy();
    });

    it('shows remaining quantities', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('2 pcs remaining')).toBeTruthy();
      expect(screen.getByText('1 stk remaining')).toBeTruthy();
    });

    it('shows empty state when all items are stocked', () => {
      mockAllItems = [];
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(
        screen.getByText('All items are above minimum stock levels'),
      ).toBeTruthy();
    });

    it('renders without crashing during loading', () => {
      mockLoading = true;
      mockAllItems = null;
      renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });

    describe('a failed fetch is not good news', () => {
      // The empty copy here congratulates: "All items are above minimum stock
      // levels". Showing it when the request failed reports something the app
      // has no evidence for, and gives no way to try again.
      it('shows a retry, not the all-stocked message, when the fetch failed', () => {
        mockAllItems = [];
        mockHasResult = false;
        mockError = new Error('500');
        renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);

        expect(
          screen.queryByText('All items are above minimum stock levels'),
        ).toBeNull();
        expect(screen.getByTestId('state-error')).toBeTruthy();
        expect(screen.getByText('Try again')).toBeTruthy();
      });

      it('still shows the all-stocked message when the fetch succeeded', () => {
        mockAllItems = [];
        renderWithApollo(<FilteredPantryItems route={makeRoute('lowStock')} />);

        expect(
          screen.getByText('All items are above minimum stock levels'),
        ).toBeTruthy();
        expect(screen.queryByTestId('state-error')).toBeNull();
      });
    });

    it('defaults to lowStock mode when no params', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute()} />);
      expect(screen.getByText('Low Stock Items')).toBeTruthy();
    });
  });

  describe('expiring mode', () => {
    beforeEach(() => {
      mockAllItems = mockExpiringItems;
    });

    it('renders the title', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Expiring Items')).toBeTruthy();
    });

    it('does not show add-all button in header', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.queryByTestId('add-all-low-stock')).toBeNull();
    });

    it('renders expiring item names', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Milk')).toBeTruthy();
      expect(screen.getByText('Yogurt')).toBeTruthy();
    });

    it('shows expiry subtitle', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('Expires tomorrow')).toBeTruthy();
    });

    it('shows empty state when no items are expiring', () => {
      mockAllItems = [];
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.getByText('No items are expiring soon')).toBeTruthy();
    });

    it('excludes already-expired items', () => {
      mockAllItems = mockExpiredItems;
      renderWithApollo(<FilteredPantryItems route={makeRoute('expiring')} />);
      expect(screen.queryByText('Salmon')).toBeNull();
      expect(screen.getByText('No items are expiring soon')).toBeTruthy();
    });
  });

  describe('expired mode', () => {
    beforeEach(() => {
      mockAllItems = mockExpiredItems;
    });

    it('renders the title', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expired')} />);
      expect(screen.getByText('Expired Items')).toBeTruthy();
    });

    it('renders expired item names', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expired')} />);
      expect(screen.getByText('Salmon')).toBeTruthy();
    });

    it('shows expired subtitle', () => {
      renderWithApollo(<FilteredPantryItems route={makeRoute('expired')} />);
      expect(screen.getByText('Expired')).toBeTruthy();
    });

    it('excludes items that are only expiring soon', () => {
      mockAllItems = mockExpiringItems;
      renderWithApollo(<FilteredPantryItems route={makeRoute('expired')} />);
      expect(screen.queryByText('Milk')).toBeNull();
      expect(screen.getByText('No expired items')).toBeTruthy();
    });

    it('shows empty state when nothing is expired', () => {
      mockAllItems = [];
      renderWithApollo(<FilteredPantryItems route={makeRoute('expired')} />);
      expect(screen.getByText('No expired items')).toBeTruthy();
    });
  });
});
