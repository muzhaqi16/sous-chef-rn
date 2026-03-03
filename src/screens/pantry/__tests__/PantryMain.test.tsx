'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryMain } from '../PantryMain';

// --- Break circular deps ---
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// --- Navigation ---
jest.mock('#hooks/navigation/useAppNavigation');

// --- Tab bar ---
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({ setOverlayOpen: jest.fn() }),
}));
jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

// --- Store ---
jest.mock('#store/useAppStore', () => {
  const fn = (selector: any) =>
    selector({
      showBiometricSetup: false,
      unreadCount: 0,
      pantrySortOption: 'recent',
      pantrySortDirection: 'desc',
      setPantrySortOption: jest.fn(),
      setPantrySortDirection: jest.fn(),
      pendingPantryScrollToTop: false,
      setPendingPantryScrollToTop: jest.fn(),
      isOnline: true,
    });
  fn.getState = () => ({});
  fn.setState = jest.fn();
  fn.subscribe = jest.fn();
  return {
    useAppStore: fn,
    selectIsOnline: (s: any) => s.isOnline,
  };
});

// --- Auth ---
jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Test', email: 'test@t.com', profilePicture: null } }),
}));

// --- Pantry hooks ---
jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: () => ({
    items: [],
    stats: { totalItems: 0, expiringItems: 0, lowStockItems: 0 },
    totalCount: 0,
    removeItem: jest.fn(),
    refetch: jest.fn(),
    loading: false,
    isRefreshing: false,
    error: null,
    loadMore: jest.fn(),
    hasMore: false,
    isLoadingMore: false,
    locationCounts: {},
  }),
}));
jest.mock('#hooks/pantry/usePantrySelectorConfig', () => ({
  usePantrySelectorConfig: () => ({ items: [], selectedId: null }),
}));
jest.mock('#hooks/pantry/usePantryItemActions', () => ({
  usePantryItemActions: () => ({
    consumeModal: { visible: false, item: null, close: jest.fn() },
    wasteModal: { visible: false, item: null, close: jest.fn() },
    restockModal: { visible: false, item: null, close: jest.fn() },
    handleConfirmConsume: jest.fn(),
    handleConfirmWaste: jest.fn(),
    handleConfirmRestock: jest.fn(),
    handleConsumeItem: jest.fn(),
    handleWasteItem: jest.fn(),
    handleRestockItem: jest.fn(),
    handleEditItem: jest.fn(),
    handleDeleteItem: jest.fn(),
  }),
}));
jest.mock('#hooks/pantry/useCurrentPantry', () => ({
  useCurrentPantry: () => ({
    pantry: { id: 'p1', name: 'Kitchen' },
    pantries: [{ id: 'p1', name: 'Kitchen' }],
    currentHome: { name: 'My Home' },
    selectedHomeId: 'h1',
    setSelectedPantryId: jest.fn(),
    isReady: true,
  }),
}));

// --- Performance / scanner / UI hooks ---
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#hooks/performance/useScreenTelemetry', () => ({
  useScreenTelemetry: jest.fn(),
}));
jest.mock('#hooks/scanner/useScannerSetup', () => ({
  useScannerSetup: jest.fn(),
}));
jest.mock('#hooks/ui/useSelectorManagement', () => ({
  useSelectorManagement: () => ({
    handleOpenSelector: jest.fn(),
    handleOverlayOpen: jest.fn(),
    handleOverlayClose: jest.fn(),
  }),
}));
jest.mock('#hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: () => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  }),
}));
jest.mock('#hooks/useFeatureHint', () => ({
  useFeatureHint: () => ({
    isVisible: false,
    hasBeenShown: true,
    actions: { show: jest.fn(), dismiss: jest.fn() },
  }),
  getLoginCount: () => 1,
}));
jest.mock('#services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn(), trackScreen: jest.fn() },
}));
jest.mock('#hooks/storageLocation/useStorageLocationManagement', () => ({
  useStorageLocationManagement: () => ({
    locations: [],
    createLocation: jest.fn(),
    creating: false,
  }),
}));

// --- Error boundary & performance ---
jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  PantryErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: ({ component: Component }: { component: React.FC; fallback: any }) => <Component />,
}));

// --- Heavy child components (shallow render) ---
jest.mock('#components/pantry/PantryContent', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  const { View, Text } = require('react-native');
  return {
    PantryContent: forwardRef((props: any, ref: any) => {
      useImperativeHandle(ref, () => ({ scrollToTop: jest.fn() }));
      return (
        <View testID="pantry-content">
          <Text>{props.userName}</Text>
          <Text>{props.householdName}</Text>
        </View>
      );
    }),
  };
});
jest.mock('#components/organisms/AnimatedItemSelector/AnimatedItemSelector', () => {
  const { forwardRef } = require('react');
  const { View } = require('react-native');
  return { AnimatedItemSelector: forwardRef((_: any, __: any) => <View testID="item-selector" />) };
});
jest.mock('#components/modals/ConsumePantryItemModal', () => ({ ConsumePantryItemModal: () => null }));
jest.mock('#components/modals/RecordWastePantryItemModal', () => ({ RecordWastePantryItemModal: () => null }));
jest.mock('#components/modals/RestockPantryItemModal', () => ({ RestockPantryItemModal: () => null }));
jest.mock('#components/modals/AddToPantrySheet/AddToPantrySheet', () => ({ AddToPantrySheet: () => null }));
jest.mock('#components/modals/AddStorageLocationSheet/AddStorageLocationSheet', () => ({ AddStorageLocationSheet: () => null }));
jest.mock('#/components/organisms/FeatureHintOverlay', () => ({ FeatureHintOverlay: () => null }));
jest.mock('#components/base/Skeleton/PantryScreenSkeleton', () => ({ PantryScreenSkeleton: () => null }));
jest.mock('#components/molecules/TabScreenHeader', () => ({ TabScreenHeader: () => null }));
jest.mock('#components/molecules/SearchBar', () => ({ SearchBar: () => null }));
jest.mock('#components/molecules/FilterTabs/FilterTabs', () => ({ FilterTabs: () => null }));

describe('PantryMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the pantry screen container', () => {
    render(<PantryMain />);
    expect(screen.getByTestId('pantry-screen')).toBeTruthy();
  });

  it('renders PantryContent with user name', () => {
    render(<PantryMain />);
    expect(screen.getByText('Test')).toBeTruthy();
  });

  it('renders PantryContent with household name', () => {
    render(<PantryMain />);
    expect(screen.getByText('My Home')).toBeTruthy();
  });

  it('renders the item selector', () => {
    render(<PantryMain />);
    expect(screen.getByTestId('item-selector')).toBeTruthy();
  });

  it('does not render modals when not visible', () => {
    render(<PantryMain />);
    // Modals are mocked to null, just confirm no crash
    expect(screen.getByTestId('pantry-screen')).toBeTruthy();
  });

  it('renders without crashing when no items', () => {
    render(<PantryMain />);
    expect(screen.getByTestId('pantry-content')).toBeTruthy();
  });
});
