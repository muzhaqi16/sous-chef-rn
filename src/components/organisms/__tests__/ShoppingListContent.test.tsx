import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ShoppingListContent } from '../ShoppingListContent';

jest.mock('#components/organisms/SortableShoppingList/SortableList', () => {
  const { View, Text } = require('react-native');
  return {
    SortableShoppingList: ({ items, ListFooterComponent }: any) => (
      <View testID="sortable-list">
        {items.map((item: any) => (
          <Text key={item.id}>{item.title}</Text>
        ))}
        {ListFooterComponent}
      </View>
    ),
  };
});

jest.mock('#components/molecules/CollapsiblePurchasedSection', () => {
  const { View, Text } = require('react-native');
  return {
    CollapsiblePurchasedSection: ({ purchasedItems }: any) => (
      <View testID="purchased-section">
        {purchasedItems.map((item: any) => (
          <Text key={item.id}>{`purchased-${item.title}`}</Text>
        ))}
      </View>
    ),
  };
});

jest.mock('#components/base/EmptyState', () => {
  const { Text } = require('react-native');
  return {
    EmptyState: ({ title, description }: any) => (
      <>
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
      </>
    ),
  };
});

jest.mock('#components/base/Skeleton/ShoppingListItemSkeleton', () => {
  const { View } = require('react-native');
  return {
    ShoppingListItemSkeleton: () => <View testID="skeleton" />,
  };
});

describe('ShoppingListContent', () => {
  const mockItems = [
    { id: '1', title: 'Milk', isPurchased: false, sortKey: 'a0' },
    { id: '2', title: 'Eggs', isPurchased: false, sortKey: 'a1' },
    { id: '3', title: 'Bread', isPurchased: true, sortKey: 'a2' },
  ];

  const defaultProps: any = {
    items: mockItems,
    onItemPress: jest.fn(),
  };

  it('renders unpurchased items in sortable list', () => {
    render(<ShoppingListContent {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('Eggs')).toBeTruthy();
  });

  it('renders purchased items in collapsible section', () => {
    render(<ShoppingListContent {...defaultProps} />);
    expect(screen.getByText('purchased-Bread')).toBeTruthy();
  });

  it('shows skeleton screens during loading with no items', () => {
    render(
      <ShoppingListContent
        items={[]}
        loading={true}
        onItemPress={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('skeleton')).toHaveLength(5);
  });

  it('shows empty state when no items and emptyState provided', () => {
    render(
      <ShoppingListContent
        items={[]}
        onItemPress={jest.fn()}
        emptyState={{
          icon: 'cart-outline',
          title: 'No items in list',
          description: 'Add items to get started',
        }}
      />,
    );
    expect(screen.getByText('No items in list')).toBeTruthy();
    expect(screen.getByText('Add items to get started')).toBeTruthy();
  });

  it('renders sortable list when items exist even if loading', () => {
    render(
      <ShoppingListContent
        {...defaultProps}
        loading={true}
      />,
    );
    expect(screen.getByTestId('sortable-list')).toBeTruthy();
    expect(screen.queryAllByTestId('skeleton')).toHaveLength(0);
  });
});
