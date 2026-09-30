import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { PantryItemForm_PantryItemFragmentDoc } from '#features/pantry/components/form/PantryItemForm.generated';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { extractNodes } from '#/utils/connectionUtils';
import { defaultPantryOf } from '#domain/homePantries';
import { useToday } from '#hooks/useToday';

interface UsePantryItemFormDataArgs {
  itemId: string | null | undefined;
  selectedHomeId: string | null | undefined;
  selectedPantryId: string | null | undefined;
}

/** Everything the pantry item form reads: the item, its home, its pantry. */
export function usePantryItemFormData({
  itemId,
  selectedHomeId,
  selectedPantryId,
}: UsePantryItemFormDataArgs) {
  const today = useToday();

  const { data: homeData } = useQuery(
    GetHomeDocument,
    selectedHomeId ? { variables: { homeId: selectedHomeId } } : skipToken,
  );

  const isUnconfirmed = useIsCreateUnconfirmed(itemId);
  // A client-minted id is cached (and edit-swipeable) before the server has
  // the row; querying in that window can only return RESOURCE_NOT_FOUND,
  // which renders as the dead-end "item not found" state.
  const fetchedItemId = itemId && !isUnconfirmed ? itemId : null;
  const { loading: itemLoading, refetch } = useQuery(
    GetPantryItemDocument,
    fetchedItemId ? { variables: { id: fetchedItemId } } : skipToken,
  );
  const refetchItem = () => (fetchedItemId ? refetch() : Promise.resolve());

  // Watched by ENTITY key, not read off the query result: a locally created
  // item is in the cache before any round trip. Never a render-time
  // `readFragment` — the compiler memoizes it on `itemId`, so a mount-time miss
  // outlived the fetch that filled the cache.
  const liveItem = useFragment({
    fragment: PantryItemForm_PantryItemFragmentDoc,
    fragmentName: 'PantryItemForm_pantryItem',
    from: itemId ? { __typename: 'PantryItem', id: itemId } : null,
  });
  const existingPantryItem = liveItem.complete ? liveItem.data : null;

  const pantry = defaultPantryOf(homeData?.home) ?? null;
  const currentPantryId =
    selectedPantryId ?? pantry?.id ?? existingPantryItem?.pantryId;

  const { data: pantryData } = useQuery(
    GetPantryDocument,
    currentPantryId
      ? {
          variables: { id: currentPantryId, today },
          fetchPolicy: 'cache-first',
        }
      : skipToken,
  );

  const storageLocations = extractNodes(
    pantryData?.pantry?.storageLocationsConnection,
  );

  return {
    existingPantryItem,
    isUnconfirmed,
    currentPantryId,
    storageLocations,
    itemLoading,
    refetchItem,
  };
}
