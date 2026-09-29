import { useApolloClient, useFragment, useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemForm_PantryItemFragmentDoc,
  PantryItemForm_HomeFragmentDoc,
  type PantryItemForm_HomeFragment,
} from '#features/pantry/components/form/PantryItemForm.generated';
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
  const client = useApolloClient();

  const { data: homeData } = useQuery(GetHomeDocument, {
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  const isUnconfirmed = useIsCreateUnconfirmed(itemId);
  const { loading: itemLoading, refetch: refetchItem } = useQuery(
    GetPantryItemDocument,
    {
      variables: { id: itemId ?? '' },
      // A client-minted id is cached (and edit-swipeable) before the server has
      // the row; querying in that window can only return RESOURCE_NOT_FOUND,
      // which renders as the dead-end "item not found" state.
      skip: !itemId || isUnconfirmed,
    },
  );

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

  // Masking hides `pantriesConnection` on the raw query result.
  const home = homeData?.home
    ? client.cache.readFragment<PantryItemForm_HomeFragment>({
        fragment: PantryItemForm_HomeFragmentDoc,
        fragmentName: 'PantryItemForm_home',
        from: homeData.home,
      })
    : null;
  const pantry = defaultPantryOf(home) ?? null;
  const currentPantryId =
    selectedPantryId ?? pantry?.id ?? existingPantryItem?.pantryId;

  const { data: pantryData } = useQuery(GetPantryDocument, {
    variables: { id: currentPantryId ?? '', today },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

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
