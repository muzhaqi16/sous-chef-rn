'use no memo';

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShoppingListItemDetail } from '../ItemDetail';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockUseGetShoppingListItemQuery = jest.fn();

jest.mock('#generated', () => ({
  useGetShoppingListItemQuery: (...args: any[]) => mockUseGetShoppingListItemQuery(...args),
}));

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
  parseImages: jest.fn(() => []),
  hasImages: jest.fn(() => false),
}));
jest.mock('#utils/nutritionUtils', () => ({
  parseNutritions: jest.fn(() => []),
  hasNutritionData: jest.fn(() => false),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: { title: {}, body: {}, caption: {} },
}));

jest.mock('#components/templates/DetailTemplate', () => ({
  DetailTemplate: ({ title, sections, headerActions: _headerActions }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="detail-template">
        <Text>{title}</Text>
        {sections.map((section: any, i: number) => (
          <View key={i}>
            {section.title ? <Text>{section.title}</Text> : null}
            {section.content}
          </View>
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/ClickableInfoPanel', () => ({
  ClickableInfoPanel: ({ title, emptyMessage }: any) => {
    const { View, Text } = require('react-native');
    return <View><Text>{title}</Text>{emptyMessage ? <Text>{emptyMessage}</Text> : null}</View>;
  },
}));
jest.mock('#components/molecules/NutritionSummary', () => ({ NutritionSummary: () => null }));
jest.mock('#components/molecules/ImageGalleryTabs', () => ({ ImageGalleryTabs: () => null }));
jest.mock('#components/atoms/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => {
    const { Text } = require('react-native');
    return <Text>2 loaves</Text>;
  },
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const mockItem = {
  id: 'si1',
  itemName: 'Bread',
  quantity: 2,
  quantityInput: '2',
  displayFormat: null,
  unitName: 'loaves',
  category: 'Bakery',
  priority: 'HIGH',
  notes: 'Get whole wheat',
  createdAt: '2024-06-01T00:00:00Z',
  updatedAt: '2024-06-02T00:00:00Z',
  item: { images: null, nutritions: null, displayUnit: null },
  purchaseInfo: { isPurchased: false },
  purchasesConnection: { edges: [], totalCount: 0 },
  addedBy: { email: 'test@test.com', profile: { displayName: 'Test User' } },
  source: null,
};

describe('ShoppingListItemDetail', () => {
  const route = { params: { listId: 'sl1', itemId: 'si1' } };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetShoppingListItemQuery.mockReturnValue({
      data: { shoppingListItem: mockItem },
      loading: false,
    });
  });

  it('renders the item name', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Bread')).toBeTruthy();
  });

  it('renders the detail template title', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Item Details')).toBeTruthy();
  });

  it('shows category', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Bakery')).toBeTruthy();
  });

  it('shows priority', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('HIGH')).toBeTruthy();
  });

  it('shows notes', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Get whole wheat')).toBeTruthy();
  });

  it('shows purchase history panel', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Purchase History')).toBeTruthy();
  });

  it('shows loading text when data is undefined', () => {
    mockUseGetShoppingListItemQuery.mockReturnValue({
      data: undefined,
      loading: true,
    });
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows added-by info', () => {
    render(<ShoppingListItemDetail route={route} />);
    expect(screen.getByText('Added By')).toBeTruthy();
    expect(screen.getByText('Test User')).toBeTruthy();
  });
});
