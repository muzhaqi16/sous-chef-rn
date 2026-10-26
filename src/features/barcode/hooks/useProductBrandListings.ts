import { useQuery } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { ProductBrandListingsDocument } from './useProductBrandListings.generated';

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
 * only, read from each list so a switch flipped offline holds at once.
 */
export function useProductBrandListings(itemId: string) {
  const { data, refetch } = useQuery(ProductBrandListingsDocument, {
    variables: { itemId },
  });

  const listings: BrandListing[] = (data?.item?.listMatches ?? [])
    .filter(match => match.brandList.enabled)
    .map(match => ({
      key: `${match.brandList.id}:${match.entry.id}`,
      listName: match.brandList.name,
      viaParent: match.viaParent ? match.entry.brand.name : null,
      reason: match.entry.reason,
    }));

  return {
    listings,
    /** Re-reads the matches after the user adds this brand to a list. */
    refresh: () => {
      refetch().catch(error =>
        errorService.reportError(error, {
          operation: 'ProductBrandListings.refetch',
        }),
      );
    },
  };
}
