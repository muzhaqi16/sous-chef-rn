import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { BarAction } from '#components/molecules/BarActions';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { useStoreMode } from '#features/shoppingList/screens/useStoreMode';
import { StoreMode } from '../StoreMode';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('@sayem314/react-native-keep-awake', () => ({
  useKeepAwake: jest.fn(),
}));
jest.mock('#hooks/performance/useScreenTelemetry', () => ({
  useScreenTelemetry: jest.fn(),
}));
jest.mock('#features/shoppingList/screens/useStoreMode', () => ({
  useStoreMode: jest.fn(),
}));
// Only the bar is under test: its actions render as plain buttons.
jest.mock('#components/templates/SubScreen', () => {
  const { Pressable, Text, View } = require('react-native');
  return {
    SubScreen: ({
      actions,
      children,
    }: {
      actions?: BarAction[];
      children?: React.ReactNode;
    }) => (
      <View>
        {actions?.map(action => (
          <Pressable
            key={action.testID}
            testID={action.testID}
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
          >
            <Text>{'label' in action ? action.label : action.icon}</Text>
          </Pressable>
        ))}
        {children}
      </View>
    ),
  };
});
jest.mock(
  '#features/shoppingList/context/ShoppingListPermissionsContext',
  () => ({
    ShoppingListPermissionsProvider: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
const mockOpenPurchaseAmount = jest.fn();
jest.mock('#features/shoppingList/context/ShoppingListModalsContext', () => ({
  ShoppingListModalsProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useShoppingListModalActions: () => ({
    openMoveToAisle: jest.fn(),
    openPurchaseAmount: mockOpenPurchaseAmount,
    openQuantityEdit: jest.fn(),
  }),
}));
// Holds the row handlers the list renders with, so a test can tick a row.
let mockListProps: {
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
} = {};
jest.mock(
  '#features/shoppingList/components/SortableShoppingList/SortableList',
  () => ({
    SortableShoppingList: (props: typeof mockListProps) => {
      mockListProps = props;
      return null;
    },
  }),
);
jest.mock(
  '#features/shoppingList/components/storeMode/StoreModeHeader',
  () => ({ StoreModeHeader: () => null }),
);
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: () => true,
}));
jest.mock('#components/molecules/Loading', () => ({ Loading: () => null }));
jest.mock('#hooks/settings/useUserPreferences', () => ({
  useShowShoppingListImages: () => false,
}));
jest.mock('#hooks/app/useOfflineAwareError', () => ({
  useOfflineAwareError: () => ({ offline: false, error: null }),
}));

const route = {
  key: 'StoreMode',
  name: 'StoreMode',
  params: { listId: 'l-1' },
};

function mockStoreMode(
  canMarkPurchased: boolean,
  { loading = true, toggleLine = jest.fn() } = {},
) {
  jest.mocked(useStoreMode).mockReturnValue({
    state: {
      listName: 'Weekly',
      loading,
      lineCount: 0,
      cartCount: 0,
      aisles: [],
      rows: [],
      tab: 'all',
      error: undefined,
      permissions: { canMarkPurchased },
    },
    actions: { recordPurchase: jest.fn(), toggleLine },
  } as unknown as ReturnType<typeof useStoreMode>);
}

describe('StoreMode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scans into store mode for this list', async () => {
    mockStoreMode(true);
    render(<StoreMode route={route} />);

    await userEvent
      .setup()
      .press(screen.getByTestId(shoppingListTestIDs.storeModeScan));

    expect(useAppNavigation().toBarcode).toHaveBeenCalledWith({
      source: 'storeMode',
      shoppingListId: 'l-1',
    });
  });

  // Prices are gathered by long-press only: a tick never asks for one.
  it('puts a ticked line in the cart with no sheet, with prices on', () => {
    const toggleLine = jest.fn();
    mockStoreMode(true, { loading: false, toggleLine });
    render(<StoreMode route={route} />);

    mockListProps.onTogglePurchase?.('line-1');

    expect(toggleLine).toHaveBeenCalledWith('line-1');
    expect(mockOpenPurchaseAmount).not.toHaveBeenCalled();
  });

  it('opens the purchase sheet on a long-press', () => {
    const toggleLine = jest.fn();
    mockStoreMode(true, { loading: false, toggleLine });
    render(<StoreMode route={route} />);

    mockListProps.onTogglePurchase?.('line-1', { withDetails: true });

    expect(mockOpenPurchaseAmount).toHaveBeenCalledWith('line-1');
    expect(toggleLine).not.toHaveBeenCalled();
  });

  it('offers no scan to a member who cannot tick lines', () => {
    mockStoreMode(false);
    render(<StoreMode route={route} />);

    expect(screen.queryByTestId(shoppingListTestIDs.storeModeScan)).toBeNull();
    expect(screen.getByTestId(shoppingListTestIDs.storeModeDone)).toBeTruthy();
  });
});
