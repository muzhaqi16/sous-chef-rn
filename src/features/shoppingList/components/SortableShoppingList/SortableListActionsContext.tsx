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

export interface SortableListActions {
  onItemPress?: (id: string) => void;
  /** `{ withDetails: true }` (long-press) opens the purchase-amount sheet to
   * record actual qty/price instead of toggling with defaults. */
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
  /** Run by a row before a `removesRow` action fires. */
  onBeforeRowRemoved?: () => void;
  /** Drag-to-reorder. The neighbour ids are null at the ends of the list. */
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
}

export interface SortableListPermissions {
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  disabled?: boolean;
}

/**
 * Permissions only — the actions half is `createActionsContext`. These stay
 * separate because they are a VALUE consumers read while rendering, value-
 * compared so an identical rebuilt object does not re-render every row.
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

/** Throws outside the provider: a missing one would silently drop row actions. */
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
