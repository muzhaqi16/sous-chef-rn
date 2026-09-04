import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import {
  GetPantryDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemForm_PantryItemFragmentDoc,
  type PantryItemForm_PantryItemFragment,
  PantryItemForm_HomeFragmentDoc,
  type PantryItemForm_HomeFragment,
} from '#features/pantry/components/form/PantryItemForm.generated';
import type { StorageLocation } from '#/graphql/generated/schemaTypes';
import { useIsCreateUnconfirmed } from '#hooks/offline/useIsCreateUnconfirmed';
import { extractNodes } from '#/utils/connectionUtils';

interface UsePantryItemFormDataArgs {
  itemId: string | null | undefined;
  selectedHomeId: string | null | undefined;
  selectedPantryId: string | null | undefined;
}

/** Inline, to avoid a `useDefaultHome` dependency. */
const getDefaultPantry = (home: PantryItemForm_HomeFragment | null) => {
  const pantries = extractNodes(home?.pantriesConnection);
  if (!pantries.length) return null;
  return pantries.find(p => p.isDefault) ?? pantries[0] ?? null;
};

/** Everything the pantry item form reads: the item, its home, its pantry. */
export function usePantryItemFormData({
  itemId,
  selectedHomeId,
  selectedPantryId,
}: UsePantryItemFormDataArgs) {
  const client = useApolloClient();

  const { data: homeData } = useQuery(GetHomeDocument, {
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  const isUnconfirmed = useIsCreateUnconfirmed(itemId);
  const {
    data: itemQueryData,
    loading: itemLoading,
    refetch: refetchItem,
  } = useQuery(GetPantryItemDocument, {
    variables: { id: itemId ?? '' },
    // A client-minted id is cached (and edit-swipeable) before the server has
    // the row; querying in that window can only return RESOURCE_NOT_FOUND,
    // which renders as the dead-end "item not found" state.
    skip: !itemId || isUnconfirmed,
  });

  // Materialized by ENTITY key, not off the query result: a locally created
  // item is in the cache before any round trip, so chaining off the result
  // would keep the form shut until one completed.
  const existingPantryItem = itemId
    ? client.cache.readFragment<PantryItemForm_PantryItemFragment>({
        fragment: PantryItemForm_PantryItemFragmentDoc,
        fragmentName: 'PantryItemForm_pantryItem',
        from: { __typename: 'PantryItem', id: itemId },
      })
    : null;

  // Masking hides `pantriesConnection` on the raw query result.
  const home = homeData?.home
    ? client.cache.readFragment<PantryItemForm_HomeFragment>({
        fragment: PantryItemForm_HomeFragmentDoc,
        fragmentName: 'PantryItemForm_home',
        from: homeData.home,
      })
    : null;
  const pantry = getDefaultPantry(home);
  const currentPantryId =
    selectedPantryId || pantry?.id || existingPantryItem?.pantryId;

  const { data: pantryData } = useQuery(GetPantryDocument, {
    variables: { id: currentPantryId ?? '' },
    skip: !currentPantryId,
    fetchPolicy: 'cache-first',
  });

  const storageLocations = extractNodes(
    pantryData?.pantry?.storageLocationsConnection,
  ) as StorageLocation[];

  return {
    existingPantryItem,
    // A STABLE reference that changes only when the server answers — the
    // materialized item is a fresh object every render, so a form reset keyed
    // on it would fire on every render.
    itemQueryData,
    isUnconfirmed,
    currentPantryId,
    storageLocations,
    itemLoading,
    refetchItem,
  };
}
