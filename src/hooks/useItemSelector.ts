import { useState, useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetShoppingListsLiteDocument } from '../graphql/operations/shoppingList/shoppingList.generated';
import { GetHomesDocument } from '../graphql/operations/home/home.generated';
import { GetPantriesDocument } from '../graphql/operations/pantry/pantry.generated';
import { usePreservedArrayData } from './apollo/usePreservedQueryData';
import { useSelectedHomeId } from '#store/useAppStore';
import { extractNodes } from '#/utils/connectionUtils';

interface UseItemSelectorConfig {
  type: 'shoppingList' | 'pantry' | 'home' | 'custom';
  customData?: any[];
  customLoading?: boolean;
  onSelect?: (id: string, item: any) => void;
  initialSelected?: string;
}

export const useItemSelector = ({
  type,
  customData,
  customLoading = false,
  onSelect,
  initialSelected,
}: UseItemSelectorConfig) => {
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initialSelected,
  );

  // Sync with the initialSelected when it changes
  useEffect(() => {
    setSelectedId(initialSelected);
  }, [initialSelected]);

  // Get selectedHomeId from Zustand store directly (without triggering GraphQL queries)
  // This prevents cascade: useDefaultHome uses cache-and-network which always fires network requests
  const selectedHomeId = useSelectedHomeId();

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - errorPolicy: 'ignore' returns cached data when network fails (offline graceful degradation)

  // Query data based on type
  const { data: shoppingListData, loading: shoppingListLoading } = useQuery(
    GetShoppingListsLiteDocument,
    {
      errorPolicy: 'ignore', // Return cached data on network errors
      skip: type !== 'shoppingList',
    },
  );

  const { data: pantryData, loading: pantryLoading } = useQuery(
    GetPantriesDocument,
    {
      variables: { homeId: selectedHomeId || '' },
      skip: type !== 'pantry' || !selectedHomeId,
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    },
  );

  const { data: homeData, loading: homeLoading } = useQuery(GetHomesDocument, {
    errorPolicy: 'ignore', // Return cached data on network errors
    skip: type !== 'home',
  });

  // Preserve data even when queries fail
  // Extract nodes from connection types (all return Connection types)
  const shoppingLists = usePreservedArrayData(
    extractNodes(shoppingListData?.shoppingLists),
  );
  const pantries = usePreservedArrayData(extractNodes(pantryData?.pantries));
  const homes = usePreservedArrayData(extractNodes(homeData?.homes));

  // Get the appropriate data and loading state
  const getData = () => {
    switch (type) {
      case 'shoppingList':
        return shoppingLists;
      case 'pantry':
        // Sort pantries by creation date, newest first
        return [...pantries].sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
      case 'home':
        return homes;
      case 'custom':
        return customData ?? [];
      default:
        return [];
    }
  };

  const getLoading = () => {
    switch (type) {
      case 'shoppingList':
        return shoppingListLoading;
      case 'pantry':
        return pantryLoading;
      case 'home':
        return homeLoading;
      case 'custom':
        return customLoading;
      default:
        return false;
    }
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'shoppingList':
        return 'No shopping lists available';
      case 'pantry':
        return 'No pantries available';
      case 'home':
        return 'No homes available';
      case 'custom':
        return 'No items available';
      default:
        return 'No items available';
    }
  };

  const handleSelect = (id: string, item: any) => {
    if (__DEV__) {
      console.log(
        `[useItemSelector:${type}] User selected: ${id}`,
        item?.name || item?.title || item,
      );
    }
    setSelectedId(id);
    onSelect?.(id, item);
  };

  const reset = () => {
    setSelectedId(undefined);
  };

  return {
    data: getData(),
    loading: getLoading(),
    selectedId,
    emptyMessage: getEmptyMessage(),
    handleSelect,
    reset,
    setSelectedId,
  };
};

// Convenience hooks for specific types
export const useShoppingListSelector = (
  config?: Omit<UseItemSelectorConfig, 'type'>,
) => useItemSelector({ ...config, type: 'shoppingList' });

export const usePantrySelector = (
  config?: Omit<UseItemSelectorConfig, 'type'>,
) => useItemSelector({ ...config, type: 'pantry' });

export const useHomeSelector = (config?: Omit<UseItemSelectorConfig, 'type'>) =>
  useItemSelector({ ...config, type: 'home' });
