import type { ApolloCache } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { errorService } from '#/services/errorService';

/**
 * Permanent optimistic field write with a snapshot revert: an `optimisticResponse`
 * would be torn down the moment the offline queue completes with a null result.
 * The caller fires with `context: { localFirst: true }` and reverts ONLY on
 * `'rejected'`. Flat `input` fields only; a no-op when the entity is uncached.
 */
export function optimisticFieldUpdate(
  cache: ApolloCache,
  cacheId: string | undefined,
  entity: object | null | undefined,
  input: object,
  label: string,
): { revert: () => void } {
  if (!cacheId || !entity) return { revert: () => {} };

  const snapshot = Object.fromEntries(Object.entries(entity));
  const applied: Record<string, () => unknown> = {};
  const previous: Record<
    string,
    (value: unknown, details: ModifierDetails) => unknown
  > = {};
  for (const [key, value] of Object.entries(input)) {
    applied[key] = () => value;
    // Restore the prior value, or DELETE for a field that was absent before the
    // write — a modifier returning undefined is a no-op, leaving it un-reverted.
    previous[key] = Object.prototype.hasOwnProperty.call(snapshot, key)
      ? () => snapshot[key]
      : (_value, { DELETE }) => DELETE;
  }

  try {
    cache.modify({ id: cacheId, fields: applied });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `${label} (optimistic)`,
    });
  }

  return {
    revert: () => {
      try {
        cache.modify({ id: cacheId, fields: previous });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: `Revert ${label}`,
        });
      }
    },
  };
}
