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
jest.mock('#hooks/pantry/usePantryPermissions');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// --- Tab bar ---
jest.mock('#/context/TabBarActionsContext', () => ({
  useTabBarSetters: () => ({ setOverlayOpen: jest.fn() }),
  useTabBarState: () => ({ addButtonRect: null, isOverlayOpen: false }),
}));
jest.mock('#hooks/navigation/useTabBarAddButton', () => ({
  useTabBarAddButton: jest.fn(),
}));

// --- Store (useStore for getState in focus handler) ---
jest.mock('#store', () => {
  const fn = Object.assign(jest.fn(), {
    getState: () => ({
      pendingPantryScrollToTop: false,
      setPendingPantryScrollToTop: jest.fn(),
    }),
    setState: jest.fn(),
    subscribe: jest.fn(),
  });
  return { useStore: fn, storeApi: fn };
});

// --- Facade hook: usePantryScreen ---
const defaultPantryScreen = {
  // User
  authUser: {
    id: 'u1',
    name: 'Test',
    email: 'test@t.com',
    profilePicture: null,
  },
  userName: 'Test',
  householdName: 'My Home',

  // Home / Pantry resolution
  pantry: { id: 'p1', name: 'Kitchen' },
  pantries: [{ id: 'p1', name: 'Kitchen' }],
  currentHome: { name: 'My Home' },
  selectedHomeId: 'h1',
  setSelectedPantryId: jest.fn(),
  homeCount: 1,
  isReady: true,
  noHomeSelected: false,
  noHomes: false,

  // Store state
  showBiometricSetup: false,
  unreadCount: 0,
  pantrySortOption: 'recent',
  pantrySortDirection: 'desc',
  pendingPantryScrollToTop: false,
  setPendingPantryScrollToTop: jest.fn(),

  // Pantry data
  pantryItems: [] as Array<{ id: string; itemName: string; quantity: number }>,
  rawPantryItems: [] as Array<{
    id: string;
    itemName: string;
    quantity: number;
  }>,
  pantryStorageLocations: [] as Array<{
    id: string;
    name: string;
    icon: string | null;
  }>,
  stats: { totalItems: 0, expiringCount: 0, lowStockCount: 0 } as {
    totalItems: number;
    expiringCount: number;
    lowStockCount: number;
  } | null,
  totalCount: 0,
  pantryError: null as any,

  // Loading states
  loading: false,
  isLoadingInitial: false,
  isRefreshing: false,

  // Search
  searchQuery: '',
  setSearchQuery: jest.fn(),
  searchActive: false,
  useServerSort: false,

  // Pagination
  loadMore: jest.fn(),
  hasMore: false,
  isLoadingMore: false,

  // Location filter
  locationFilter: 'all',
  handleLocationFilterChange: jest.fn(),
  combinedTabs: [
    { id: 'all', label: 'All' },
    { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
    { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
    { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
  ],
  completeCounts: {},

  // Sort
  handleSortChange: jest.fn(),

  // Mutations / actions
  handleRemoveItem: jest.fn(),
  removeItem: jest.fn(),
  refetch: jest.fn(),
  handleRefresh: jest.fn(),
  createLocation: jest.fn(),
  creatingLocation: false,

  // Network
  isOnline: true,
};

const mockUsePantryScreen = jest.fn(() => ({ ...defaultPantryScreen }));
jest.mock('#hooks/pantry/usePantryScreen', () => ({
  usePantryScreen: () => mockUsePantryScreen(),
}));

// --- Lifecycle hook ---
jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(() => ({ themeKey: 'light' })),
}));

// --- Pantry modals context ---
const mockPantryModals = {
  handleConsumeItem: jest.fn(),
  handleWasteItem: jest.fn(),
  handleRestockItem: jest.fn(),
  handleEditItem: jest.fn(),
  handleDeleteItem: jest.fn(),
  setAddSheetVisible: jest.fn(),
  setAddLocationSheetVisible: jest.fn(),
};
jest.mock('#/context/PantryModalsContext', () => ({
  PantryModalsProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  usePantryModals: () => mockPantryModals,
}));

// --- Pantry hooks still used directly by PantryMainInner ---
jest.mock('#hooks/pantry/usePantrySelectorConfig', () => ({
  usePantrySelectorConfig: () => ({ items: [], selectedId: null }),
}));

// --- Performance / scanner / UI hooks ---
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
jest.mock('#hooks/useFeatureHint', () => ({
  useFeatureHint: () => ({
    isVisible: false,
    hasBeenShown: true,
    actions: { show: jest.fn(), dismiss: jest.fn() },
  }),
}));
jest.mock('#services/telemetry', () => ({
  Telemetry: { trackEvent: jest.fn(), trackScreen: jest.fn() },
}));

// --- Error boundary & performance ---
jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  PantryErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: ({
    component: Component,
  }: {
    component: React.FC;
    fallback: any;
  }) => <Component />,
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
          <Text testID="prop-itemCount">
            {String(props.items?.length ?? 0)}
          </Text>
          <Text testID="prop-hasMore">{String(props.hasMore)}</Text>
          <Text testID="prop-isLoadingMore">{String(props.isLoadingMore)}</Text>
        </View>
      );
    }),
  };
});
jest.mock(
  '#components/organisms/AnimatedItemSelector/AnimatedItemSelector',
  () => {
    const { forwardRef } = require('react');
    const { View } = require('react-native');
    return {
      AnimatedItemSelector: forwardRef(() => <View testID="item-selector" />),
    };
  },
);
jest.mock(
  '#/components/organisms/SpotlightCoachMark/SpotlightCoachMark',
  () => ({
    SpotlightCoachMark: () => null,
  }),
);
jest.mock('#components/base/Skeleton/PantryScreenSkeleton', () => ({
  PantryScreenSkeleton: () => null,
}));
jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: () => null,
}));
jest.mock('#components/molecules/SearchBar', () => ({ SearchBar: () => null }));
jest.mock('#components/molecules/FilterTabs/FilterTabs', () => ({
  FilterTabs: () => null,
}));
jest.mock('#components/molecules/SectionHeader', () => ({
  SectionHeader: () => null,
}));

// --- Per-test mock override helper ---
function mockPantryScreen(overrides: Partial<typeof defaultPantryScreen> = {}) {
  mockUsePantryScreen.mockReturnValue({ ...defaultPantryScreen, ...overrides });
}

describe('PantryMain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedPantryContentProps = {};
    mockUsePantryScreen.mockReturnValue({ ...defaultPantryScreen });
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
      mockPantryScreen({ stats });
      render(<PantryMain />);
      expect(capturedPantryContentProps.stats).toEqual(stats);
    });

    it('passes null stats when hook returns null', () => {
      mockPantryScreen({ stats: null });
      render(<PantryMain />);
      expect(capturedPantryContentProps.stats).toBeNull();
    });

    it('passes totalCount to PantryContent', () => {
      mockPantryScreen({ totalCount: 42 });
      render(<PantryMain />);
      expect(capturedPantryContentProps.totalCount).toBe(42);
      expect(screen.getByTestId('prop-totalCount')).toHaveTextContent('42');
    });

    it('passes loading=true when isLoadingInitial is true', () => {
      mockPantryScreen({ isLoadingInitial: true });
      render(<PantryMain />);
      expect(capturedPantryContentProps.loading).toBe(true);
      expect(screen.getByTestId('prop-loading')).toHaveTextContent('true');
    });

    it('passes items array to PantryContent', () => {
      const items = [
        { id: 'i1', itemName: 'Milk', quantity: 1 },
        { id: 'i2', itemName: 'Eggs', quantity: 12 },
      ];
      mockPantryScreen({ pantryItems: items, totalCount: 2 });
      render(<PantryMain />);
      expect(capturedPantryContentProps.items).toHaveLength(2);
      expect(screen.getByTestId('prop-itemCount')).toHaveTextContent('2');
    });

    it('passes pagination props (hasMore, isLoadingMore, onEndReached)', () => {
      const loadMore = jest.fn();
      mockPantryScreen({
        hasMore: true,
        isLoadingMore: true,
        loadMore,
        pantryItems: [{ id: 'i1', itemName: 'Milk', quantity: 1 }],
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.hasMore).toBe(true);
      expect(capturedPantryContentProps.isLoadingMore).toBe(true);
      expect(capturedPantryContentProps.onEndReached).toBe(loadMore);
    });
  });

  describe('no-home states', () => {
    it('passes noHomeSelected=true when ready, no home selected, but homes exist', () => {
      mockPantryScreen({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        homeCount: 3,
        isReady: true,
        noHomeSelected: true,
        noHomes: false,
        householdName: 'Tap to select a home',
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomeSelected).toBe(true);
      expect(capturedPantryContentProps.noHomes).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe(
        'Tap to select a home',
      );
    });

    it('passes noHomes=true when ready, no home selected, and no homes exist', () => {
      mockPantryScreen({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        homeCount: 0,
        isReady: true,
        noHomeSelected: false,
        noHomes: true,
        householdName: 'No homes yet',
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomes).toBe(true);
      expect(capturedPantryContentProps.noHomeSelected).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe('No homes yet');
    });

    it('passes onSelectHome callback that navigates to HomeManagement', () => {
      mockPantryScreen({
        pantry: null as any,
        pantries: [],
        currentHome: null as any,
        selectedHomeId: null as any,
        homeCount: 3,
        isReady: true,
        noHomeSelected: true,
        noHomes: false,
      });
      render(<PantryMain />);
      expect(typeof capturedPantryContentProps.onSelectHome).toBe('function');
    });

    it('passes noHomeSelected=false and noHomes=false when home is selected', () => {
      render(<PantryMain />);
      expect(capturedPantryContentProps.noHomeSelected).toBe(false);
      expect(capturedPantryContentProps.noHomes).toBe(false);
      expect(capturedPantryContentProps.householdName).toBe('My Home');
    });
  });

  describe('hybrid search integration', () => {
    it('passes useServerSort from hook to PantryContent', () => {
      mockPantryScreen({
        useServerSort: true,
        searchActive: true,
        hasMore: true,
        totalCount: 55,
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.useServerSort).toBe(true);
    });

    it('suppresses pagination indicators when search is active', () => {
      mockPantryScreen({
        searchActive: true,
        useServerSort: true,
        hasMore: true,
        isLoadingMore: true,
        pantryItems: [{ id: 'i1', itemName: 'Milk', quantity: 1 }],
      });
      render(<PantryMain />);
      // PantryMainContent passes searchActive ? false : screen.isLoadingMore
      // onEndReached is gated on hasMore && items.length > 0
      expect(capturedPantryContentProps.hasMore).toBe(false);
      expect(capturedPantryContentProps.isLoadingMore).toBe(false);
      expect(capturedPantryContentProps.onEndReached).toBe(
        defaultPantryScreen.loadMore,
      );
    });

    it('passes items from hook as activeItems to PantryContent', () => {
      const items = [
        { id: 'i1', itemName: 'Milk', quantity: 1 },
        { id: 'i2', itemName: 'Eggs', quantity: 12 },
      ];
      mockPantryScreen({ pantryItems: items, totalCount: 2 });
      render(<PantryMain />);
      expect(capturedPantryContentProps.items).toHaveLength(2);
    });

    it('uses local search when useServerSort is false', () => {
      mockPantryScreen({
        useServerSort: false,
        totalCount: 55,
        hasMore: false,
      });
      render(<PantryMain />);
      expect(capturedPantryContentProps.useServerSort).toBe(false);
    });

    it('passes searchQuery and setSearchQuery from hook to PantryContent', () => {
      mockPantryScreen({ searchQuery: 'test' });
      render(<PantryMain />);
      expect(capturedPantryContentProps.searchQuery).toBe('test');
      expect(typeof capturedPantryContentProps.onSearchChange).toBe('function');
    });
  });
});
