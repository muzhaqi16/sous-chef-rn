import {useState, useCallback, useEffect} from 'react';
import {
  useGetShoppingListsQuery,
  useGetPantriesQuery,
  useGetHomesQuery,
} from '../graphql/generated';

interface UseItemSelectorConfig {
  type: 'shoppingList' | 'pantry' | 'home' | 'custom';
  customData?: any[];
  customLoading?: boolean;
  onSelect?: (id: string, item: any) => void;
  initialSelected?: string;
}

import {useDefaultHome} from './home/useDefaultHome';

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
  const {selectedHomeId} = useDefaultHome();
  // Query data based on type
  const {data: shoppingListData, loading: shoppingListLoading} =
    useGetShoppingListsQuery({
      fetchPolicy: 'cache-and-network',
      skip: type !== 'shoppingList',
    });

  const {data: pantryData, loading: pantryLoading} = useGetPantriesQuery({
    variables: {homeId: selectedHomeId || ''},
    fetchPolicy: 'cache-and-network',
    skip: type !== 'pantry' || !selectedHomeId,
  });

  const {data: homeData, loading: homeLoading} = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    skip: type !== 'home',
  });

  // Get the appropriate data and loading state
  const getData = () => {
    switch (type) {
      case 'shoppingList':
        return shoppingListData?.shoppingLists ?? [];
      case 'pantry':
        // Sort pantries by creation date, newest first
        const pantries = pantryData?.pantries ?? [];
        return [...pantries].sort((a, b) => {
          const dateA = new Date(a.createdAt);
          const dateB = new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
      case 'home':
        return homeData?.homes ?? [];
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

  const handleSelect = useCallback(
    (id: string, item: any) => {
      setSelectedId(id);
      onSelect?.(id, item);
    },
    [onSelect],
  );

  const reset = useCallback(() => {
    setSelectedId(undefined);
  }, []);

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
) => useItemSelector({...config, type: 'shoppingList'});

export const usePantrySelector = (
  config?: Omit<UseItemSelectorConfig, 'type'>,
) => useItemSelector({...config, type: 'pantry'});

export const useHomeSelector = (config?: Omit<UseItemSelectorConfig, 'type'>) =>
  useItemSelector({...config, type: 'home'});
