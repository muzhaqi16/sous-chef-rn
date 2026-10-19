import { useQuery } from '@apollo/client/react';
import { StoreRouteSource } from '#/graphql/generated/schemaTypes';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import type {
  ShoppingListEntry,
  ShoppingListRowItem,
} from '#features/shoppingList/components/SortableShoppingList/types';
import { groupByAisle } from '#features/shoppingList/utils/aisles';
import { AisleViewRouteDocument } from './useAisleView.generated';

/** Where a learned walking order came from, for the line above the aisles. */
export interface AisleRouteNote {
  /** Learned from this household's own trips, else from every shopper's. */
  ownTrips: boolean;
  storeName: string;
}

/**
 * The still-to-buy lines grouped by aisle in the walking order of the list's
 * store. The API learns the order nightly, so `cache-first` reads it once per
 * (list, store) and resync refreshes it; offline it is the cached answer.
 */
export function useAisleView(
  listId: string,
  storeId: string | null,
  rows: ShoppingListRowItem[],
): { aisleEntries: ShoppingListEntry[]; routeNote: AisleRouteNote | null } {
  const learnedRoutes = useFeatureFlag('storeRoutes');
  const { data, previousData } = useQuery(AisleViewRouteDocument, {
    variables: { id: listId, storeId },
    fetchPolicy: 'cache-first',
  });

  const route = data?.shoppingList?.storeRoute;
  // Another store's order keeps the aisles in place while this one's loads.
  const departments =
    (route ?? previousData?.shoppingList?.storeRoute)?.departments ?? null;

  const routeNote: AisleRouteNote | null =
    learnedRoutes && route?.store && route.source !== StoreRouteSource.Default
      ? {
          ownTrips: route.source === StoreRouteSource.Household,
          storeName: route.store.name,
        }
      : null;

  return {
    aisleEntries: groupByAisle(rows, departments),
    routeNote,
  };
}
