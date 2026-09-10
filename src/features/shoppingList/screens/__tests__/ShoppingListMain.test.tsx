'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShoppingListMain } from '../ShoppingListMain';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#features/shoppingList/hooks/useShoppingListScreen', () => ({
  useShoppingListScreen: () => ({
    state: {
      currentListId: 'sl1',
      items: [],
      rawUnpurchasedItems: [],
      rawPurchasedItems: [],
      searchQuery: '',
      lists: [],
      selectedListId: 'sl1',
      loading: false,
      error: null,
    },
    actions: {
      setSearchQuery: jest.fn(),
    },
  }),
}));

jest.mock('#features/shoppingList/context/ShoppingListModalsContext', () => ({
  ShoppingListModalsProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(),
}));

jest.mock('#features/shoppingList/components/ShoppingListMainContent', () => ({
  ShoppingListMainContent: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="shopping-list-main-content">
        <Text>Shopping List Content</Text>
      </View>
    );
  },
}));

jest.mock('#components/providers/ScreenErrorBoundary', () => ({
  ShoppingListErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: ({
    component: Component,
  }: {
    component: React.FC;
    fallback: React.ReactNode;
  }) => <Component />,
}));
jest.mock('#components/molecules/TabScreenHeader', () => ({
  TabScreenHeader: () => null,
}));
jest.mock('#components/molecules/SearchBar', () => ({ SearchBar: () => null }));
jest.mock(
  '#features/shoppingList/components/ShoppingListTabs/FilterTabBar',
  () => ({
    FilterTabBar: () => null,
  }),
);
jest.mock(
  '#features/shoppingList/components/skeletons/ShoppingListSkeleton',
  () => ({
    ShoppingListSkeleton: () => null,
  }),
);

describe('ShoppingListMain', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders without crashing', () => {
    render(<ShoppingListMain />);
    expect(screen.getByTestId('shopping-list-main-content')).toBeTruthy();
  });

  it('renders the shopping list content', () => {
    render(<ShoppingListMain />);
    expect(screen.getByText('Shopping List Content')).toBeTruthy();
  });

  it('does not show skeleton when using DeferredScreen with component', () => {
    render(<ShoppingListMain />);
    // DeferredScreen is mocked to render component directly
    expect(screen.getByTestId('shopping-list-main-content')).toBeTruthy();
  });
});
