import { useFragment, useQuery } from '@apollo/client/react';
import type { BrandListView } from '#features/profile/hooks/useBrandLists';
import {
  ProductBrandListingsDocument,
  UseProductBrandListings_ItemFragmentDoc,
} from './useProductBrandListings.generated';

/** One of the user's lists a scanned product's brand is on. */
export interface BrandListing {
  key: string;
  listName: string;
  /** The parent company the list names, when it reached the brand through it. */
  viaParent: string | null;
  /** The user's own note on the entry. */
  reason: string | null;
}

/**
 * The user's own lists the scanned product's brand is on: lists switched on
 * only, read from each list so a switch flipped offline holds at once. A list
 * holding the scanned brand itself is that list's nearest match, so an add
 * shows from the list before the matches are read again, offline included.
 */
export function useProductBrandListings(
  itemId: string,
  scannedBrandId: string | null,
  lists: readonly BrandListView[],
) {
  // The scan's lookup stores these with the item, so this asks only for an
  // item that came another way.
  useQuery(ProductBrandListingsDocument, {
    variables: { itemId },
    fetchPolicy: 'cache-first',
  });
  const { data, complete } = useFragment({
    fragment: UseProductBrandListings_ItemFragmentDoc,
    fragmentName: 'useProductBrandListings_item',
    from: { __typename: 'Item', id: itemId },
  });

  const byList = new Map<string, BrandListing>();
  for (const match of complete ? data.listMatches : []) {
    if (!match.brandList.enabled) continue;
    byList.set(match.brandList.id, {
      key: `${match.brandList.id}:${match.entry.id}`,
      listName: match.brandList.name,
      viaParent: match.viaParent ? match.entry.brand.name : null,
      reason: match.entry.reason,
    });
  }
  for (const list of lists) {
    if (!list.enabled) continue;
    const entry = list.brands.find(brand => brand.brandId === scannedBrandId);
    if (!entry) continue;
    byList.set(list.id, {
      key: `${list.id}:${entry.entryId}`,
      listName: list.name,
      viaParent: null,
      reason: entry.reason,
    });
  }

  return { listings: [...byList.values()] };
}
