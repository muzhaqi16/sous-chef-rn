/**
 * A field with a write-time invariant routes through the ONE writer that runs it:
 * `ShoppingListItem.purchaseInfo` through `writePurchaseInfo` (clear-on-flip, no
 * spread over a reference, cached record carried forward). A registry, so the
 * offline restoration pass need not know which fields it must not blind-merge.
 */

import type { ApolloCache } from '@apollo/client';
import { writePurchaseInfo } from './shoppingListCacheUpdaters';

/** Applies a persisted patch for one field of one entity. */
export type FieldWriter = (
  cache: ApolloCache,
  entityId: string,
  value: unknown,
) => void;

const KEY = (typename: string, field: string) => `${typename}.${field}`;

const WRITERS: Record<string, FieldWriter> = {
  [KEY('ShoppingListItem', 'purchaseInfo')]: (cache, entityId, value) => {
    if (typeof value !== 'object' || value === null) return;
    const patch = value as {
      isPurchased?: unknown;
      movedToPantryAt?: unknown;
    };
    writePurchaseInfo(cache, entityId, {
      ...(typeof patch.isPurchased === 'boolean'
        ? { isPurchased: patch.isPurchased }
        : {}),
      ...(typeof patch.movedToPantryAt === 'string' ||
      patch.movedToPantryAt === null
        ? { movedToPantryAt: patch.movedToPantryAt }
        : {}),
    });
  },
};

/**
 * The writer that owns `field` on `typename`, or undefined when a plain merge
 * is correct — which is the case for the great majority of fields.
 */
export function fieldWriterFor(
  typename: string,
  field: string,
): FieldWriter | undefined {
  return WRITERS[KEY(typename, field)];
}
