'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { ShoppingListMainContent } from '../ShoppingListMainContent';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

jest.mock('#hooks/useFeatureHint', () => ({
  useFeatureHint: jest.fn(() => ({
    isVisible: false,
    hasBeenShown: false,
    actions: { show: jest.fn(), dismiss: jest.fn() },
  })),
}));

jest.mock('#hooks/shoppingList/useShoppingListActions', () => ({
  useShoppingListActions: jest.fn(() => ({
    handleTogglePurchase: jest.fn(),
    handleDeleteItem: jest.fn(),
    handleClearAllPurchased: jest.fn(),
    handleClearAllShopping: jest.fn(),
  })),
}));

jest.mock('#hooks/shoppingList/useBatchMoveToPantry', () => ({
  useBatchMoveToPantry: jest.fn(() => ({
    batchMoveToPantry: jest.fn(),
    loading: false,
  })),
}));

jest.mock('#hooks/shoppingList/useShoppingListSelectorModal', () => ({
  useShoppingListSelectorModal: jest.fn(() => ({
    selectorRef: { current: null },
    listConfig: {},
    handleOpenSelector: jest.fn(),
    handleOverlayOpen: jest.fn(),
    handleOverlayClose: jest.fn(),
  })),
}));

jest.mock('#hooks/shoppingList/useItemReordering', () => ({
  useItemReordering: jest.fn(() => ({
    handleSortOrderUpdate: jest.fn(),
  })),
}));

jest.mock('#hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: jest.fn(() => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  })),
}));

jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: jest.fn(() => ({
    setOverlayOpen: jest.fn(),
    setScannerProps: jest.fn(),
  })),
}));

jest.mock('#/context/ShoppingListModalsContext', () => ({
  useShoppingListModals: jest.fn(() => ({
    addItemSheet: { open: jest.fn() },
    quantityEdit: { openForItem: jest.fn() },
    moveToPantry: { openForItem: jest.fn() },
  })),
}));

jest.mock('#/hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'user-1' },
  })),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#hooks/performance/useScreenTelemetry', () => ({
  useScreenTelemetry: jest.fn(),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: { clearType: jest.fn() },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn() },
}));

jest.mock('#/utils/permissions/shoppingListPermissions', () => ({
  getShoppingListPermissionsWithOwner: jest.fn(() => ({
    canAddItems: true,
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#components/organisms/AnimatedItemSelector/AnimatedItemSelector', () => {
  const { forwardRef } = require('react');
  return { AnimatedItemSelector: forwardRef(() => null) };
});

jest.mock('#components/templates/ListTemplate', () => ({
  ListTemplate: () => null,
}));

jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: ({ title }: any) => title,
}));

jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: () => null,
}));

jest.mock('#components/organisms/ShoppingListTabs/ShoppingListTabs', () => ({
  ShoppingListTabs: () => null,
}));

jest.mock('#components/organisms/SwipeHintOverlay', () => ({
  SwipeHintOverlay: () => null,
}));

const makeScreenData = (overrides: any = {}) => ({
  lists: [{ id: 'list-1', name: 'Groceries' }],
  listDataWithOwnership: [
    { id: 'list-1', name: 'Groceries', _isOwner: true },
  ],
  currentList: { id: 'list-1', name: 'Groceries' },
  currentListDetails: null,
  currentListId: 'list-1',
  items: [],
  sortableItems: [],
  unpurchasedItems: [],
  purchasedItems: [],
  rawUnpurchasedItems: [],
  isLoadingInitial: false,
  searchQuery: '',
  setSearchQuery: jest.fn(),
  addItem: jest.fn(),
  toggleItem: jest.fn(),
  removeItem: jest.fn(),
  refetch: jest.fn().mockResolvedValue({}),
  totalCountUnpurchased: 0,
  totalCountPurchased: 0,
  loadMoreUnpurchased: jest.fn(),
  hasMoreUnpurchased: false,
  isLoadingMoreUnpurchased: false,
  loadMorePurchased: jest.fn(),
  hasMorePurchased: false,
  isLoadingMorePurchased: false,
  setSelectedShoppingListId: jest.fn(),
  isTransitioning: false,
  ...overrides,
});

describe('ShoppingListMainContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders shopping list screen', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent screenData={makeScreenData()} />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('shows empty state when no lists exist', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent screenData={makeScreenData({ lists: [] })} />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('renders with items', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent
        screenData={makeScreenData({
          items: [{ id: 'item-1', name: 'Milk', purchaseInfo: null }],
          sortableItems: [{ id: 'item-1', title: 'Milk' }],
        })}
      />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('renders with loading state', () => {
    const { getByTestId } = render(
      <ShoppingListMainContent
        screenData={makeScreenData({ isLoadingInitial: true })}
      />,
    );
    expect(getByTestId('shopping-list-screen')).toBeTruthy();
  });

  it('renders with current list name', () => {
    const tree = render(
      <ShoppingListMainContent screenData={makeScreenData()} />,
    );
    expect(tree.toJSON()).toBeTruthy();
  });
});
