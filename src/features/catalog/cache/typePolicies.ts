import type { TypePolicies } from '@apollo/client';

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
        merge(existing, incoming) {
          if (incoming === undefined) {
            return existing;
          }
          return incoming;
        },
      },
      nutritions: {
        merge(existing, incoming) {
          if (incoming === undefined) {
            return existing;
          }
          return incoming;
        },
      },
      images: {
        merge(existing, incoming) {
          if (incoming === undefined) {
            return existing;
          }
          return incoming;
        },
      },
    },
  },
  Query: {
    fields: {
      // Item lookups by filters (barcode/UPC, etc.) - cache separately per filter
      items: {
        keyArgs: ['filters'],
      },
    },
  },
};
