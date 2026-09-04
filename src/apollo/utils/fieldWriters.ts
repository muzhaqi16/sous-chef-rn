/**
 * A field with a write-time invariant routes through the ONE writer that runs
 * it, so the offline restoration pass need not know which fields it must not
 * blind-merge. Each feature owns its entries; this composes them.
 */

import type { ApolloCache } from '@apollo/client';
import { SHOPPING_LIST_FIELD_WRITERS } from '#features/shoppingList/offline/fieldWriters';

/** Applies a persisted patch for one field of one entity. */
export type FieldWriter = (
  cache: ApolloCache,
  entityId: string,
  value: unknown,
) => void;

/** Keyed `<typename>.<field>`, the shape {@link fieldWriterFor} looks up. */
export type FieldWriterTable = Record<string, FieldWriter>;

const WRITERS: FieldWriterTable = {
  ...SHOPPING_LIST_FIELD_WRITERS,
};

/**
 * The writer that owns `field` on `typename`, or undefined when a plain merge
 * is correct — which is the case for the great majority of fields.
 */
export function fieldWriterFor(
  typename: string,
  field: string,
): FieldWriter | undefined {
  return WRITERS[`${typename}.${field}`];
}
