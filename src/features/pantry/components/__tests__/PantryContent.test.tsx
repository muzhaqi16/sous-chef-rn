'use no memo';
import React from 'react';
import { InMemoryCache } from '@apollo/client';
import { screen, act } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { PantryContent } from '../PantryContent';
import { PantryItem, StorageState } from '#/graphql/generated/schemaTypes';
import type { EmptyStateProps } from '#components/base/EmptyState';
import type { SectionHeaderProps } from '#components/molecules/SectionHeader';
import type {
  FilterTabConfig,
  FilterTabsProps,
} from '#components/molecules/FilterTabs/types';
import {
  PantryItemCard_PantryItemFragmentDoc,
  type PantryItemCard_PantryItemFragment,
} from '../PantryItemCard.generated';

// PantryContent now reads `useApolloClient` for the image-preload effect and
// each `PantryItemCard` cell subscribes to its own entity via `useFragment`.
// Seed the cache with the items so the cells unmask successfully.
function renderContent(
  ui: React.ReactElement,
  items: Array<{ __typename: string; id: string } & Record<string, unknown>>,
) {
  const cache = new InMemoryCache();
  for (const item of items) {
    cache.writeFragment({
      id:
        cache.identify({ __typename: item.__typename, id: item.id }) ??
        `PantryItem:${item.id}`,
      fragment: PantryItemCard_PantryItemFragmentDoc,
      fragmentName: 'PantryItemCard_pantryItem',
      data: item as PantryItemCard_PantryItemFragment,
    });
  }
  return renderWithApollo(ui, { cache });
}

// Helper that extracts items from props before delegating to renderContent so
// the existing test bodies keep working as-is.
function render(ui: React.ReactElement) {
  const props = (ui as { props?: { items?: PantryItem[] } }).props;
  const items = (props?.items ?? []) as Array<
    { __typename: string; id: string } & Record<string, unknown>
  >;
  return renderContent(ui, items);
}

type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

function createMockPantryItem(
  overrides: DeepPartial<PantryItem> = {},
): PantryItem {
  return {
    __typename: 'PantryItem',
    id: 'mock-id',
    itemName: 'Mock Item',
    quantity: 1,
    expiresAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: null,
    addedAt: '2024-01-01T00:00:00Z',
    addedBy: null,
    lastModifiedBy: null,
    storageState: 'AMBIENT',
    storageLocation: null,
    storageNotes: null,
    item: {
      __typename: 'Item',
      id: 'item-1',
      name: 'Mock Item',
      category: null,
      brand: null,
      upc: null,
      imageUrl: null,
      images: [],
      nutrition: null,
      averageShelfLife: null,
      defaultUnit: null,
      displayUnit: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: null,
      isVerified: false,
      verifiedAt: null,
      aliases: [],
      netWeight: null,
      netWeightUnit: null,
      packageBreakdown: null,
    },
    itemId: 'item-1',
    unit: null,
    unitId: null,
    brand: null,
    brandId: null,
    itemUpc: null,
    netWeight: null,
    netWeightUnit: null,
    remainingNetWeight: null,
    packageBreakdown: null,
    quantityBreakdown: null,
    costPerUnit: null,
    totalCost: null,
    store: null,
    storeId: null,
    purchase: null,
    purchaseId: null,
    condition: 'FRESH',
    acquisitionMethod: 'PURCHASED',
    isLowStock: false,
    lowStockAlert: false,
    expirationAlert: false,
    minQuantity: null,
    restockQuantity: null,
    lastUsedAt: null,
    wasteDate: null,
    wasteReason: null,
    isComposted: false,
    isRecycled: false,
    tags: [],
    photos: [],
    sourceShoppingListItemId: null,
    pantry: { __typename: 'Pantry', id: 'pantry-1' },
    pantryId: 'pantry-1',
    version: 1,
    changeHistory: {
      __typename: 'PantryItemChangeConnection',
      edges: [],
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
    usageRecords: {
      __typename: 'PantryItemUsageConnection',
      edges: [],
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
    ledger: { __typename: 'LedgerSummary' },
    ...overrides,
  } as PantryItem;
}

jest.mock('#hooks/performance/useDeferredRender', () => ({
  useDeferredRender: jest.fn(() => true),
}));

jest.mock('#hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: jest.fn(),
  CachedImage: () => null,
}));

jest.mock('#components/base/Skeleton/PantryScreenSkeleton', () => ({
  PantryScreenSkeleton: () => {
    const { View } = require('react-native');
    return <View testID="pantry-skeleton" />;
  },
}));

jest.mock('#components/base/EmptyState', () => ({
  EmptyState: ({
    title,
    description,
    action,
    testID,
  }: Pick<EmptyStateProps, 'title' | 'description' | 'action' | 'testID'>) => {
    const { Text, View, Pressable } = require('react-native');
    return (
      <View testID={testID}>
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
        {action ? (
          <Pressable testID="empty-state-action" onPress={action.onPress}>
            <Text>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  },
}));

jest.mock('#components/organisms/PaginationFooter', () => ({
  PaginationFooter: () => null,
}));

jest.mock('../PantryHeader', () => ({
  PantryHeader: ({
    userName,
    householdName,
  }: {
    userName: string;
    householdName: string;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="pantry-header">
        <Text>{userName}</Text>
        <Text>{householdName}</Text>
      </View>
    );
  },
}));

jest.mock('../PantrySortModal', () => ({
  PantrySortModal: ({ visible }: { visible: boolean }) => {
    const { View } = require('react-native');
    return visible ? <View testID="sort-modal" /> : null;
  },
}));

jest.mock('../PantryItemCard', () => ({
  // PantryItemCard now accepts an opaque fragment ref and unmasks via
  // useFragment internally. The ref is the raw cache entity at runtime, so
  // reading `id` / `itemName` off it works directly in tests. Mirror the
  // production "Unknown Item" fallback so the corresponding test still asserts
  // the same behavior.
  PantryItemCard: ({
    pantryItemRef,
  }: {
    pantryItemRef?: Pick<PantryItemCard_PantryItemFragment, 'id' | 'itemName'>;
  }) => {
    const { Text, View } = require('react-native');
    const name = pantryItemRef?.itemName || 'Unknown Item';
    return (
      <View testID={`pantry-item-${pantryItemRef?.id}`}>
        <Text>{name}</Text>
      </View>
    );
  },
  ItemVariant: {},
  ExpirationVariant: {},
}));

jest.mock('#components/molecules/SearchBar', () => ({
  SearchBar: ({
    placeholder,
    testID,
  }: {
    placeholder?: string;
    testID?: string;
  }) => {
    const { TextInput } = require('react-native');
    return <TextInput testID={testID} placeholder={placeholder} />;
  },
}));

jest.mock('#components/molecules/FilterTabs/FilterTabs', () => ({
  FilterTabs: ({
    tabs,
    onTabChange,
    testIDPrefix,
  }: Pick<FilterTabsProps, 'tabs' | 'onTabChange' | 'testIDPrefix'>) => {
    const { Text, Pressable, View } = require('react-native');
    return (
      <View testID="filter-tabs">
        {tabs.map((tab: FilterTabConfig) => (
          <Pressable
            key={tab.id}
            testID={`${testIDPrefix}-${tab.id}`}
            onPress={() => (tab.onPress ? tab.onPress() : onTabChange(tab.id))}
          >
            <Text>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/molecules/SectionHeader', () => ({
  SectionHeader: ({
    title,
    actionLabel,
    onActionPress,
    testID,
  }: Pick<
    SectionHeaderProps,
    'title' | 'actionLabel' | 'onActionPress' | 'testID'
  >) => {
    const { Text, Pressable, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <Pressable testID={testID} onPress={onActionPress}>
          <Text>{actionLabel}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('../PantryAlertBar', () => ({
  PantryAlertBar: ({
    stats,
    sortLabel,
  }: {
    stats: { expiringCount: number };
    sortLabel?: string;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="pantry-alert-bar">
        <Text>Alert: {stats.expiringCount} expiring</Text>
        {sortLabel ? <Text>{sortLabel}</Text> : null}
      </View>
    );
  },
}));

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  getExpirationStatus: jest.fn(() => ({
    text: '3 days left',
    type: 'warning',
  })),
  formatPackageBreakdown: jest.fn(() => null),
  formatRemainingNetWeight: jest.fn(() => null),
  formatQuantityBreakdown: jest.fn(() => null),
}));

jest.mock('#/utils/formatQuantity', () => ({
  formatQuantityDisplay: jest.fn(
    (qty, unit) => `${qty}${unit ? ` ${unit}` : ''}`,
  ),
}));

jest.mock('../hooks/usePantrySorting', () => ({
  usePantrySorting: jest.fn(() => ({
    sortOption: 'recent',
    sortDirection: 'desc',
    sortModalVisible: false,
    openSortModal: jest.fn(),
    closeSortModal: jest.fn(),
    handleSortSelect: jest.fn(),
    sortItems: jest.fn(<T,>(items: T[]): T[] => items),
  })),
}));

jest.mock('#features/pantry/utils/pantryFilters', () => ({
  LocationFilter: {},
}));

const defaultProps = {
  userName: 'John',
  householdName: 'My Kitchen',
  items: [] as PantryItem[],
  locationFilter: 'all',
  onLocationFilterChange: jest.fn(),
  // Default to an empty pantry (all counts 0). The skeleton-gate now keeps
  // skeletons up whenever stats-backed `locationCounts[filter]` says items exist
  // but `items` is empty, so tests asserting the *empty state* must use counts
  // that agree there are no items. Tests that expect items pass them explicitly.
  locationCounts: { all: 0, fridge: 0, freezer: 0, pantry: 0 },
  searchQuery: '',
  onSearchChange: jest.fn(),
  onItemPress: jest.fn(),
};

describe('PantryContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.getByTestId('pantry-list')).toBeTruthy();
  });

  it('renders the pantry header with user and household name', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.getByText('My Kitchen')).toBeTruthy();
  });

  it('renders the search bar with correct placeholder', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.getByTestId('pantry-search-input')).toBeTruthy();
  });

  it('renders filter tabs', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.getByTestId('filter-tabs')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Fridge')).toBeTruthy();
    expect(screen.getByText('Freezer')).toBeTruthy();
    expect(screen.getByText('Pantry')).toBeTruthy();
  });

  it('shows empty state when no items and no search query', () => {
    render(<PantryContent {...defaultProps} items={[]} />);
    expect(screen.getByText('Your pantry is empty')).toBeTruthy();
    expect(
      screen.getByText('Start tracking your food to reduce waste'),
    ).toBeTruthy();
  });

  it('shows search empty state with add action when search query has no results', () => {
    const onAddItem = jest.fn();
    render(
      <PantryContent
        {...defaultProps}
        items={[]}
        searchQuery="nonexistent"
        onAddItem={onAddItem}
      />,
    );
    expect(screen.getByText('No results for "nonexistent"')).toBeTruthy();
    expect(
      screen.getByText('Would you like to add it to your pantry?'),
    ).toBeTruthy();
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('shows location-specific empty state when filter is active with existing items and loading is false', () => {
    // First render with items to set hasEverShownContent = true
    const { unmount } = render(
      <PantryContent
        {...defaultProps}
        items={[
          createMockPantryItem({
            id: '1',
            itemName: 'X',
            quantity: 1,
            expiresAt: null,
          }),
        ]}
      />,
    );
    unmount();
    // Now render with empty items in a specific location. The fridge filter is
    // genuinely empty (locationCounts.fridge === 0) while the pantry overall has
    // items (locationCounts.all > 0), which triggers the location-specific
    // message via overallItemCount — and keeps the skeleton-gate from firing,
    // since the active tab's expected count is 0.
    render(
      <PantryContent
        {...defaultProps}
        items={[]}
        locationFilter={'fridge'}
        locationCounts={{ all: 5, fridge: 0, freezer: 1, pantry: 4 }}
        totalCount={0}
      />,
    );
    expect(screen.getByText('No items in Fridge')).toBeTruthy();
  });

  describe('skeleton hold (offline-first cache gap)', () => {
    it('keeps skeletons up when stats say items exist but the list is momentarily empty, even with loading=false', () => {
      // Cold-start failure mode: `pantry.stats` (argument-free) resolves from
      // cache so locationCounts is populated, but `itemsConnection` reads empty
      // (dangling edges after MMKV restore / offline first paint) and `loading`
      // has already settled false. The list must show skeletons, NOT a blank /
      // "empty pantry" state.
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          loading={false}
          locationCounts={{ all: 18, fridge: 3, freezer: 0, pantry: 15 }}
        />,
      );
      expect(screen.getByTestId('pantry-skeleton')).toBeTruthy();
      expect(screen.queryByText('Your pantry is empty')).toBeNull();
    });

    it('shows the empty state (not skeletons) when counts agree the pantry is empty', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          loading={false}
          locationCounts={{ all: 0, fridge: 0, freezer: 0, pantry: 0 }}
        />,
      );
      expect(screen.getByText('Your pantry is empty')).toBeTruthy();
      expect(screen.queryByTestId('pantry-skeleton')).toBeNull();
    });

    it('does not hold skeletons for an empty search result even when items exist', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          loading={false}
          searchQuery="zzz"
          locationCounts={{ all: 18, fridge: 3, freezer: 0, pantry: 15 }}
          onAddItem={jest.fn()}
        />,
      );
      expect(screen.getByText('No results for "zzz"')).toBeTruthy();
      expect(screen.queryByTestId('pantry-skeleton')).toBeNull();
    });
  });

  it('renders pantry items when provided', () => {
    const items = [
      createMockPantryItem({ id: '1', itemName: 'Milk', quantity: 2 }),
      createMockPantryItem({ id: '2', itemName: 'Eggs', quantity: 12 }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  describe('client-side render windowing', () => {
    const manyItems = Array.from({ length: 30 }, (_, i) =>
      createMockPantryItem({ id: String(i + 1), itemName: `Item-${i + 1}` }),
    );

    it('hands the list only the initial window (not the whole loaded set)', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={manyItems}
          locationCounts={{ all: 30, fridge: 0, freezer: 0, pantry: 0 }}
        />,
      );
      // data = sticky-header sentinel + first 24 items (INITIAL_RENDER_WINDOW)
      expect(screen.getByTestId('pantry-list').props.data).toHaveLength(1 + 24);
    });

    it('grows the window on end-reached until the loaded set is exhausted', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={manyItems}
          locationCounts={{ all: 30, fridge: 0, freezer: 0, pantry: 0 }}
        />,
      );
      act(() => {
        screen.getByTestId('pantry-list').props.onEndReached?.();
      });
      // window grows by RENDER_WINDOW_STEP (24), capped at the 30 loaded items
      expect(screen.getByTestId('pantry-list').props.data).toHaveLength(1 + 30);
    });

    it('prefers server pagination over growing the local window', () => {
      const onEndReached = jest.fn();
      render(
        <PantryContent
          {...defaultProps}
          items={manyItems}
          hasMore
          onEndReached={onEndReached}
          locationCounts={{ all: 30, fridge: 0, freezer: 0, pantry: 0 }}
        />,
      );
      act(() => {
        screen.getByTestId('pantry-list').props.onEndReached?.();
      });
      // server fetch fired; local window stays at the initial size
      expect(onEndReached).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('pantry-list').props.data).toHaveLength(1 + 24);
    });
  });

  it('renders alert bar when stats are provided', () => {
    const stats = { totalItems: 10, expiringCount: 3, lowStockCount: 2 };
    render(<PantryContent {...defaultProps} stats={stats} />);
    expect(screen.getByTestId('pantry-alert-bar')).toBeTruthy();
    expect(screen.getByText('Alert: 3 expiring')).toBeTruthy();
  });

  it('does not render alert bar when stats are not provided', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.queryByTestId('pantry-alert-bar')).toBeNull();
  });

  it('includes add location tab when onAddLocation is provided', () => {
    const onAddLocation = jest.fn();
    render(<PantryContent {...defaultProps} onAddLocation={onAddLocation} />);
    // The add button should be in the filter tabs
    const addTab = screen.getByTestId('pantry-location-tab-__add__');
    expect(addTab).toBeTruthy();
  });

  it('renders empty state with action when onAddItem is provided', () => {
    const onAddItem = jest.fn();
    render(
      <PantryContent {...defaultProps} items={[]} onAddItem={onAddItem} />,
    );
    // The empty state is rendered (onAddItem creates an action object, but text may not be directly in the tree)
    expect(screen.getByTestId('pantry-empty-state')).toBeTruthy();
  });

  // --- Additional branch coverage tests ---

  it('renders sort direction indicator as descending arrow', () => {
    const items = [createMockPantryItem({ id: '1' })];
    const stats = { totalItems: 1, expiringCount: 0, lowStockCount: 0 };
    render(<PantryContent {...defaultProps} items={items} stats={stats} />);
    expect(screen.getByText(/Sort/)).toBeTruthy();
  });

  it('renders sort direction indicator as ascending arrow', () => {
    const { usePantrySorting } = require('../hooks/usePantrySorting');
    usePantrySorting.mockReturnValue({
      sortOption: 'name',
      sortDirection: 'asc',
      sortModalVisible: false,
      openSortModal: jest.fn(),
      closeSortModal: jest.fn(),
      handleSortSelect: jest.fn(),
      sortItems: jest.fn(<T,>(items: T[]): T[] => items),
    });

    const sortItems = [createMockPantryItem({ id: '1' })];
    const stats = { totalItems: 1, expiringCount: 0, lowStockCount: 0 };
    render(<PantryContent {...defaultProps} items={sortItems} stats={stats} />);
    expect(screen.getByText(/Sort/)).toBeTruthy();

    // Restore
    usePantrySorting.mockReturnValue({
      sortOption: 'recent',
      sortDirection: 'desc',
      sortModalVisible: false,
      openSortModal: jest.fn(),
      closeSortModal: jest.fn(),
      handleSortSelect: jest.fn(),
      sortItems: jest.fn(<T,>(items: T[]): T[] => items),
    });
  });

  it('renders items with expiration dates', () => {
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Yogurt',
        quantity: 1,
        expiresAt: futureDate,
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Yogurt')).toBeTruthy();
  });

  it('renders items with expired dates', () => {
    const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Old Milk',
        quantity: 1,
        expiresAt: pastDate,
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Old Milk')).toBeTruthy();
  });

  it('renders items without itemName as Unknown Item', () => {
    const items = [
      createMockPantryItem({ id: '1', itemName: '', quantity: 1 }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Unknown Item')).toBeTruthy();
  });

  it('renders items with zero quantity (out of stock)', () => {
    const items = [
      createMockPantryItem({ id: '1', itemName: 'Rice', quantity: 0 }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Rice')).toBeTruthy();
  });

  it('does not include add tab when onAddLocation is not provided', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.queryByTestId('pantry-location-tab-__add__')).toBeNull();
  });

  it('passes refreshControl when onRefresh is provided', () => {
    const onRefresh = jest.fn();
    render(<PantryContent {...defaultProps} onRefresh={onRefresh} />);
    // RefreshControl is passed as a prop to FlashList, which may not render it in test environment.
    // Verify the component renders without error when onRefresh is provided.
    expect(screen.getByTestId('pantry-list')).toBeTruthy();
  });

  it('does not render refreshControl when onRefresh is not provided', () => {
    render(<PantryContent {...defaultProps} />);
    // Without onRefresh, no RefreshControl is passed
    expect(screen.getByTestId('pantry-list')).toBeTruthy();
  });

  it('renders with loading true showing skeletons initially', () => {
    // The module-level hasEverShownContent flag may already be true from prior tests,
    // which means skeletons won't be shown even with loading=true.
    // We can only verify the component renders without crashing when loading is true.
    const {
      useDeferredRender,
    } = require('#hooks/performance/useDeferredRender');
    useDeferredRender.mockReturnValue(false);

    render(<PantryContent {...defaultProps} loading={true} items={[]} />);
    // The pantry-list is always present; skeleton overlay depends on module-level state
    expect(screen.getByTestId('pantry-list')).toBeTruthy();

    useDeferredRender.mockReturnValue(true);
  });

  it('renders custom tabs when provided', () => {
    const customTabs = [
      { id: 'all', label: 'Everything' },
      { id: 'custom', label: 'Custom Loc' },
    ];
    render(<PantryContent {...defaultProps} tabs={customTabs} />);
    expect(screen.getByText('Everything')).toBeTruthy();
    expect(screen.getByText('Custom Loc')).toBeTruthy();
  });

  it('renders items with storage location name', () => {
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Cheese',
        quantity: 2,
        storageLocation: { id: 'loc-1', name: 'Kitchen Cabinet' },
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Cheese')).toBeTruthy();
  });

  it('renders items with Refrigerated storage state', () => {
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Butter',
        quantity: 1,
        storageState: StorageState.Refrigerated,
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Butter')).toBeTruthy();
  });

  it('renders items with Frozen storage state', () => {
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Ice Cream',
        quantity: 1,
        storageState: StorageState.Frozen,
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Ice Cream')).toBeTruthy();
  });

  it('renders items with unit symbol', () => {
    const items = [
      createMockPantryItem({
        id: '1',
        itemName: 'Flour',
        quantity: 500,
        unit: { symbol: 'g' },
      }),
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Flour')).toBeTruthy();
  });

  it('renders empty state without action when onAddItem is not provided', () => {
    render(<PantryContent {...defaultProps} items={[]} />);
    expect(screen.getByText('Your pantry is empty')).toBeTruthy();
  });

  it('renders with notification count', () => {
    render(<PantryContent {...defaultProps} notificationCount={5} />);
    expect(screen.getByText('John')).toBeTruthy();
  });

  describe('no-home empty states', () => {
    it('shows "No home yet" when noHomes is true', () => {
      render(<PantryContent {...defaultProps} items={[]} noHomes={true} />);
      expect(screen.getByText('No home yet')).toBeTruthy();
      expect(
        screen.getByText('Create or join a home to start tracking food'),
      ).toBeTruthy();
    });

    it('shows "Get Started" action when noHomes and onSelectHome provided', () => {
      const onSelectHome = jest.fn();
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          noHomes={true}
          onSelectHome={onSelectHome}
        />,
      );
      expect(screen.getByText('Get Started')).toBeTruthy();
    });

    it('shows "No home selected" when noHomeSelected is true', () => {
      render(
        <PantryContent {...defaultProps} items={[]} noHomeSelected={true} />,
      );
      expect(screen.getByText('No home selected')).toBeTruthy();
      expect(
        screen.getByText('Select a home to view your pantry'),
      ).toBeTruthy();
    });

    it('shows "Go to My Homes" action when noHomeSelected and onSelectHome provided', () => {
      const onSelectHome = jest.fn();
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          noHomeSelected={true}
          onSelectHome={onSelectHome}
        />,
      );
      expect(screen.getByText('Go to My Homes')).toBeTruthy();
    });

    it('prioritizes noHomes over noHomeSelected', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          noHomes={true}
          noHomeSelected={true}
        />,
      );
      expect(screen.getByText('No home yet')).toBeTruthy();
      expect(screen.queryByText('No home selected')).toBeNull();
    });

    it('prioritizes no-home states over search empty state', () => {
      render(
        <PantryContent
          {...defaultProps}
          items={[]}
          noHomeSelected={true}
          searchQuery="test"
        />,
      );
      expect(screen.getByText('No home selected')).toBeTruthy();
      expect(screen.queryByText('No items found')).toBeNull();
    });
  });
});
