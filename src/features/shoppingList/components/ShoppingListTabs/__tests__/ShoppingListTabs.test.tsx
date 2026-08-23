'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShoppingListTabs } from '../ShoppingListTabs';

type ShoppingListTabsProps = React.ComponentProps<typeof ShoppingListTabs>;

type MockRoute = { key: string; title: string };
type MockNavigationState = { index: number; routes: MockRoute[] };
type RowItem = ShoppingListTabsProps['items'] extends (infer T)[] | undefined
  ? T
  : never;
type MockItem = {
  id: string;
  title: string;
  subtitle: string;
  isPurchased: boolean;
  sortKey: string;
};

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('../FilterTabBar', () => ({
  FilterTabBar: ({
    navigationState,
    counts,
  }: {
    navigationState: MockNavigationState;
    counts: Record<string, number>;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="filter-tab-bar">
        {navigationState.routes.map((route: MockRoute) => (
          <Text key={route.key}>
            {route.title} ({counts[route.key] ?? 0})
          </Text>
        ))}
      </View>
    );
  },
}));

jest.mock('../ShoppingTab', () => ({
  ShoppingTab: () => {
    const { View, Text } = require('react-native');
    const { useShoppingListData } = require('../ShoppingListDataContext');
    const { items } = useShoppingListData('shopping');
    return (
      <View testID="shopping-tab">
        {(items ?? []).map((item: MockItem) => (
          <Text key={item.id}>{item.title}</Text>
        ))}
      </View>
    );
  },
}));

jest.mock('../PurchasedTab', () => ({
  PurchasedTab: () => {
    const { View, Text } = require('react-native');
    const { useShoppingListData } = require('../ShoppingListDataContext');
    const { items } = useShoppingListData('purchased');
    return (
      <View testID="purchased-tab">
        {(items ?? []).map((item: MockItem) => (
          <Text key={item.id}>{item.title}</Text>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/atoms/EmptyState', () => ({
  EmptyState: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="empty-state">
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
      </View>
    );
  },
}));

jest.mock('#components/atoms/Skeleton/SkeletonList', () => ({
  SkeletonList: () => {
    const { View } = require('react-native');
    return <View testID="skeleton-list" />;
  },
}));

jest.mock('#components/atoms/Skeleton/ShoppingListItemSkeleton', () => ({
  ShoppingListItemSkeleton: () => null,
}));

jest.mock('react-native-tab-view', () => {
  const { View } = require('react-native');
  return {
    TabView: ({
      renderScene,
      renderTabBar,
      navigationState,
    }: {
      renderScene: (props: { route: MockRoute }) => React.ReactNode;
      renderTabBar: (props: {
        navigationState: MockNavigationState;
      }) => React.ReactNode;
      navigationState: MockNavigationState;
    }) => {
      const tabBar = renderTabBar({ navigationState });
      const activeRoute = navigationState.routes[navigationState.index];
      const scene = renderScene({ route: activeRoute });
      return (
        <View testID="tab-view">
          {tabBar}
          {scene}
        </View>
      );
    },
  };
});

const makeItem = (id: string, title: string, isPurchased: boolean) => ({
  id,
  title,
  subtitle: 'some subtitle',
  isPurchased,
  sortKey: id,
  sortOrder: id,
  itemRef: {} as RowItem['itemRef'],
});

const defaultProps: ShoppingListTabsProps = {
  items: [
    makeItem('1', 'Milk', false),
    makeItem('2', 'Eggs', false),
    makeItem('3', 'Bread', true),
  ],
  onItemPress: jest.fn(),
};

describe('ShoppingListTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders tab bar with Shopping and Purchased tabs', () => {
    render(<ShoppingListTabs {...defaultProps} />);
    expect(screen.getByTestId('filter-tab-bar')).toBeTruthy();
    expect(screen.getByText(/Shopping/)).toBeTruthy();
    expect(screen.getByText(/Purchased/)).toBeTruthy();
  });

  it('renders unpurchased items in the shopping tab', () => {
    render(<ShoppingListTabs {...defaultProps} />);
    expect(screen.getByTestId('shopping-tab')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('displays correct unpurchased count', () => {
    render(<ShoppingListTabs {...defaultProps} />);
    expect(screen.getByText('Shopping (2)')).toBeTruthy();
  });

  it('displays correct purchased count', () => {
    render(<ShoppingListTabs {...defaultProps} />);
    expect(screen.getByText('Purchased (1)')).toBeTruthy();
  });

  it('uses totalCount props when provided for badge counts', () => {
    render(
      <ShoppingListTabs
        {...defaultProps}
        totalCountUnpurchased={50}
        totalCountPurchased={10}
      />,
    );
    expect(screen.getByText('Shopping (50)')).toBeTruthy();
    expect(screen.getByText('Purchased (10)')).toBeTruthy();
  });

  it('shows tab view with tabs when loading with empty items', () => {
    render(<ShoppingListTabs {...defaultProps} items={[]} loading={true} />);
    // Tabs remain visible during loading (skeletons are inside the tab)
    expect(screen.getByTestId('filter-tab-bar')).toBeTruthy();
    expect(screen.getByTestId('tab-view')).toBeTruthy();
  });

  it('shows empty state with tabs when no items and emptyState provided', () => {
    render(
      <ShoppingListTabs
        {...defaultProps}
        items={[]}
        emptyState={{
          title: 'Your list is empty',
          description: 'Add items to get started',
        }}
      />,
    );
    // Empty state shows with tabs visible
    expect(screen.getByTestId('filter-tab-bar')).toBeTruthy();
    expect(screen.getByText('Your list is empty')).toBeTruthy();
    expect(screen.getByText('Add items to get started')).toBeTruthy();
  });

  it('uses pre-filtered items when provided', () => {
    const unpurchased = [makeItem('1', 'Pre-filtered Milk', false)];
    const purchased = [makeItem('3', 'Pre-filtered Bread', true)];
    render(
      <ShoppingListTabs
        {...defaultProps}
        unpurchasedItems={unpurchased}
        purchasedItems={purchased}
      />,
    );
    expect(screen.getByText('Pre-filtered Milk')).toBeTruthy();
  });
});
