/**
 * Which writer owns a given `(typename, field)`.
 *
 * Some fields carry rules a blind write cannot honour. `ShoppingListItem
 * .purchaseInfo` is the worked example: flipping `isPurchased` must clear the
 * stocked stamp, the write must not spread over a reference, and the record's
 * other fields must survive the type policy's clear-on-flip. `writePurchaseInfo`
 * owns all three, and any other path that writes the field reintroduces exactly
 * what that choke point exists to prevent.
 *
 * The restoration pass is such a path. It re-applies a persisted field patch
 * after an offline restart with a blind `{ ...existing, ...value }`, which is a
 * second writer with none of the rules — and one no foreground test can reach,
 * because it only runs on a path that needs a killed app to occur.
 *
 * A registry rather than a special case in the restorer: the restorer should not
 * know which fields are special, and a field that gains a rule later should not
 * need the restorer edited again.
 *
 * **The better end state is persisting a COMMAND rather than a raw field patch**
 * — then the bad write is unrepresentable rather than merely routed around. It
 * is not this change because persisted entries already exist on real devices, so
 * changing the format needs a migration, which is a change of its own size.
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
