'use no memo';

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import type { FragmentType } from '@apollo/client/masking';
import { SortableShoppingList } from '../../../../src/features/shoppingList/components/SortableShoppingList/SortableList';
import type { ShoppingListRowItem } from '../../../../src/features/shoppingList/components/SortableShoppingList/types';
import { SortableItem_ItemFragmentDoc } from '../../../../src/features/shoppingList/components/SortableShoppingList/SortableItem.generated';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));
jest.mock('../../../../src/hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: () => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  }),
}));
jest.mock('../../../../src/features/shoppingList/components/SortableShoppingList/SortableItem', () => ({
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
    const items: ShoppingListRowItem[] = [
      {
        id: '1',
        isPurchased: false,
        sortOrder: 'a0',
        // The masked ref is structurally a normalized ref: __typename + id is
        // enough for useFragment's cache lookup.
        itemRef: { __typename: 'ShoppingListItem', id: '1' } as FragmentType<
          typeof SortableItem_ItemFragmentDoc
        >,
      },
    ];
    const { toJSON } = render(
      <SortableShoppingList {...defaultProps} items={items} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
