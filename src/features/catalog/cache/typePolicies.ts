import type { TypePolicies } from '@apollo/client';
import type { StoreValue } from '@apollo/client/utilities';
import { readByIdFromCache } from '#/apollo/cacheFieldPolicies';

/**
 * A catalog item's media and nutrition survive a response that OMITS them, while an explicit null still clears — that is how an image is removed.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const catalogTypePolicies: TypePolicies = {
  Item: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      imageUrl: {
        // Preserve existing imageUrl only if the field was not included in the response
        // (incoming === undefined). Allow explicit null through so users can remove images.
        merge(existing: StoreValue, incoming: StoreValue) {
          if (incoming === undefined) {
            return existing;
          }
          return incoming;
        },
      },
      images: {
        merge(existing: StoreValue, incoming: StoreValue) {
          if (incoming === undefined) {
            return existing;
          }
          return incoming;
        },
      },
      // A ranked list with no row ids: each answer replaces the last, since
      // merging two would mix two rankings.
      storePricesConnection: { merge: false },
    },
  },
  // No id: a query asking for the usual in a second unit joins the summary
  // the scan's lookup stored instead of replacing it.
  HouseholdPriceSummary: { merge: true },
  HouseholdUsualPrice: { merge: true },
  Query: {
    fields: {
      // Item lookups by filters (barcode/UPC, etc.) - cache separately per filter
      items: {
        keyArgs: ['filters'],
      },
      // A scan's lookup stores the item whole, so a by-id read off it asks nothing.
      item: readByIdFromCache('Item'),
    },
  },
};
