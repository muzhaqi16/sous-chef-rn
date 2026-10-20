import type { TypePolicies } from '@apollo/client';
import type { Reference, StoreObject } from '@apollo/client';
import { isReference } from '@apollo/client';
import type { FieldMergeFunctionOptions } from '@apollo/client/cache';
import type { StoreValue } from '@apollo/client/utilities';
import {
  mergeConnectionByNodeId,
  itemsConnectionFieldPolicy,
  readByIdFromCache,
} from '#/apollo/cacheFieldPolicies';

/**
 * The shopping list's cache shape: an item merges field-wise, its purchase info
 * is ONE FACT that clears on a flip, and list reads redirect to the normalized
 * entity so a local-first row reads with no server response.
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
  // ONE FACT: an unchanged `isPurchased` merges field-wise (replacing blanks an
  // open detail screen), a changed one sets what it omits to `null` (a removal
  // reads INCOMPLETE), and a local `writePurchaseInfo` write always merges.
  ShoppingListItemPurchaseInfo: {
    merge(
      existing: StoreObject | Reference | undefined,
      incoming: StoreObject,
      options: FieldMergeFunctionOptions,
    ) {
      if (!existing) return incoming;
      // Never a reference in practice, but the type admits one, and
      // `Object.keys` on it would write `{ __ref: null }` over the object.
      if (isReference(existing)) return incoming;
      if (options.extensions?.local === true) {
        return options.mergeObjects(existing, incoming);
      }

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
        merge(existing: StoreValue | undefined, incoming: StoreValue) {
          if (incoming == null) return existing;
          return incoming;
        },
      },
    },
  },
  Query: {
    fields: {
      shoppingList: readByIdFromCache('ShoppingList'),
      shoppingListItem: readByIdFromCache('ShoppingListItem'),
      // Not keyed on page size: a picker asking for fewer lists reads the
      // collection the overview holds, offline included. `cache.modify` by
      // field name still reaches every stored variant.
      shoppingLists: mergeConnectionByNodeId(['filters', 'homeId', 'orderBy']),
    },
  },
};
