import { createContext, useContext } from 'react';
import type React from 'react';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import type { ShoppingListRowItem } from '../SortableShoppingList/types';

/**
 * Per-tab data for shopping list tabs. It reaches the scenes through context so
 * `renderScene` captures no item array — tab-view re-calls the scene renderer
 * whenever its identity changes. One context PER TAB, plus one for the query, so
 * a change to the shopping items does not re-render the mounted purchased tab.
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
  onScrollBeginDrag?: () => void;
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

const TAB_CONTEXTS = {
  shopping: createContext<ShoppingListTabData | null>(null),
  purchased: createContext<ShoppingListTabData | null>(null),
};
const SearchQueryContext = createContext<string | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  data: ShoppingListDataState;
}

export const ShoppingListDataProvider: React.FC<ProviderProps> = ({
  children,
  data,
}) => (
  <TAB_CONTEXTS.shopping.Provider value={data.shopping}>
    <TAB_CONTEXTS.purchased.Provider value={data.purchased}>
      <SearchQueryContext.Provider value={data.searchQuery}>
        {children}
      </SearchQueryContext.Provider>
    </TAB_CONTEXTS.purchased.Provider>
  </TAB_CONTEXTS.shopping.Provider>
);

export function useShoppingListData(
  tab: 'shopping' | 'purchased',
): ShoppingListTabData {
  const ctx = useContext(TAB_CONTEXTS[tab]);
  if (!ctx) {
    throw new Error(
      'useShoppingListData must be used within ShoppingListDataProvider',
    );
  }
  return ctx;
}

export function useShoppingListSearchQuery(): string {
  const ctx = useContext(SearchQueryContext);
  if (ctx === null) {
    throw new Error(
      'useShoppingListSearchQuery must be used within ShoppingListDataProvider',
    );
  }
  return ctx;
}
