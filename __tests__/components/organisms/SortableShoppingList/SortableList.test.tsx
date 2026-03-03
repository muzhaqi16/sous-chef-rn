'use no memo';

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { SortableShoppingList } from '../../../../src/components/organisms/SortableShoppingList/SortableList';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: () => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  }),
}));
jest.mock('../../../../src/components/organisms/SortableShoppingList/SortableItem', () => ({
  SwipeableListItem: () => null,
}));
jest.mock('../../../../src/constants/layout', () => ({
  getTabBarBottomPadding: jest.fn(() => 80),
}));

describe('SortableShoppingList', () => {
  const defaultProps = {
    items: [],
    onItemPress: jest.fn(),
    onItemEdit: jest.fn(),
    onItemDelete: jest.fn(),
    onTogglePurchase: jest.fn(),
  };

  it('renders without crashing with empty items', () => {
    const { toJSON } = render(
      <SortableShoppingList {...defaultProps} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders ListFooterComponent when items are empty', () => {
    const { getByText } = render(
      <SortableShoppingList
        {...defaultProps}
        ListFooterComponent={<Text>No items</Text>}
      />,
    );
    expect(getByText('No items')).toBeTruthy();
  });

  it('renders list when items are provided', () => {
    const items = [
      {
        id: '1',
        name: 'Milk',
        isPurchased: false,
        quantity: 1,
        sortOrder: 'a0',
      },
    ];
    const { toJSON } = render(
      <SortableShoppingList {...defaultProps} items={items as any} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
