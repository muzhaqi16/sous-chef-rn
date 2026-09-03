import type { TypePolicies } from '@apollo/client';
import type {
  FieldFunctionOptions,
  Reference,
  StoreObject,
} from '@apollo/client';
import { isReference } from '@apollo/client';
import {
  mergeConnectionByNodeId,
  itemsConnectionFieldPolicy,
} from '#/apollo/cacheFieldPolicies';

/**
 * The shopping list's cache shape: an item merges field-wise, its purchase info is ONE FACT that clears on a flip, and every list read redirects to the normalized entity so a local-first row is readable with no server response.
 *
 * Merged into the cache by `makeCache()`, which throws rather than let two
 * features silently overwrite each other on the same field.
 */
export const shoppingListTypePolicies: TypePolicies = {
  ShoppingListItem: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      unit: {
        merge: false, // Always replace unit with incoming data, never merge
      },
      // Purchase history is a cursor-paginated connection; merge pages by
      // node id (keyed on orderBy only, so first/after don't fragment the
      // cache entry) so `fetchMore` appends instead of replacing.
      purchasesConnection: mergeConnectionByNodeId(['orderBy']),
    },
  },
  // A nested object with no type policy is REPLACED wholesale on write, so
  // a narrow `purchaseInfo { isPurchased }` write would blank an open
  // detail screen. Plain `merge: true` is also wrong — the purchase fields
  // are ONE FACT, so a flipped `isPurchased` must not inherit the previous
  // purchase's amounts. So: an unchanged `isPurchased` merges field-wise, a
  // changed one clears what it omits as `null` (removing reads INCOMPLETE).
  ShoppingListItemPurchaseInfo: {
    merge(
      existing: StoreObject | Reference | undefined,
      incoming: StoreObject,
      options: FieldFunctionOptions,
    ) {
      if (!existing) return incoming;
      // A value object with no key fields is never stored as a reference,
      // but the parameter type admits one and `Object.keys` on a Reference
      // would build `{ __ref: null }` and write it over the object. Cheaper
      // to refuse the shape than to rely on it not occurring.
      if (isReference(existing)) return incoming;

      const wasPurchased = options.readField('isPurchased', existing);
      const isPurchased = options.readField('isPurchased', incoming);
      if (isPurchased === undefined || isPurchased === wasPurchased) {
        return options.mergeObjects(existing, incoming);
      }

      // Derived from what is actually stored rather than a hardcoded field
      // list, so a field added to the type is covered without anyone
      // remembering to add it here.
      const cleared: Record<string, null> = {};
      for (const field of Object.keys(existing)) {
        if (field !== '__typename' && !(field in incoming)) {
          cleared[field] = null;
        }
      }

      return options.mergeObjects({ ...existing, ...cleared }, incoming);
    },
  },
  PurchaseHistorySummary: { merge: true },
  ShoppingListItemSource: { merge: true },
  ShoppingListItemStoreInfo: { merge: true },
  PriceEstimate: { merge: true },
  ShoppingList: {
    merge: true, // Enable automatic field-level merging for partial data
    fields: {
      itemsConnection: itemsConnectionFieldPolicy(),
      suggestions: {
        merge(existing = [], incoming) {
          if (incoming == null) return existing;
          return incoming;
        },
      },
    },
  },
  Query: {
    fields: {
      shoppingList: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'ShoppingList',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
      shoppingListItem: {
        read(
          existing: unknown,
          { args, toReference, canRead }: FieldFunctionOptions,
        ) {
          if (existing !== undefined) return existing;
          const ref = toReference({
            __typename: 'ShoppingListItem',
            id: args?.id as string,
          });
          return canRead(ref) ? ref : existing;
        },
      },
      // List-level queries (return collections of lists/homes)
      shoppingLists: {
        // Different homes have different shopping lists - cache separately per filter
        keyArgs: ['filters'],
        merge(existing = [], incoming) {
          // Preserve existing cache only on network errors (null/undefined)
          // Allow empty arrays through - user may genuinely have no lists
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
      shoppingListSuggestions: {
        // Note: 'limit' excluded from keyArgs to avoid unnecessary cache fragmentation
        keyArgs: ['shoppingListId'],
        merge(existing = [], incoming) {
          if (incoming == null) {
            return existing;
          }
          return incoming;
        },
      },
    },
  },
};
