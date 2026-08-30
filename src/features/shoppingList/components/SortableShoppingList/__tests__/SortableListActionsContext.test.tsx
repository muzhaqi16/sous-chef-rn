'use no memo';

import React from 'react';
import { render, renderHook, act } from '@testing-library/react-native';
import {
  SortableListActionsProvider,
  useSortableListActions,
  type SortableListActions,
  type SortableListPermissions,
} from '../SortableListActionsContext';

describe('SortableListActionsContext', () => {
  const defaultActions: SortableListActions = {
    onItemPress: jest.fn(),
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

  // `itemSwipeActions` is not a member of this bag: it is a derivation a row
  // calls while rendering, so it travels as a context VALUE. See
  // `itemSwipeActionsContext` and `createValueContext`.
  it('delegates onMoveToPantry to the provided action', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onMoveToPantry?.('item-2');
    });

    expect(defaultActions.onMoveToPantry).toHaveBeenCalledWith('item-2');
  });

  it('delegates onTogglePurchase to the provided action', () => {
    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(),
    });

    act(() => {
      result.current.actions.onTogglePurchase?.('item-3');
    });

    // A plain tap passes the id alone.
    expect(defaultActions.onTogglePurchase).toHaveBeenCalledWith('item-3');

    act(() => {
      result.current.actions.onTogglePurchase?.('item-3', {
        withDetails: true,
      });
    });

    // A long press forwards the details flag through untouched.
    expect(defaultActions.onTogglePurchase).toHaveBeenLastCalledWith('item-3', {
      withDetails: true,
    });
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

  it('leaves an unsupplied handler undefined rather than wrapping it', () => {
    const minimalActions: SortableListActions = {};

    const { result } = renderHook(() => useSortableListActions(), {
      wrapper: wrapper(minimalActions),
    });

    // A wrapper for an absent handler is a truthy function, and rows gate their
    // affordances on truthiness (`canEditItems && onItemPress`) — so wrapping
    // renders the control and drops the tap. That is a dead button, not a
    // disabled one.
    expect(result.current.actions.onItemPress).toBeUndefined();
    expect(result.current.actions.onMoveToPantry).toBeUndefined();
    expect(result.current.actions.onSwipeableClose).toBeUndefined();

    expect(() => {
      act(() => {
        result.current.actions.onItemPress?.('item-1');
      });
    }).not.toThrow();
  });

  it('publishes a handler that only arrives on a later render', () => {
    // A tree rather than `renderHook`: the bag is a PROVIDER prop, and
    // `initialProps` reach the hook callback, not the wrapper.
    let seen: ReturnType<typeof useSortableListActions>['actions'] | undefined;
    const Consumer = () => {
      seen = useSortableListActions().actions;
      return null;
    };
    const Tree = ({ actions }: { actions: SortableListActions }) => (
      <SortableListActionsProvider
        actions={actions}
        permissions={defaultPermissions}
      >
        <Consumer />
      </SortableListActionsProvider>
    );

    const onMoveToPantry = jest.fn();
    const { rerender } = render(<Tree actions={{}} />);

    expect(seen?.onMoveToPantry).toBeUndefined();

    // Permissions arrive from a query after the first render, and the actions
    // they gate are spread in behind them. Freezing the wrapper set at first
    // render loses every key that shows up this way.
    rerender(<Tree actions={{ onMoveToPantry }} />);

    act(() => {
      seen?.onMoveToPantry?.('item-9');
    });
    expect(onMoveToPantry).toHaveBeenCalledWith('item-9');
  });
});
