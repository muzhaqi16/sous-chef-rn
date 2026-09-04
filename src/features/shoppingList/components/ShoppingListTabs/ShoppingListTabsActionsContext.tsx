import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { createActionsContext } from '#hooks/utils/createActionsContext';

/**
 * Action callbacks for shopping list item interactions.
 * Provided via context to avoid threading through renderScene's dependency array,
 * which would cause TabView to re-call renderScene for all tabs on any callback change.
 */
export interface ShoppingListTabsActions {
  onItemPress: (id: string) => void;
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
}

const context = createActionsContext<ShoppingListTabsActions>(
  'ShoppingListTabsActionsProvider',
);

export const ShoppingListTabsActionsProvider = context.Provider;
export const useShoppingListTabsActions = context.useActions;
