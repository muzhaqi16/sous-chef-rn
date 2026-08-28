import type {
  SwipeableRef,
  SwipeAction,
} from '#/components/molecules/SwipeableItem/types';
import { createActionsContext } from '#hooks/utils/createActionsContext';

/**
 * Action callbacks for shopping list item interactions.
 * Provided via context to avoid threading through renderScene's dependency array,
 * which would cause TabView to re-call renderScene for all tabs on any callback change.
 */
export interface ShoppingListTabsActions {
  onItemPress: (id: string) => void;
  /**
   * Swipe actions for one row, as descriptors.
   *
   * This is the prop `ListTemplate` injects into a custom list component. It
   * replaced `onItemEdit` / `onItemDelete`, which this component kept reading
   * from props the template had stopped supplying — so both were `undefined`
   * and the rows' Edit and Delete did nothing.
   */
  itemSwipeActions?: (id: string) =>
    | {
        left?: SwipeAction[];
        right?: SwipeAction[];
      }
    | undefined;
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
