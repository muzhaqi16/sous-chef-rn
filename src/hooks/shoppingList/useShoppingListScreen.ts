import { useMemo, useEffect, startTransition, useRef } from 'react';
import { useAppNavigation } from '#hooks';
import { useGetShoppingListsQuery } from '#generated';
import { useShoppingListManagement } from './useShoppingListManagement';
import { useAppStore, selectShoppingListState } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useAuth } from '#/hooks/auth/useAuth';
import { isShoppingListOwner } from '#utils/ownershipHelpers';
import { getItemImageUrl } from '#utils/imageUtils';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList';
import type { CounterElementConfig, ImageElementConfig } from '#components/organisms/SortableShoppingList/types';

/**
 * Shopping List Screen Controller Hook - Facade pattern
 * Orchestrates query coordination, list selection, and derived state
 *
 * Follows the same pattern as usePantryManagement.ts:
 * - Composes specialized hooks
 * - Returns clean props for the screen component
 * - Maintains stable references to prevent re-renders
 */
export function useShoppingListScreen() {
  const { isFocused } = useAppNavigation();
  const { user } = useAuth();

  // PERFORMANCE: Use grouped selector with useShallow to prevent infinite loops (Zustand v5)
  const { selectedShoppingListId, setSelectedShoppingListId } = useAppStore(
    useShallow(selectShoppingListState),
  );

  // Query for shopping lists
  // PERFORMANCE: Skip query when tab is not focused to prevent wasted network requests
  const { data, previousData } = useGetShoppingListsQuery({
    skip: !isFocused,
    fetchPolicy: isFocused ? 'cache-and-network' : 'cache-only',
    errorPolicy: 'all',
  });

  // OPTIMIZATION: Fall back to previousData if current data is unavailable (network error)
  const lists = useMemo(
    () => data?.shoppingLists ?? previousData?.shoppingLists ?? [],
    [data?.shoppingLists, previousData?.shoppingLists],
  );

  // Derive current list info - needed before extracting items
  const defaultList = lists.find(list => list.isDefault) || lists[0];
  const currentListId = selectedShoppingListId || defaultList?.id;
  const currentList =
    lists.find(list => list.id === currentListId) || defaultList;

  // PERFORMANCE: Extract items from GetShoppingLists.itemsConnection
  // This eliminates the need for a separate GetShoppingListItems query
  // Reduces re-renders from 4 to 2 by having single cache update
  const itemsFromList = useMemo(() => {
    if (!currentList?.itemsConnection?.edges) return null;
    // Map edges to nodes (ShoppingListItem[])
    return currentList.itemsConnection.edges
      .map((edge: any) => edge?.node)
      .filter(Boolean);
  }, [currentList?.itemsConnection?.edges]);

  // Use the shopping list management hook
  // PERFORMANCE: Pass itemsFromList to skip separate GetShoppingListItems query
  // When itemsFromList is provided, the hook uses it instead of making another network request
  // NOTE: The hook reads selectedShoppingListId directly from store (single source of truth)
  const shoppingListManagement = useShoppingListManagement(
    isFocused ? itemsFromList : null,
  );

  const { items, loading } = shoppingListManagement;

  // Auto-select the default list if none is selected or if selected list no longer exists
  // PERFORMANCE: Check list existence without depending on entire lists array
  const selectedListExists = useMemo(
    () =>
      selectedShoppingListId
        ? lists.some(list => list.id === selectedShoppingListId)
        : false,
    [selectedShoppingListId, lists],
  );

  useEffect(() => {
    // Only auto-select if no list selected OR selected list doesn't exist
    if (!selectedShoppingListId || !selectedListExists) {
      if (defaultList?.id) {
        startTransition(() => {
          setSelectedShoppingListId(defaultList.id);
        });
      }
    }
  }, [
    selectedShoppingListId,
    selectedListExists,
    defaultList?.id,
    setSelectedShoppingListId,
  ]);

  // PERFORMANCE: Memoize list data with ownership info separately
  const listDataWithOwnership = useMemo(
    () =>
      lists.map(list => ({
        ...list,
        _isOwner: isShoppingListOwner(list, user?.id),
      })),
    [lists, user?.id],
  );

  // PERFORMANCE: Cache config objects to maintain stable references
  // This prevents SortableItem re-renders when item data hasn't changed
  const rightConfigCacheRef = useRef<Map<string, CounterElementConfig>>(
    new Map(),
  );
  const leftConfigCacheRef = useRef<
    Map<string, ImageElementConfig | undefined>
  >(new Map());

  // Transform shopping list items for SortableShoppingList
  // PERFORMANCE: Use caching for config objects - only recreate when data changes
  // Apollo's normalized cache provides stable item references, but we need
  // stable config object references for React.memo to work effectively
  const sortableItems = useMemo((): SortableShoppingListItem[] => {
    const rightCache = rightConfigCacheRef.current;
    const leftCache = leftConfigCacheRef.current;
    const currentIds = new Set<string>();

    const result = items.map(item => {
      currentIds.add(item.id);
      const imageUrl = getItemImageUrl(item.item);

      // Get primary category from item.item.categories
      const primaryCategory = item.item?.categories?.find(
        (cat: any) => cat.isPrimary,
      );
      const categoryName =
        primaryCategory?.category?.name ||
        item.item?.categories?.[0]?.category?.name ||
        item.category;

      // PERFORMANCE: Reuse rightElementConfig if data hasn't changed
      const cachedRight = rightCache.get(item.id);
      const newQuantity = item.quantity || 0;
      const newUnit = item.unit?.symbol || item.unitName || undefined;
      const newDisabled = item.isPurchased;

      let rightElementConfig: CounterElementConfig;
      if (
        cachedRight &&
        cachedRight.quantity === newQuantity &&
        cachedRight.unit === newUnit &&
        cachedRight.disabled === newDisabled
      ) {
        // Reuse existing config - stable reference
        rightElementConfig = cachedRight;
      } else {
        // Create new config and cache it
        rightElementConfig = {
          type: 'counter' as const,
          quantity: newQuantity,
          unit: newUnit,
          itemId: item.id,
          disabled: newDisabled,
        };
        rightCache.set(item.id, rightElementConfig);
      }

      // PERFORMANCE: Reuse leftElementConfig if data hasn't changed
      const cachedLeft = leftCache.get(item.id);
      let leftElementConfig: ImageElementConfig | undefined;

      if (imageUrl) {
        if (
          cachedLeft &&
          cachedLeft.url === imageUrl &&
          cachedLeft.isPurchased === item.isPurchased
        ) {
          // Reuse existing config - stable reference
          leftElementConfig = cachedLeft;
        } else {
          // Create new config and cache it
          leftElementConfig = {
            type: 'image' as const,
            url: imageUrl,
            isPurchased: item.isPurchased,
          };
          leftCache.set(item.id, leftElementConfig);
        }
      } else {
        // No image - clear cache if exists
        if (cachedLeft) {
          leftCache.delete(item.id);
        }
        leftElementConfig = undefined;
      }

      return {
        id: item.id,
        title: item.itemName || '',
        subtitle: categoryName || undefined,
        sortOrder: item.sortOrder ?? 'zzz', // String fallback for fractional indexing
        isPurchased: item.isPurchased,
        badge: undefined,
        rightElementConfig,
        leftElementConfig,
      };
    });

    // PERFORMANCE: Clean up stale cache entries (removed items)
    for (const cachedId of rightCache.keys()) {
      if (!currentIds.has(cachedId)) {
        rightCache.delete(cachedId);
        leftCache.delete(cachedId);
      }
    }

    return result;
  }, [items]);

  // Determine loading state - only show loading if we have no data at all
  const isLoadingInitial = loading && sortableItems.length === 0;

  return {
    // Management hook passthrough (spread first, then override)
    ...shoppingListManagement,

    // List data
    lists,
    listDataWithOwnership,
    currentList,
    currentListId,
    defaultList,

    // Selection
    selectedShoppingListId,
    setSelectedShoppingListId,

    // Transformed items data (overrides shoppingListManagement.items)
    items, // Re-export filtered items from management hook
    sortableItems, // Transformed for UI
    isLoadingInitial, // Derived loading state

    // Focus state
    isFocused,
  };
}
