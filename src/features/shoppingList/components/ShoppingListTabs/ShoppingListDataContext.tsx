import { createContext, useContext } from 'react';
import type React from 'react';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import type { ShoppingListRowItem } from '../SortableShoppingList/types';

/**
 * Per-tab data for shopping list tabs.
 * Provided via context so renderScene doesn't capture item arrays,
 * preventing TabView from re-calling renderScene on every data change.
 */
export interface ShoppingListTabData {
  items: ShoppingListRowItem[];
  /** Whether row cells render product images */
  showImages?: boolean;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onEndReached?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  canReorderItems: boolean;
  isTransitioning: boolean;
  // Scroll direction tracking — threaded from screen to FlashList
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd?: () => void;
  scrollEventThrottle?: number;
  // Scrollable header content — rendered above the list as ListHeaderComponent
  listHeaderComponent?: React.ReactElement | null;
}

interface ShoppingListDataState {
  shopping: ShoppingListTabData;
  purchased: ShoppingListTabData;
  searchQuery: string;
}

const ShoppingListDataContext = createContext<ShoppingListDataState | null>(
  null,
);

interface ProviderProps {
  children: React.ReactNode;
  data: ShoppingListDataState;
}

export const ShoppingListDataProvider: React.FC<ProviderProps> = ({
  children,
  data,
}) => (
  <ShoppingListDataContext.Provider value={data}>
    {children}
  </ShoppingListDataContext.Provider>
);

export function useShoppingListData(
  tab: 'shopping' | 'purchased',
): ShoppingListTabData {
  const ctx = useContext(ShoppingListDataContext);
  if (!ctx) {
    throw new Error(
      'useShoppingListData must be used within ShoppingListDataProvider',
    );
  }
  return ctx[tab];
}

export function useShoppingListSearchQuery(): string {
  const ctx = useContext(ShoppingListDataContext);
  if (!ctx) {
    throw new Error(
      'useShoppingListSearchQuery must be used within ShoppingListDataProvider',
    );
  }
  return ctx.searchQuery;
}
