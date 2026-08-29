import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createActionsContext } from '#hooks/utils/createActionsContext';
import type { SwipeableRef } from '#/components/molecules/SwipeableItem/types';

/**
 * Actions available for list items.
 * All callbacks take item ID as parameter.
 */
export interface SortableListActions {
  onItemPress?: (id: string) => void;
  /**
   * Toggle an item's purchased state. A plain call marks it purchased with
   * default values (or un-purchases). Passing `{ withDetails: true }` (from a
   * long-press) opens the purchase-amount sheet to record actual qty/price
   * instead — only meaningful for unpurchased items.
   */
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  /** Run by a row before a `removesRow` action fires. */
  onBeforeRowRemoved?: () => void;
  /**
   * Callback for reordering items via drag-to-reorder.
   * @param itemId - ID of the item being moved
   * @param afterItemId - ID of the item that should come before the moved item (null if moving to start)
   * @param beforeItemId - ID of the item that should come after the moved item (null if moving to end)
   */
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
}

/**
 * Permission flags for conditional rendering of actions.
 */
export interface SortableListPermissions {
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  disabled?: boolean;
}

/**
 * Permissions only. The actions half is `createActionsContext`.
 *
 * This module used to hand-roll the same latest-ref stabilisation the factory
 * provides, which is how it kept both defects the factory was fixed for — a
 * truthy wrapper for an absent handler, and a key set frozen at first render —
 * while its sibling in this feature already used the factory. One contract, one
 * implementation.
 *
 * Permissions stay here because they are a different thing: a VALUE consumers
 * read while rendering, value-compared so a parent re-render that rebuilds an
 * identical object does not re-render every row.
 */
interface SortableListPermissionsValue {
  permissions: SortableListPermissions;
  permissionsRef: React.RefObject<SortableListPermissions>;
}

const PermissionsContext = createContext<SortableListPermissionsValue | null>(
  null,
);
PermissionsContext.displayName = 'SortableListPermissionsProvider';

const actionsContext = createActionsContext<SortableListActions>(
  'SortableListActionsProvider',
);

interface SortableListActionsProviderProps {
  actions: SortableListActions;
  permissions: SortableListPermissions;
  children: ReactNode;
}

export const SortableListActionsProvider: React.FC<
  SortableListActionsProviderProps
> = ({ actions, permissions, children }) => {
  // Latest permissions for event handlers, which read after commit.
  const permissionsRef = useRef(permissions);
  useEffect(() => {
    permissionsRef.current = permissions;
  });

  // Value-compared: a parent re-render (an Apollo cache write, say) builds a new
  // permissions object with identical booleans, and without this every row
  // re-renders for it.
  const [stablePermissions, setStablePermissions] = useState(permissions);
  if (
    stablePermissions.canRemoveItems !== permissions.canRemoveItems ||
    stablePermissions.canEditItems !== permissions.canEditItems ||
    stablePermissions.canMarkPurchased !== permissions.canMarkPurchased ||
    stablePermissions.canReorderItems !== permissions.canReorderItems ||
    stablePermissions.disabled !== permissions.disabled
  ) {
    setStablePermissions(permissions);
  }

  const permissionsValue: SortableListPermissionsValue = {
    permissions: stablePermissions,
    permissionsRef,
  };

  return (
    <actionsContext.Provider actions={actions}>
      <PermissionsContext.Provider value={permissionsValue}>
        {children}
      </PermissionsContext.Provider>
    </actionsContext.Provider>
  );
};

/**
 * Row actions and permissions. Throws outside the provider, so a missing one is
 * a loud failure rather than rows that silently render without actions.
 */
export const useSortableListActions = () => {
  const permissionsValue = useContext(PermissionsContext);
  if (!permissionsValue) {
    throw new Error(
      'useSortableListActions must be used within SortableListActionsProvider',
    );
  }
  return {
    actions: actionsContext.useActions(),
    ...permissionsValue,
  };
};
