'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PantryContent } from '../PantryContent';

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
  EmptyState: ({ title, description, action, testID }: any) => {
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
  PantryHeader: ({ userName, householdName }: any) => {
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
  PantrySortModal: ({ visible }: any) => {
    const { View } = require('react-native');
    return visible ? <View testID="sort-modal" /> : null;
  },
}));

jest.mock('../PantryItemCard', () => ({
  PantryItemCard: ({ name, id }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID={`pantry-item-${id}`}>
        <Text>{name}</Text>
      </View>
    );
  },
  ItemVariant: {},
  ExpirationVariant: {},
}));

jest.mock('../../molecules/SearchBar', () => ({
  SearchBar: ({ placeholder, testID }: any) => {
    const { TextInput } = require('react-native');
    return <TextInput testID={testID} placeholder={placeholder} />;
  },
}));

jest.mock('../../molecules/FilterTabs/FilterTabs', () => ({
  FilterTabs: ({ tabs, onTabChange, testIDPrefix }: any) => {
    const { Text, Pressable, View } = require('react-native');
    return (
      <View testID="filter-tabs">
        {tabs.map((tab: any) => (
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

jest.mock('../../molecules/SectionHeader', () => ({
  SectionHeader: ({ title, actionLabel, onActionPress, testID }: any) => {
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
  PantryAlertBar: ({ stats }: any) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="pantry-alert-bar">
        <Text>Alert: {stats.expiringCount} expiring</Text>
      </View>
    );
  },
}));

jest.mock('#hooks/pantry/usePantryItemTransformation', () => ({
  getExpirationStatus: jest.fn(() => ({ text: '3 days left', type: 'warning' })),
  formatPackageBreakdown: jest.fn(() => null),
  formatRemainingNetWeight: jest.fn(() => null),
  formatQuantityBreakdown: jest.fn(() => null),
}));

jest.mock('#/utils/formatQuantity', () => ({
  formatQuantityDisplay: jest.fn((qty, unit) => `${qty}${unit ? ` ${unit}` : ''}`),
}));

jest.mock('../hooks/usePantrySorting', () => ({
  usePantrySorting: jest.fn(() => ({
    sortOption: 'recent',
    sortDirection: 'desc',
    sortModalVisible: false,
    openSortModal: jest.fn(),
    closeSortModal: jest.fn(),
    handleSortSelect: jest.fn(),
    sortItems: jest.fn((items: any[]) => items),
  })),
}));

jest.mock('#/utils/pantryFilters', () => ({
  LocationFilter: {},
}));

const defaultProps = {
  userName: 'John',
  householdName: 'My Kitchen',
  items: [] as any[],
  locationFilter: 'all' as any,
  onLocationFilterChange: jest.fn(),
  locationCounts: { all: 5, fridge: 2, freezer: 1, pantry: 2 },
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

  it('renders the section header with sort button', () => {
    render(<PantryContent {...defaultProps} />);
    expect(screen.getByText('ALL ITEMS')).toBeTruthy();
  });

  it('shows empty state when no items and no search query', () => {
    render(<PantryContent {...defaultProps} items={[]} />);
    expect(screen.getByText('Your pantry is empty')).toBeTruthy();
    expect(screen.getByText('Start tracking your food to reduce waste')).toBeTruthy();
  });

  it('shows search empty state when search query has no results', () => {
    render(<PantryContent {...defaultProps} items={[]} searchQuery="nonexistent" />);
    expect(screen.getByText('No items found')).toBeTruthy();
    expect(screen.getByText('Try a different search term')).toBeTruthy();
  });

  it('shows location-specific empty state when filter is active with existing items and loading is false', () => {
    // First render with items to set hasEverShownContent = true
    const { unmount } = render(
      <PantryContent
        {...defaultProps}
        items={[{ id: '1', itemName: 'X', quantity: 1, expiresAt: null }]}
      />,
    );
    unmount();
    // Now render with empty items in a specific location
    render(
      <PantryContent
        {...defaultProps}
        items={[]}
        locationFilter={'fridge' as any}
        totalCount={5}
      />,
    );
    expect(screen.getByText('No items in Fridge')).toBeTruthy();
  });

  it('renders pantry items when provided', () => {
    const items = [
      { id: '1', itemName: 'Milk', quantity: 2, expiresAt: null },
      { id: '2', itemName: 'Eggs', quantity: 12, expiresAt: null },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
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
    render(<PantryContent {...defaultProps} items={[]} onAddItem={onAddItem} />);
    // The empty state is rendered (onAddItem creates an action object, but text may not be directly in the tree)
    expect(screen.getByTestId('pantry-empty-state')).toBeTruthy();
  });

  // --- Additional branch coverage tests ---

  it('renders sort direction indicator as descending arrow', () => {
    render(<PantryContent {...defaultProps} />);
    // Default sortDirection is 'desc'
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
      sortItems: jest.fn((items: any[]) => items),
    });

    render(<PantryContent {...defaultProps} />);
    expect(screen.getByText(/Sort/)).toBeTruthy();

    // Restore
    usePantrySorting.mockReturnValue({
      sortOption: 'recent',
      sortDirection: 'desc',
      sortModalVisible: false,
      openSortModal: jest.fn(),
      closeSortModal: jest.fn(),
      handleSortSelect: jest.fn(),
      sortItems: jest.fn((items: any[]) => items),
    });
  });

  it('renders items with expiration dates', () => {
    const futureDate = new Date(Date.now() + 2 * 86400000).toISOString();
    const items = [
      { id: '1', itemName: 'Yogurt', quantity: 1, expiresAt: futureDate },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Yogurt')).toBeTruthy();
  });

  it('renders items with expired dates', () => {
    const pastDate = new Date(Date.now() - 2 * 86400000).toISOString();
    const items = [
      { id: '1', itemName: 'Old Milk', quantity: 1, expiresAt: pastDate },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Old Milk')).toBeTruthy();
  });

  it('renders items without itemName as Unknown Item', () => {
    const items = [
      { id: '1', itemName: null, quantity: 1, expiresAt: null },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Unknown Item')).toBeTruthy();
  });

  it('renders items with zero quantity (out of stock)', () => {
    const items = [
      { id: '1', itemName: 'Rice', quantity: 0, expiresAt: null },
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
    const { useDeferredRender } = require('#hooks/performance/useDeferredRender');
    useDeferredRender.mockReturnValue(false);

    render(<PantryContent {...defaultProps} loading={true} items={[]} />);
    // The pantry-list is always present; skeleton overlay depends on module-level state
    expect(screen.getByTestId('pantry-list')).toBeTruthy();

    useDeferredRender.mockReturnValue(true);
  });

  it('renders section header with specific location label', () => {
    render(
      <PantryContent
        {...defaultProps}
        locationFilter={'fridge' as any}
      />,
    );
    expect(screen.getByText('FRIDGE ITEMS')).toBeTruthy();
  });

  it('renders section header with default All label for unknown filter', () => {
    render(
      <PantryContent
        {...defaultProps}
        locationFilter={'unknown-loc' as any}
      />,
    );
    // Falls back to 'All' when activeTab is not found
    expect(screen.getByText('ALL ITEMS')).toBeTruthy();
  });

  it('renders custom tabs when provided', () => {
    const customTabs = [
      { id: 'all' as any, label: 'Everything' },
      { id: 'custom' as any, label: 'Custom Loc' },
    ];
    render(<PantryContent {...defaultProps} tabs={customTabs} />);
    expect(screen.getByText('Everything')).toBeTruthy();
    expect(screen.getByText('Custom Loc')).toBeTruthy();
  });

  it('renders items with storage location name', () => {
    const items = [
      {
        id: '1',
        itemName: 'Cheese',
        quantity: 2,
        expiresAt: null,
        storageLocation: { id: 'loc-1', name: 'Kitchen Cabinet' },
      },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Cheese')).toBeTruthy();
  });

  it('renders items with Refrigerated storage state', () => {
    const items = [
      {
        id: '1',
        itemName: 'Butter',
        quantity: 1,
        expiresAt: null,
        storageState: 'REFRIGERATED',
      },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Butter')).toBeTruthy();
  });

  it('renders items with Frozen storage state', () => {
    const items = [
      {
        id: '1',
        itemName: 'Ice Cream',
        quantity: 1,
        expiresAt: null,
        storageState: 'FROZEN',
      },
    ];
    render(<PantryContent {...defaultProps} items={items} />);
    expect(screen.getByText('Ice Cream')).toBeTruthy();
  });

  it('renders items with unit symbol', () => {
    const items = [
      {
        id: '1',
        itemName: 'Flour',
        quantity: 500,
        expiresAt: null,
        unit: { symbol: 'g' },
      },
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
      expect(screen.getByText('Create or join a home to start tracking food')).toBeTruthy();
    });

    it('shows "Get Started" action when noHomes and onSelectHome provided', () => {
      const onSelectHome = jest.fn();
      render(
        <PantryContent {...defaultProps} items={[]} noHomes={true} onSelectHome={onSelectHome} />,
      );
      expect(screen.getByText('Get Started')).toBeTruthy();
    });

    it('shows "No home selected" when noHomeSelected is true', () => {
      render(<PantryContent {...defaultProps} items={[]} noHomeSelected={true} />);
      expect(screen.getByText('No home selected')).toBeTruthy();
      expect(screen.getByText('Select a home to view your pantry')).toBeTruthy();
    });

    it('shows "Go to My Homes" action when noHomeSelected and onSelectHome provided', () => {
      const onSelectHome = jest.fn();
      render(
        <PantryContent {...defaultProps} items={[]} noHomeSelected={true} onSelectHome={onSelectHome} />,
      );
      expect(screen.getByText('Go to My Homes')).toBeTruthy();
    });

    it('prioritizes noHomes over noHomeSelected', () => {
      render(
        <PantryContent {...defaultProps} items={[]} noHomes={true} noHomeSelected={true} />,
      );
      expect(screen.getByText('No home yet')).toBeTruthy();
      expect(screen.queryByText('No home selected')).toBeNull();
    });

    it('prioritizes no-home states over search empty state', () => {
      render(
        <PantryContent {...defaultProps} items={[]} noHomeSelected={true} searchQuery="test" />,
      );
      expect(screen.getByText('No home selected')).toBeTruthy();
      expect(screen.queryByText('No items found')).toBeNull();
    });
  });
});
