import React, { createContext, useContext, useRef, useEffect, useState, type ReactNode } from 'react';

/**
 * Actions available for list items.
 * All callbacks take item ID as parameter.
 */
export interface SortableListActions {
  onItemPress?: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
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

interface SortableListActionsContextValue {
  actions: SortableListActions;
  permissions: SortableListPermissions;
  permissionsRef: React.RefObject<SortableListPermissions>;
}

const SortableListActionsContext = createContext<SortableListActionsContextValue | null>(null);

/**
 * Hook to access list actions from context.
 * Must be used within SortableListActionsProvider.
 */
export const useSortableListActions = () => {
  const context = useContext(SortableListActionsContext);
  if (!context) {
    throw new Error('useSortableListActions must be used within SortableListActionsProvider');
  }
  return context;
};

interface SortableListActionsProviderProps {
  actions: SortableListActions;
  permissions: SortableListPermissions;
  children: ReactNode;
}

/**
 * Provider that makes action callbacks stable across renders.
 *
 * Uses refs internally to always call the latest callback version
 * without causing re-renders when parent callbacks change.
 * This eliminates action callbacks from renderItem dependency arrays.
 */
export const SortableListActionsProvider: React.FC<SortableListActionsProviderProps> = ({
  actions,
  permissions,
  children,
}) => {
  // Store latest actions in ref - updated via effect but doesn't trigger re-renders
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // Store latest permissions in ref - consumers can read current values via ref
  const permissionsRef = useRef(permissions);
  useEffect(() => {
    permissionsRef.current = permissions;
  });

  // Create stable callbacks that delegate to ref
  // useState initializer guarantees a single stable object across all renders
  const [stableActions] = useState<SortableListActions>(() => ({
    onItemPress: (id: string) => actionsRef.current.onItemPress?.(id),
    onItemEdit: (id: string) => actionsRef.current.onItemEdit?.(id),
    onItemDelete: (id: string) => actionsRef.current.onItemDelete?.(id),
    onTogglePurchase: (id: string) => actionsRef.current.onTogglePurchase?.(id),
    onMoveToPantry: (id: string) => actionsRef.current.onMoveToPantry?.(id),
    onQuantityPress: (id: string) => actionsRef.current.onQuantityPress?.(id),
    onSwipeableWillOpen: (ref: any) => actionsRef.current.onSwipeableWillOpen?.(ref),
    onSwipeableClose: () => actionsRef.current.onSwipeableClose?.(),
    onSortOrderUpdate: (itemId: string, afterItemId: string | null, beforeItemId: string | null) =>
      actionsRef.current.onSortOrderUpdate?.(itemId, afterItemId, beforeItemId),
  }));

  // Context value - permissionsRef allows consumers to read latest permissions without context changes
  const contextValue: SortableListActionsContextValue = {
    actions: stableActions,
    permissions, // Snapshot for current render
    permissionsRef, // Ref for latest values - always current
  };

  return (
    <SortableListActionsContext.Provider value={contextValue}>
      {children}
    </SortableListActionsContext.Provider>
  );
};
