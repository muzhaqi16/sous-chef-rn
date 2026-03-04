'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryMain } from '../PantryMain';

// --- Prop capture for PantryContent ---
let capturedPantryContentProps: Record<string, any> = {};

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

// --- Hybrid search hook ---
const mockHybridSearch = {
  searchQuery: '',
  setSearchQuery: jest.fn((q: string) => { mockHybridSearch.searchQuery = q; }),
  debouncedSearch: '',
  searchActive: false,
  useServerSort: false,
  activeItems: [] as Array<{ id: string; itemName: string; quantity: number }>,
  isSearching: false,
  removeFromResults: jest.fn(),
};
jest.mock('#hooks/search/useHybridSearch', () => ({
  useHybridSearch: jest.fn(() => mockHybridSearch),
}));

// --- Pantry hooks ---
jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: jest.fn(() => ({
    items: [],
    stats: { totalItems: 0, expiringCount: 0, lowStockCount: 0 },
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
  })),
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
const mockUseCurrentPantry = jest.fn(() => ({
  pantry: { id: 'p1', name: 'Kitchen' },
  pantries: [{ id: 'p1', name: 'Kitchen' }],
  currentHome: { name: 'My Home' },
  selectedHomeId: 'h1',
  setSelectedPantryId: jest.fn(),
  homeCount: 1,
  isReady: true,
}));
jest.mock('#hooks/pantry/useCurrentPantry', () => ({
  useCurrentPantry: () => mockUseCurrentPantry(),
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
  const { forwardRef, useImperativeHandle, useEffect } = require('react');
  const { View, Text } = require('react-native');
  return {
    PantryContent: forwardRef((props: any, ref: any) => {
      useImperativeHandle(ref, () => ({ scrollToTop: jest.fn() }));
      useEffect(() => {
        capturedPantryContentProps = props;
      });
      return (
        <View testID="pantry-content">
          <Text>{props.userName}</Text>
          <Text>{props.householdName}</Text>
          <Text testID="prop-stats">{JSON.stringify(props.stats)}</Text>
          <Text testID="prop-totalCount">{String(props.totalCount)}</Text>
          <Text testID="prop-loading">{String(props.loading)}</Text>
          <Text testID="prop-itemCount">{String(props.items?.length ?? 0)}</Text>
          <Text testID="prop-hasMore">{String(props.hasMore)}</Text>
          <Text testID="prop-isLoadingMore">{String(props.isLoadingMore)}</Text>
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

// --- Per-test mock override helper ---
const defaultPantryManagement = {
  items: [] as Array<{ id: string; itemName: string; quantity: number }>,
  stats: { totalItems: 0, expiringCount: 0, lowStockCount: 0 } as {
    totalItems: number;
    expiringCount: number;
    lowStockCount: number;
  } | null,
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
};

function mockPantryManagement(overrides: Partial<typeof defaultPantryManagement> = {}) {
  const { usePantryManagement } = jest.requireMock('#hooks/home/pantry/usePantryManagement');
  usePantryManagement.mockReturnValue({ ...defaultPantryManagement, ...overrides });
}

function mockHybridSearchState(overrides: Partial<typeof mockHybridSearch> = {}) {
  const { useHybridSearch } = jest.requireMock('#hooks/search/useHybridSearch');
  const state = { ...mockHybridSearch, ...overrides };
  useHybridSearch.mockReturnValue(state);
  return state;
}

describe('PantryMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPantryContentProps = {};
    // Reset hybrid search to defaults
    mockHybridSearch.searchQuery = '';
    mockHybridSearch.debouncedSearch = '';
    mockHybridSearch.searchActive = false;
    mockHybridSearch.useServerSort = false;
    mockHybridSearch.activeItems = [];
    mockHybridSearch.isSearching = false;
    mockHybridSearch.removeFromResults = jest.fn();
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

  describe('passes hook data as props to PantryContent', () => {
    it('passes stats to PantryContent when stats exist', () => {
      const stats = { totalItems: 12, expiringCount: 3, lowStockCount: 2 };
      mockPantryManagement({ stats });
      render(<PantryMain />);
      expect(capturedPantryContentProps.stats).toEqual(stats);
    });

    it('passes null stats when hook returns null', () => {
      mockPantryManagement({ stats: null });
      render(<PantryMain />);
      expect(capturedPantryContentProps.stats).toBeNull();
    });

    it('passes totalCount to PantryContent', () => {
      mockPantryManagement({ totalCount: 42 });
      render(<PantryMain />);
      expect(capturedPantryContentProps.totalCount).toBe(42);
      expect(screen.getByTestId('prop-totalCount')).toHaveTextContent('42');
    });

    it('passes loading=true when loading with no items', () => {
      mockPantryManagement({ loading: true, items: [] });
      render(<PantryMain />);
      expect(capturedPantryContentProps.loading).toBe(true);
      expect(screen.getByTestId('prop-loading')).toHaveTextContent('true');
    });

    it('passes items array to PantryContent', () => {
      const items = [
        { id: 'i1', itemName: 'Milk', quantity: 1 },
        { id: 'i2', itemName: 'Eggs', quantity: 12 },
      ];
      mockHybridSearchState({ activeItems: items });
      mockPantryManagement({ totalCount: 2 });
      render(<PantryMain />);
      expect(capturedPantryContentProps.items).toHaveLength(2);
      expect(screen.getByTestId('prop-itemCount')).toHaveTextContent('2');
    });

    it('passes pagination props (hasMore, isLoadingMore, onEndReached)', () => {
      const loadMore = jest.fn();
      mockPantryManagement({ hasMore: true, isLoadingMore: true, loadMore });
      render(<PantryMain />);
      expect(capturedPantryContentProps.hasMore).toBe(true);
      expect(capturedPantryContentProps.isLoadingMore).toBe(true);
      expect(capturedPantryContentProps.onEndReached).toBe(loadMore);
    });
  });

  describe('no-home states', () => {
    it('passes noHomeSelected=true when ready, no home selected, but homes exist', () => {
      mockUseCurrentPantry.mockReturnValue({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        setSelectedPantryId: jest.fn(),
        homeCount: 3,
        isReady: true,
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomeSelected).toBe(true);
      expect(capturedPantryContentProps.noHomes).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe('Tap to select a home');
    });

    it('passes noHomes=true when ready, no home selected, and no homes exist', () => {
      mockUseCurrentPantry.mockReturnValue({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        setSelectedPantryId: jest.fn(),
        homeCount: 0,
        isReady: true,
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomes).toBe(true);
      expect(capturedPantryContentProps.noHomeSelected).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe('No homes yet');
    });

    it('passes onSelectHome callback that navigates to HomeManagement', () => {
      mockUseCurrentPantry.mockReturnValue({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        setSelectedPantryId: jest.fn(),
        homeCount: 3,
        isReady: true,
      });
      render(<PantryMain />);
      expect(typeof capturedPantryContentProps.onSelectHome).toBe('function');
    });

    it('passes noHomeSelected=false and noHomes=false when home is selected', () => {
      mockUseCurrentPantry.mockReturnValue({
        pantry: { id: 'p1', name: 'Kitchen' },
        pantries: [{ id: 'p1', name: 'Kitchen' }],
        currentHome: { name: 'My Home' },
        selectedHomeId: 'h1',
        setSelectedPantryId: jest.fn(),
        homeCount: 1,
        isReady: true,
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomeSelected).toBe(false);
      expect(capturedPantryContentProps.noHomes).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe('My Home');
    });
  });

  describe('hybrid search integration', () => {
    it('passes useServerSort from hook to PantryContent', () => {
      mockHybridSearchState({ useServerSort: true, searchActive: true });
      mockPantryManagement({ hasMore: true, totalCount: 55 });

      render(<PantryMain />);

      expect(capturedPantryContentProps.useServerSort).toBe(true);
    });

    it('suppresses pagination indicators when search is active', () => {
      mockHybridSearchState({ searchActive: true, useServerSort: true });
      mockPantryManagement({ hasMore: true, isLoadingMore: true });

      render(<PantryMain />);

      expect(capturedPantryContentProps.hasMore).toBe(false);
      expect(capturedPantryContentProps.isLoadingMore).toBe(false);
      expect(capturedPantryContentProps.onEndReached).toBeDefined();
    });

    it('passes items from hook as activeItems to PantryContent', () => {
      const items = [
        { id: 'i1', itemName: 'Milk', quantity: 1 },
        { id: 'i2', itemName: 'Eggs', quantity: 12 },
      ];
      mockHybridSearchState({ activeItems: items });
      mockPantryManagement({ totalCount: 2 });

      render(<PantryMain />);

      expect(capturedPantryContentProps.items).toHaveLength(2);
    });

    it('uses local search when useServerSort is false', () => {
      mockHybridSearchState({ useServerSort: false });
      mockPantryManagement({ totalCount: 55, hasMore: false });

      render(<PantryMain />);

      expect(capturedPantryContentProps.useServerSort).toBe(false);
    });

    it('passes searchQuery and setSearchQuery from hook to PantryContent', () => {
      mockHybridSearchState({ searchQuery: 'test' });

      render(<PantryMain />);

      expect(capturedPantryContentProps.searchQuery).toBe('test');
      expect(typeof capturedPantryContentProps.onSearchChange).toBe('function');
    });
  });
});
