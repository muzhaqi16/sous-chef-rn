/**
 * A field with a write-time invariant routes through the ONE writer that runs
 * it, so the offline restoration pass need not know which fields it must not
 * blind-merge. Each feature owns its entries; this composes them.
 */

import type { ApolloCache } from '@apollo/client';
import type {
  PersistedEntityType,
  PersistedField,
} from '#/apollo/offline/OptimisticDataPersistence';
import { SHOPPING_LIST_FIELD_WRITERS } from '#features/shoppingList/offline/fieldWriters';

/** Applies a persisted patch for one field of one entity. */
export type FieldWriter = (
  cache: ApolloCache,
  entityId: string,
  value: unknown,
) => void;

/** Writers by generated typename, then field — both checked against codegen. */
export type FieldWriterTable = {
  readonly [T in PersistedEntityType]?: {
    readonly [F in PersistedField<T>]?: FieldWriter;
  };
};

const WRITERS: FieldWriterTable = {
  ...SHOPPING_LIST_FIELD_WRITERS,
};

/**
 * The writer that owns `field` on `typename`, or undefined when a plain merge
 * is correct — which is the case for the great majority of fields.
 */
export function fieldWriterFor(
  typename: PersistedEntityType,
  field: string,
): FieldWriter | undefined {
  const writers: Readonly<Record<string, FieldWriter | undefined>> =
    WRITERS[typename] ?? {};
  return writers[field];
}
