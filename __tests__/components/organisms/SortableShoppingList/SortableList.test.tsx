'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { SortableShoppingList } from '../../../../src/features/shoppingList/components/SortableShoppingList/SortableList';
import { ShoppingListPermissionsProvider } from '#features/shoppingList/context/ShoppingListPermissionsContext';
import { shoppingListRowItem } from '#/test-utils/fixtures/shoppingListRowItem';

jest.mock('../../../../src/hooks/performance/useCommitTracking', () => ({
  useCommitTracking: jest.fn(),
}));
jest.mock('../../../../src/hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: () => ({
    handleSwipeableWillOpen: jest.fn(),
    handleSwipeableClose: jest.fn(),
  }),
}));
jest.mock(
  '../../../../src/features/shoppingList/components/SortableShoppingList/SortableItem',
  () => ({
    SwipeableListItem: () => null,
  }),
);
jest.mock('../../../../src/constants/layout', () => ({
  getTabBarBottomPadding: jest.fn(() => 80),
  getScrollClearancePadding: jest.fn(() => 148),
}));

describe('SortableShoppingList', () => {
  const defaultProps = {
    items: [],
    reorderable: true,
    onItemPress: jest.fn(),
    onItemEdit: jest.fn(),
    onItemDelete: jest.fn(),
    onTogglePurchase: jest.fn(),
  };

  // The list reads what the user may do from context and throws without it —
  // there is no prop to default, which is the point.
  const withPermissions = (ui: React.ReactElement) => (
    <ShoppingListPermissionsProvider
      permissions={{
        canAddItems: true,
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
        resolved: true,
      }}
    >
      {ui}
    </ShoppingListPermissionsProvider>
  );

  it('renders without crashing with empty items', () => {
    const { toJSON } = render(
      withPermissions(<SortableShoppingList {...defaultProps} />),
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders ListFooterComponent when items are empty', () => {
    const { getByText } = render(
      withPermissions(
        <SortableShoppingList
          {...defaultProps}
          ListFooterComponent={<Text>No items</Text>}
        />,
      ),
    );
    expect(getByText('No items')).toBeTruthy();
  });

  it('renders list when items are provided', () => {
    const items = [shoppingListRowItem('1')];
    const { toJSON } = render(
      withPermissions(<SortableShoppingList {...defaultProps} items={items} />),
    );
    expect(toJSON()).toBeTruthy();
  });
});
