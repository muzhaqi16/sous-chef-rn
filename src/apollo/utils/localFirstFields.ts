/**
 * Local-first field updates for "settings-shaped" mutations: a normalized entity
 * whose field names mirror a flat settings object, updated one or several fields
 * at a time.
 *
 * The pattern these encode (see docs/local-first-architecture.md §4):
 *
 *  1. write the change into the cached entity PERMANENTLY, before firing;
 *  2. fire the mutation with `context: { localFirst: true }`;
 *  3. treat "queued" as success — it replays later, keyed by the same input;
 *  4. revert from a snapshot only when the server genuinely refuses it.
 *
 * Step 1 is what an `optimisticResponse` cannot do here. Apollo discards an
 * optimistic layer as soon as the mutation completes, and offline that
 * completion is `queueLink`'s null result — so the control flips, the queued
 * result lands, the layer rolls back, and the change visually reverts while
 * sitting in the queue waiting to replay. That is the bug the notification
 * settings screen had. App settings had no optimistic layer at all, so its
 * controls simply didn't move until the round trip returned — the same symptom
 * ("takes two taps"), reached from the other direction, and the same fix.
 */

import type { ApolloCache, StoreObject } from '@apollo/client';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { classifyCreateResult } from './classifyCreateResult';

/**
 * Identifies the normalized entity holding the fields. Its field names must
 * match the keys of `TFields` — true for `UserSettings` / `NotificationPreferences`,
 * whose GraphQL fields are the flat setting names.
 *
 * Intersected with `StoreObject` so it satisfies `cache.identify` directly.
 */
export type FieldsEntityRef = StoreObject & {
  __typename: string;
  id: string;
};

/** The shape of an awaited Apollo mutation result this module reads. */
type MutationResultLike = { data?: unknown; error?: unknown };

/**
 * Write flat fields onto a cached entity. `undefined` values are skipped so a
 * partial update never blanks a field, and an unidentifiable entity is a no-op
 * rather than a write against ROOT_QUERY.
 */
export function writeEntityFields<TFields extends object>(
  cache: ApolloCache,
  entity: FieldsEntityRef | undefined,
  updates: Partial<TFields>,
): void {
  if (!entity) return;
  const cacheId = cache.identify(entity);
  if (!cacheId) return;

  const fields: Record<string, () => unknown> = {};
  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    fields[field] = () => value;
  }
  if (Object.keys(fields).length === 0) return;

  cache.modify({ id: cacheId, fields });
}

export interface LocalFirstFieldsOptions<TFields extends object> {
  cache: ApolloCache;
  /** Omit (or pass undefined) to skip the cache write — e.g. entity not loaded yet. */
  entity: FieldsEntityRef | undefined;
  /** The change to apply. */
  updates: Partial<TFields>;
  /** Current values for the same keys — restored if the server refuses. */
  previous: Partial<TFields>;
  /** Fires the mutation. MUST pass `context: { localFirst: true }`. */
  mutate: () => Promise<MutationResultLike>;
  /** Operation label for `executeMutation`'s error reporting. */
  logLabel: string;
}

export interface LocalFirstFieldsResult {
  /** True when the change landed on the server OR was queued for replay. */
  persisted: boolean;
  /** Raw mutation result; `false` when the call threw. Callers classify/report. */
  result: MutationResultLike | false;
}

/**
 * Apply a local-first field update. Returns the outcome rather than reporting
 * it — the two call sites differ in how they surface a refusal (one alerts, one
 * logs and lets its screen alert), and duplicating that decision here is what
 * produces double alerts.
 */
export async function updateEntityFieldsLocalFirst<TFields extends object>({
  cache,
  entity,
  updates,
  previous,
  mutate,
  logLabel,
}: LocalFirstFieldsOptions<TFields>): Promise<LocalFirstFieldsResult> {
  writeEntityFields(cache, entity, updates);

  const result = await executeMutation(mutate, logLabel);

  // `classifyCreateResult` treats a null payload with no error as 'queued', so a
  // queued change keeps its cache write; only 'rejected' reverts.
  const persisted = classifyCreateResult(result) !== 'rejected';
  if (!persisted) {
    writeEntityFields(cache, entity, previous);
  }

  return { persisted, result };
}
