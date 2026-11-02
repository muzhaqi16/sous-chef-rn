import { useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useSelectedPantryId } from '#store/useAppStore';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState } from '#hooks/data/useDataState';

/**
 * useLazyHomeData - Lazy-loads home data only when explicitly requested.
 *
 * Used in ShoppingListMain for "Move to Pantry" feature.
 * Prevents unnecessary home queries during shopping list refresh.
 */
export function useLazyHomeData() {
  const selectedPantryId = useSelectedPantryId();

  const [requested, setRequested] = useState(false);
  const {
    data: homesData,
    loading,
    error,
    refetch,
  } = useQuery(
    GetHomesDocument,
    requested ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  useApolloErrorLogger(GetHomesDocument, error);

  // A failed read answers `undefined`: keep the last answer (preserve the
  // connection BEFORE extracting — see usePreservedConnection).
  const homes = usePreservedNodes(homesData?.homes, 'GetHomes');
  const state = useDataState({
    loading,
    error,
    hasResult: homes.length > 0 || !!homesData,
    isEmpty: homes.length === 0,
    skipped: !requested,
  });

  const fetchHomeData = () => {
    // A failed read stays failed until it is asked again.
    if (error) void refetch();
    setRequested(true);
  };

  return {
    homes,
    selectedPantryId,
    isLoaded: !!homesData,
    state,
    fetchHomeData,
  };
}
