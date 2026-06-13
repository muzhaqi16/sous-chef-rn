import type { ApolloCache } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';

/**
 * Permanent optimistic field write with a snapshot-based revert, for local-first
 * UPDATE mutations whose displayed value reads from the Apollo cache.
 *
 * Writes the flat fields of `input` onto the cached entity PERMANENTLY before
 * the mutation fires (an `optimisticResponse` would be torn down the moment the
 * offline queue completes the request with a null result), snapshotting the
 * prior values so a rejection can restore them. The caller fires the mutation
 * with `context: { localFirst: true }`, then calls `revert()` only when
 * `classifyCreateResult(...) === 'rejected'`; a queued (null) result keeps the
 * write and replays idempotently.
 *
 * No-op (revert is a no-op) when the entity isn't cached. `input` must map 1:1
 * onto the entity's fields (flat inputs only — nested inputs don't apply).
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
    // When the field had a prior value, restore it. When it was ABSENT before
    // the optimistic write, `snapshot[key]` is undefined and an Apollo field
    // modifier that returns undefined is a no-op (the optimistic value would
    // survive the revert) — return the DELETE sentinel so the field is actually
    // removed on rejection.
    previous[key] = Object.prototype.hasOwnProperty.call(snapshot, key)
      ? () => snapshot[key]
      : (_value, { DELETE }) => DELETE;
  }

  executeCacheUpdate(
    () => cache.modify({ id: cacheId, fields: applied }),
    `${label} (optimistic)`,
  );

  return {
    revert: () =>
      executeCacheUpdate(
        () => cache.modify({ id: cacheId, fields: previous }),
        `Revert ${label}`,
      ),
  };
}
