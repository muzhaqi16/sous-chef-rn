import { useEffect, startTransition } from 'react';
import { client } from '#/apollo/client';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { fieldWriterFor } from '#/apollo/utils/fieldWriters';
import { useUser } from '#store/useAppStore';

/**
 * Whether a persisted value patches an object-valued field rather than replacing
 * it. Some optimistic changes live one level down
 * (`ShoppingListItem.purchaseInfo.isPurchased`), so the entry names the object
 * field and carries only changed keys. Arrays are always replacements.
 */
const isPartialObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/**
 * Restores persisted optimistic data for several entity types. EVERY entry is
 * applied, with no comparison against the server's value: an entry exists only
 * while its mutation is unconfirmed, so what survives a restart is exactly the
 * local intent the offline queue is about to replay.
 */
export function useOptimisticDataRestorationMultiple(
  entityTypes: string[],
  enabled = true,
) {
  const user = useUser();

  const stableEntityTypes = entityTypes;

  useEffect(() => {
    if (!user?.id || !enabled || stableEntityTypes.length === 0) return;

    // Non-urgent: restoration must not block navigation or the first render.
    startTransition(() => {
      client.cache.batch({
        update: cache => {
          stableEntityTypes.forEach(entityType => {
            const allUpdates =
              optimisticDataPersistence.getAllForType(entityType);

            if (allUpdates.size === 0) return;

            allUpdates.forEach((fields, entityId) => {
              const cacheId = cache.identify({
                __typename: entityType,
                id: entityId,
              });

              // `cache.modify` with no id defaults to ROOT_QUERY, which would
              // write these fields onto the query root instead of the entity.
              if (!cacheId) return;

              // A field whose rules live in a dedicated writer is restored
              // THROUGH it — the blind merge below would be a second writer with
              // none of the invariants, on a path no foreground test reaches.
              const merged = Object.keys(fields).reduce((acc, field) => {
                const owner = fieldWriterFor(entityType, field);
                if (owner) {
                  owner(cache, entityId, fields[field]);
                  return acc;
                }
                const value = fields[field];
                acc[field] = isPartialObject(value)
                  ? (existing: unknown) =>
                      isPartialObject(existing)
                        ? { ...existing, ...value }
                        : value
                  : () => value;
                return acc;
              }, {} as Record<string, (existing: unknown) => unknown>);

              if (Object.keys(merged).length === 0) return;

              cache.modify({
                id: cacheId,
                fields: merged,
              });
            });
          });
        },
      });
    });
  }, [user?.id, stableEntityTypes, enabled]);
}
