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

import { gql, type ApolloCache, type StoreObject } from '@apollo/client';
import { classifyCreateResult } from './classifyCreateResult';
import { errorService } from '#/services/errorService';

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

/** An object the cache should normalize rather than store inline. */
function isEntityLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    '__typename' in value
  );
}

/**
 * The selection a value needs, as GraphQL source. Empty for a leaf.
 *
 * A `__typename` is what separates a nested ENTITY from a JSON-scalar field that
 * merely happens to be an object, and selecting through it is what makes the
 * cache normalize the value instead of storing a private copy of it.
 */
function selectionFor(value: unknown): string {
  if (Array.isArray(value)) {
    const entities = value.filter(isEntityLike);
    if (entities.length === 0 || entities.length !== value.length) return '';
    // The intersection: selecting a key some element lacks makes the write warn
    // and store a hole.
    const shared = entities
      .map(entry => Object.keys(entry))
      .reduce((acc, keys) => acc.filter(key => keys.includes(key)));
    return selectionFor(
      Object.fromEntries(shared.map(k => [k, entities[0][k]])),
    );
  }
  if (!isEntityLike(value)) return '';

  const inner = Object.keys(value)
    .filter(key => key !== '__typename')
    .map(key => `${key}${selectionFor(value[key])}`);
  return ` { __typename ${inner.join(' ')} }`;
}

/**
 * Write flat fields onto a cached entity. `undefined` values are skipped so a
 * partial update never blanks a field, and an unidentifiable entity is a no-op
 * rather than a write against ROOT_QUERY.
 *
 * Goes through `writeFragment`, not `cache.modify`, for two reasons:
 *
 * - **`cache.modify` cannot INTRODUCE a field.** It runs a modifier only for a
 *   field the store object already holds, so writing one the cached entity has
 *   never carried is silently dropped — no error, no warning. Which fields an
 *   entity carries is decided by whichever query loaded it, so this bites
 *   exactly where it is hardest to see: `GetMealTemplateForEdit` selects no
 *   `recipe`, so picking a recipe for a row that query loaded cleared the custom
 *   name (a field it DOES carry) and dropped the recipe, leaving the row with
 *   neither. Verified 2026-08-29 vs `@apollo/client@4.1`:
 *   `docs/verified-library-behaviour.md#cache-modify-cannot-add-a-field`.
 * - **`cache.modify` stores what it is handed.** A nested `{ __typename, id,
 *   name }` becomes a private copy, so renaming that entity later moves the
 *   original and leaves every copy stale. `writeFragment` normalizes it to a
 *   reference and merges the nested entity's own fields into its own record.
 */
export function writeEntityFields<TFields extends object>(
  cache: ApolloCache,
  entity: FieldsEntityRef | undefined,
  updates: Partial<TFields>,
): void {
  if (!entity) return;
  const cacheId = cache.identify(entity);
  if (!cacheId) return;

  const written = Object.entries(updates).filter(
    ([, value]) => value !== undefined,
  );
  if (written.length === 0) return;

  const selections = written
    .map(([field, value]) => `${field}${selectionFor(value)}`)
    .join('\n    ');

  cache.writeFragment({
    id: cacheId,
    fragment: gql`
      fragment LocalFirstFields on ${entity.__typename} {
        __typename
        ${selections}
      }
    `,
    data: { __typename: entity.__typename, ...Object.fromEntries(written) },
  });
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
  /** Operation label for error reporting. */
  logLabel: string;
}

export interface LocalFirstFieldsResult {
  /** True when the change landed on the server OR was queued for replay. */
  persisted: boolean;
  /** Raw mutation result; `undefined` when the call threw. Callers classify/report. */
  result: MutationResultLike | undefined;
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

  let result;
  try {
    result = await mutate();
  } catch (error) {
    errorService.reportError(error, { operation: logLabel });
  }

  // `classifyCreateResult` treats a null payload with no error as 'queued', so a
  // queued change keeps its cache write; only 'rejected' reverts.
  const persisted = classifyCreateResult(result) !== 'rejected';
  if (!persisted) {
    writeEntityFields(cache, entity, previous);
  }

  return { persisted, result };
}
