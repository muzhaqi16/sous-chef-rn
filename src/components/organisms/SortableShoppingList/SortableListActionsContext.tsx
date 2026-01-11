import React, { createContext, useContext, useRef, useMemo, type ReactNode } from 'react';

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
   * Prepare FlashList for layout animation before items are removed/added.
   * Must be called before data changes that affect list layout.
   * @see https://shopify.github.io/flash-list/docs/guides/layout-animation
   */
  prepareForLayoutAnimation?: () => void;
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
  /**
   * Callback for reordering items by index (internal use).
   * Called with the item ID and the index delta to move.
   * The parent component converts this to neighbor IDs for the API.
   */
  onReorderByDelta?: (itemId: string, indexDelta: number) => void;
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
  permissionsRef: React.MutableRefObject<SortableListPermissions>;
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
  // Store latest actions in ref - updated on every render but doesn't trigger re-renders
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // Store latest permissions in ref - consumers can read current values via ref
  const permissionsRef = useRef(permissions);
  permissionsRef.current = permissions;

  // Create stable callbacks that delegate to ref
  // Empty dependency array = these never change = no consumer re-renders
  const stableActions = useMemo<SortableListActions>(
    () => ({
      onItemPress: (id: string) => actionsRef.current.onItemPress?.(id),
      onItemEdit: (id: string) => actionsRef.current.onItemEdit?.(id),
      onItemDelete: (id: string) => actionsRef.current.onItemDelete?.(id),
      onTogglePurchase: (id: string) => actionsRef.current.onTogglePurchase?.(id),
      onMoveToPantry: (id: string) => actionsRef.current.onMoveToPantry?.(id),
      onQuantityPress: (id: string) => actionsRef.current.onQuantityPress?.(id),
      onSwipeableWillOpen: (ref: any) => actionsRef.current.onSwipeableWillOpen?.(ref),
      onSwipeableClose: () => actionsRef.current.onSwipeableClose?.(),
      prepareForLayoutAnimation: () => actionsRef.current.prepareForLayoutAnimation?.(),
      onSortOrderUpdate: (itemId: string, afterItemId: string | null, beforeItemId: string | null) =>
        actionsRef.current.onSortOrderUpdate?.(itemId, afterItemId, beforeItemId),
      onReorderByDelta: (itemId: string, indexDelta: number) =>
        actionsRef.current.onReorderByDelta?.(itemId, indexDelta),
    }),
    [],
  );

  // Memoize context value - stable reference (empty deps after stableActions)
  // permissionsRef allows consumers to read latest permissions without context changes
  const contextValue = useMemo<SortableListActionsContextValue>(
    () => ({
      actions: stableActions,
      permissions: permissionsRef.current, // Snapshot for initial render
      permissionsRef, // Ref for latest values - always current
    }),
    [stableActions], // Only stableActions - permissions accessed via ref
  );

  return (
    <SortableListActionsContext.Provider value={contextValue}>
      {children}
    </SortableListActionsContext.Provider>
  );
};
