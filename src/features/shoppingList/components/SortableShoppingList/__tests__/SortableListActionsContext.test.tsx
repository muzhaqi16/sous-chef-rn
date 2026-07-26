'use no memo';

import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  SortableListActionsProvider,
  useSortableListActions,
  type SortableListActions,
  type SortableListPermissions,
} from '../SortableListActionsContext';

describe('SortableListActionsContext', () => {
  const defaultActions: SortableListActions = {
    onItemPress: jest.fn(),
    onItemEdit: jest.fn(),
    onItemDelete: jest.fn(),
    onTogglePurchase: jest.fn(),
    onMoveToPantry: jest.fn(),
    onQuantityPress: jest.fn(),
    onSwipeableWillOpen: jest.fn(),
    onSwipeableClose: jest.fn(),
    onSortOrderUpdate: jest.fn(),
  };

  const defaultPermissions: SortableListPermissions = {
    canRemoveItems: true,
    canEditItems: true,
    canMarkPurchased: true,
    canReorderItems: true,
    disabled: false,
  };

  const wrapper =
    (actions = defaultActions, permissions = defaultPermissions) =>
    ({ children }: { children: React.ReactNode }) =>
      (
        <SortableListActionsProvider
          actions={actions}
          permissions={permissions}
        >
          {children}
        </SortableListActionsProvider>
      );

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useSortableListActions());
    }).toThrow(
      'useSortableListActions must be used within SortableListActionsProvider',
    );
  });

  it('provides actions through context', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    expect(result.current.actions).toBeDefined();
    expect(result.current.permissions).toBeDefined();
    expect(result.current.permissionsRef).toBeDefined();
  });

  it('delegates onItemPress to the provided action', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onItemPress?.('item-1');
    });

    expect(defaultActions.onItemPress).toHaveBeenCalledWith('item-1');
  });

  it('delegates onItemDelete to the provided action', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onItemDelete?.('item-2');
    });

    expect(defaultActions.onItemDelete).toHaveBeenCalledWith('item-2');
  });

  it('delegates onTogglePurchase to the provided action', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onTogglePurchase?.('item-3');
    });

    // Delegates the id plus the optional details flag (undefined for a plain tap).
    expect(defaultActions.onTogglePurchase).toHaveBeenCalledWith(
      'item-3',
      undefined,
    );
  });

  it('forwards the withDetails flag on onTogglePurchase (long-press)', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onTogglePurchase?.('item-3', {
        withDetails: true,
      });
    });

    expect(defaultActions.onTogglePurchase).toHaveBeenCalledWith('item-3', {
      withDetails: true,
    });
  });

  it('delegates onSortOrderUpdate with all parameters', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onSortOrderUpdate?.('item-1', 'item-0', 'item-2');
    });

    expect(defaultActions.onSortOrderUpdate).toHaveBeenCalledWith(
      'item-1',
      'item-0',
      'item-2',
    );
  });

  it('exposes permissions via context and ref', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    // Permissions available directly from context (for render-time reads)
    expect(result.current.permissions.canRemoveItems).toBe(true);
    expect(result.current.permissions.canEditItems).toBe(true);
    expect(result.current.permissions.canReorderItems).toBe(true);
    expect(result.current.permissions.disabled).toBe(false);

    // Also available via ref (for event handlers)
    expect(result.current.permissionsRef.current.canRemoveItems).toBe(true);
    expect(result.current.permissionsRef.current.canEditItems).toBe(true);
    expect(result.current.permissionsRef.current.canReorderItems).toBe(true);
    expect(result.current.permissionsRef.current.disabled).toBe(false);
  });

  it('keeps permissions reference stable when values are unchanged', () => {
    const permissions: SortableListPermissions = {
      canRemoveItems: true,
      canEditItems: true,
      canMarkPurchased: true,
      canReorderItems: true,
      disabled: false,
    };

    const { result, rerender } = renderHook(() => useSortableListActions(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <SortableListActionsProvider
          actions={defaultActions}
          permissions={{ ...permissions }}
        >
          {children}
        </SortableListActionsProvider>
      ),
    });

    const firstPermissions = result.current.permissions;

    // Re-render with new object reference but same values
    rerender({});

    expect(result.current.permissions).toBe(firstPermissions);
  });

  it('handles actions with no optional callbacks set', () => {
    const minimalActions: SortableListActions = {};

    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(minimalActions),
    });

    // Should not throw when calling actions that are not provided
    expect(() => {
      act(() => {
        result.current.actions.onItemPress?.('item-1');
        result.current.actions.onItemDelete?.('item-1');
        result.current.actions.onSwipeableClose?.();
      });
    }).not.toThrow();
  });
});
