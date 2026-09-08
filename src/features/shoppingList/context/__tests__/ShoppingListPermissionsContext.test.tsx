'use no memo';

import React from 'react';
import { render, renderHook } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import {
  ShoppingListPermissionsProvider,
  useShoppingListItemPermissions,
} from '../ShoppingListPermissionsContext';
import type { ShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';

const VIEWER: ShoppingListPermissions = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
  resolved: true,
};

describe('the shopping list permission answer', () => {
  it('refuses to answer at all outside the provider', () => {
    // Five layers sit between the resolver and a row, one of them a generic
    // template whose extra props are `Record<string, unknown>`. None of them
    // takes the answer as a prop, so none can say what an absent one means.
    expect(() => renderHook(() => useShoppingListItemPermissions())).toThrow(
      'useShoppingListItemPermissions must be used within ShoppingListPermissionsProvider',
    );
  });

  it('hands every reader the same answer the resolver gave', () => {
    const seen: ShoppingListPermissions[] = [];
    const Reader = () => {
      seen.push(useShoppingListItemPermissions());
      return <Text>read</Text>;
    };

    render(
      <ShoppingListPermissionsProvider permissions={VIEWER}>
        <Reader />
        <Reader />
      </ShoppingListPermissionsProvider>,
    );

    expect(seen).toEqual([VIEWER, VIEWER]);
  });

  it('carries the unresolved state through rather than flattening it', () => {
    // `resolved: false` is not `canAddItems: false` — a caller that cannot tell
    // them apart tells the list's owner they have no permission.
    const unresolved: ShoppingListPermissions = { ...VIEWER, resolved: false };
    let seen: ShoppingListPermissions | null = null;
    const Reader = () => {
      seen = useShoppingListItemPermissions();
      return null;
    };

    render(
      <ShoppingListPermissionsProvider permissions={unresolved}>
        <Reader />
      </ShoppingListPermissionsProvider>,
    );

    expect(seen).toEqual(unresolved);
  });
});
