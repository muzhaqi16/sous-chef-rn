'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShoppingListMain } from '../ShoppingListMain';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/shoppingList/useShoppingListScreen', () => ({
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

jest.mock('#/context/ShoppingListModalsContext', () => ({
  ShoppingListModalsProvider: ({ children }: any) => children,
}));

jest.mock('#hooks/performance/useTabScreenLifecycle', () => ({
  useTabScreenLifecycle: jest.fn(),
}));

jest.mock('../ShoppingListMainContent', () => ({
  ShoppingListMainContent: () => {
    const { View, Text } = require('react-native');
    return (
      <View testID="shopping-list-main-content">
        <Text>Shopping List Content</Text>
      </View>
    );
  },
}));

jest.mock('#/components/providers/ScreenErrorBoundary', () => ({
  ShoppingListErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('#components/performance/DeferredScreen', () => ({
  DeferredScreen: ({ component: Component }: { component: React.FC; fallback: any }) => <Component />,
}));
jest.mock('#components/molecules/TabScreenHeader', () => ({ TabScreenHeader: () => null }));
jest.mock('#components/molecules/SearchBar', () => ({ SearchBar: () => null }));
jest.mock('#components/organisms/ShoppingListTabs/FilterTabBar', () => ({ FilterTabBar: () => null }));
jest.mock('#components/base/Skeleton/ShoppingListSkeleton', () => ({ ShoppingListSkeleton: () => null }));

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
