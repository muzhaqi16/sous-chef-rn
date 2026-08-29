import { gql, type ApolloCache } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import { errorService } from '#/services/errorService';
import {
  ABSENT,
  adjustBy,
  isAdjustBy,
  isPatchObject,
  refToCacheId,
  type EntityRef,
  type FieldPatch,
  type Lifecycle,
  type WriteIntent,
  type WriteIntentDraft,
} from './writeIntent';
import { reindexConnections } from './reindexConnections';
import { gcResetResultCache, safeEvict } from '#/apollo/utils/cacheUpdaters';

/**
 * Apply a write to the cache PERMANENTLY, returning the intent with the patch
 * that undoes it.
 *
 * Permanently, not optimistically: Apollo tears an optimistic layer down the
 * moment the mutation completes, and offline that completion is the queue's own
 * null result — so the change would revert on screen while still queued.
 *
 * The inverse is computed HERE, from what the cache actually held, because this
 * is the only moment the preceding state exists. Reconstructing it at
 * withdrawal time would mean guessing, and by then the app may have restarted.
 */
export function applyIntent(
  cache: ApolloCache,
  draft: WriteIntentDraft,
): WriteIntent {
  const lifecycle = draft.lifecycle ?? 'patch';
  const cacheId = refToCacheId(draft.target);

  // Captured BEFORE anything is written, because for a removal it is the only
  // record of what the row was — and offline there is no read that could
  // recover it. This is what makes a delete undoable at all.
  const snapshot =
    lifecycle === 'remove' ? readEntity(cache, cacheId) : undefined;

  const inverse =
    lifecycle === 'patch' ? readInverse(cache, cacheId, draft.patch) : {};
  const aggregateInverses = (draft.aggregates ?? []).map(entry =>
    readInverse(cache, refToCacheId(entry.target), entry.patch),
  );

  // Ordering is load-bearing, in both directions: an entity must EXIST while
  // its connections are reindexed. Written first when it is being added, so
  // the new edge's reference resolves; evicted last when it is being removed,
  // because after an evict `readField('id', edge.node)` on the dangling ref
  // returns undefined and the edge can no longer be found to take out.
  if (lifecycle === 'create') {
    writeEntity(cache, cacheId, draft.patch);
  } else if (lifecycle === 'patch') {
    writePatch(cache, cacheId, draft.patch, 'apply');
  }

  for (const entry of draft.aggregates ?? []) {
    writePatch(cache, refToCacheId(entry.target), entry.patch, 'apply');
  }
  if (draft.reindex) {
    reindexConnections(cache, draft.target, draft.reindex, lifecycle);
  }

  if (lifecycle === 'remove') {
    removeEntity(cache, draft.target);
  }

  return { ...draft, lifecycle, inverse, aggregateInverses, snapshot };
}

/**
 * Undo a previously applied write.
 *
 * Applying the inverse rather than running a second implementation backwards —
 * one code path, so an undo cannot drift from the thing it undoes.
 */
/**
 * Intents already undone, so a second withdrawal is a no-op.
 *
 * Every other part of the kit is idempotent by construction — a patch sets a
 * value, a reindex checks membership first — but an `adjustBy` aggregate is
 * relative, so reverting twice moves the counter twice. The queue's capacity
 * path does exactly that: `queueLink` withdraws the write when the enqueue is
 * refused, and the failure handler withdraws it again from the same intent.
 *
 * Keyed on the intent OBJECT, so two genuinely separate writes that happen to
 * describe the same change are unaffected. A WeakSet, so a withdrawn intent
 * does not pin anything.
 */
const reverted = new WeakSet<WriteIntent>();

export function revertIntent(cache: ApolloCache, intent: WriteIntent): void {
  if (reverted.has(intent)) return;
  reverted.add(intent);

  const cacheId = refToCacheId(intent.target);
  const lifecycle = intent.lifecycle ?? 'patch';

  // Same ordering rule as apply, mirrored: put the entity back before
  // reindexing it in, and take it out only after reindexing it out.
  if (lifecycle === 'remove') {
    // Restoring from the captured snapshot rather than refetching is the
    // point: a withdrawal can land while still offline, when no read is
    // possible. The row's children go back FIRST, or its `__ref`s dangle and
    // the restored row reads incomplete — i.e. invisible.
    if (intent.snapshot) {
      const { [SNAPSHOT_CHILDREN]: children, ...entity } = intent.snapshot;
      // Children first in the same write, or the row's `__ref`s dangle and it
      // reads incomplete — i.e. invisible.
      const childEntities = (children ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      restoreSnapshot(cache, { ...childEntities, [cacheId]: entity });
    }
  } else if (lifecycle === 'patch') {
    writePatch(cache, cacheId, intent.inverse, 'revert');
  }

  (intent.aggregates ?? []).forEach((entry, i) => {
    const patch = intent.aggregateInverses?.[i];
    if (patch) writePatch(cache, refToCacheId(entry.target), patch, 'revert');
  });
  if (intent.reindex) {
    // Undoing a create removes it from its connections; undoing a removal puts
    // it back where it belonged; a patch swaps the two membership statements.
    const inverseLifecycle: Lifecycle =
      lifecycle === 'create'
        ? 'remove'
        : lifecycle === 'remove'
        ? 'create'
        : 'patch';
    reindexConnections(
      cache,
      intent.target,
      {
        ...intent.reindex,
        after: intent.reindex.before,
        before: intent.reindex.after,
      },
      inverseLifecycle,
    );
  }

  if (lifecycle === 'create') {
    // The undo of a create is the entity's absence, not a field value.
    removeEntity(cache, intent.target);
  }
}

/**
 * The entity as the cache holds it, PLUS every entity it directly references.
 *
 * The children matter because removing the row makes them unreachable, and the
 * gc that follows collects them — a shopping row's `Unit` and catalog `Item`
 * have no other referrer. Snapshotting only the row meant restoring it with
 * `__ref`s pointing at entities that no longer existed: the read comes back
 * incomplete, so the restored row is invisible, which is the exact outcome the
 * snapshot exists to prevent and one that cannot self-heal offline.
 *
 * One level deep is enough for the shapes here — a child's own children are
 * reachable from it, so they survive as long as it does.
 */
function readEntity(
  cache: ApolloCache,
  cacheId: string,
): Record<string, unknown> | undefined {
  const store = cache.extract() as Record<string, unknown>;
  const entity = store[cacheId];
  if (!entity) return undefined;

  const children: Record<string, unknown> = {};
  for (const ref of referencedIds(entity as Record<string, unknown>)) {
    if (store[ref]) children[ref] = { ...(store[ref] as object) };
  }

  return {
    ...(entity as object),
    ...(Object.keys(children).length > 0
      ? { [SNAPSHOT_CHILDREN]: children }
      : {}),
  } as Record<string, unknown>;
}

/** Where a removal's snapshot stashes the entities its row referenced. */
const SNAPSHOT_CHILDREN = '__writeIntent.children__';

/** Every `__ref` reachable one level down from a store object. */
function referencedIds(entity: Record<string, unknown>): string[] {
  const ids: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isPatchObject(value)) return;
    const ref = (value as { __ref?: unknown }).__ref;
    if (typeof ref === 'string') {
      ids.push(ref);
      return;
    }
    Object.values(value).forEach(visit);
  };
  Object.values(entity).forEach(visit);
  return ids;
}

/**
 * Write a whole entity, creating it if the cache has none.
 *
 * `cache.modify` cannot add an entity, and `writeFragment` needs a document
 * naming the fields — so the narrowest one covering exactly what is being
 * written is built here. The caller supplies a COMPLETE entity: completeness
 * against every query that reads it is a per-entity concern, and one missing
 * field makes the whole read incomplete and the row invisible offline.
 */
function writeEntity(
  cache: ApolloCache,
  cacheId: string,
  entity: Record<string, unknown>,
): void {
  const typename = entity.__typename as string | undefined;
  const fields = Object.keys(entity).filter(key => key !== '__typename');
  if (!typename || fields.length === 0) return;

  try {
    cache.writeFragment({
      id: cacheId,
      fragment: gql`
        fragment WriteIntentEntity on ${typename} {
          ${fields.join('\n          ')}
        }
      `,
      data: entity,
    });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `WriteIntent write entity (${cacheId})`,
    });
  }
}

/**
 * Put snapshotted rows back into the store, exactly as they were.
 *
 * NOT `writeEntity`: a snapshot comes from `cache.extract()`, so its keys are
 * STORE field names — `purchasesConnection({"first":10})`,
 * `itemsConnection:{"filters":{…}}`. Those are not GraphQL field names, so a
 * synthesized fragment carrying one is a syntax error. The throw was caught and
 * reported and the restore put NOTHING back, while every caller saw it succeed;
 * it only ever worked for a row whose every field happened to take no
 * arguments. Verified against `makeCache()`.
 *
 * `cache.restore` REPLACES the store rather than merging into it, so the
 * existing contents are read and re-supplied. One extract for the whole
 * withdrawal, not one per row — and only on a withdrawal, which is a refused
 * replay rather than anything on a normal path.
 */
function restoreSnapshot(
  cache: ApolloCache,
  entities: Record<string, Record<string, unknown>>,
): void {
  if (Object.keys(entities).length === 0) return;
  try {
    // `extract()` is typed as the generic serialized shape, which is `unknown`
    // on the base `ApolloCache`; the store is a plain id → entity map.
    const existing = cache.extract() as Record<string, unknown>;
    cache.restore({ ...existing, ...entities });
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `WriteIntent restore snapshot (${Object.keys(entities).join(
        ', ',
      )})`,
    });
  }
}

/**
 * Drop an entity and reclaim it.
 *
 * The gc is not optional bookkeeping: `cache.ts` names item deletion as one of
 * only two collection points and states there is no periodic sweep, so an
 * evict without one leaves an orphan that `extract()` writes to disk and every
 * later launch restores.
 */
function removeEntity(cache: ApolloCache, target: EntityRef): void {
  try {
    safeEvict(cache, target.__typename, target.id);
    gcResetResultCache(cache);
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `WriteIntent remove entity (${refToCacheId(target)})`,
    });
  }
}

/**
 * What the cache holds today for every field the patch touches.
 *
 * A field the entity does not have reads back as {@link ABSENT}, so reverting
 * removes it. Writing `undefined` instead would DELETE the field on the way in
 * as well, which is why the sentinel is explicit.
 */
function readInverse(
  cache: ApolloCache,
  cacheId: string,
  patch: FieldPatch,
): FieldPatch {
  const inverse: FieldPatch = {};

  cache.modify({
    id: cacheId,
    fields: Object.fromEntries(
      Object.keys(patch).map(field => [
        field,
        (existing: unknown) => {
          const patchValue = patch[field];
          if (isAdjustBy(patchValue)) {
            // Relative by construction: the undo of +1 is -1, and restoring a
            // snapshot instead would discard whatever else moved the counter.
            inverse[field] = adjustBy(-patchValue.__adjust);
          } else if (isPatchObject(patchValue) && isPatchObject(existing)) {
            // A partial patch of an object field: capture only the keys it
            // touches, so the revert restores those and leaves the rest.
            inverse[field] = Object.fromEntries(
              Object.keys(patchValue).map(key => [
                key,
                Object.prototype.hasOwnProperty.call(existing, key)
                  ? existing[key]
                  : ABSENT,
              ]),
            );
          } else {
            inverse[field] = existing === undefined ? ABSENT : existing;
          }
          // A read, not a write — hand back exactly what was there.
          return existing;
        },
      ]),
    ),
  });

  // `cache.modify` never calls a modifier for a field the entity does not have,
  // so anything the read did not reach was absent.
  for (const field of Object.keys(patch)) {
    if (!(field in inverse)) inverse[field] = ABSENT;
  }
  return inverse;
}

function writePatch(
  cache: ApolloCache,
  cacheId: string,
  patch: FieldPatch,
  label: string,
): void {
  const fields: Record<
    string,
    (existing: unknown, details: ModifierDetails) => unknown
  > = {};

  for (const [field, value] of Object.entries(patch)) {
    fields[field] = (existing, { DELETE }) => {
      if (value === ABSENT) return DELETE;
      if (isAdjustBy(value)) {
        const current = typeof existing === 'number' ? existing : 0;
        return Math.max(0, current + value.__adjust);
      }
      if (!isPatchObject(value)) return value;
      // Shallow-merge a partial object patch, resolving any ABSENT keys inside
      // it to a removal of that key rather than a literal sentinel value.
      const base = isPatchObject(existing) ? existing : {};
      const merged: Record<string, unknown> = { ...base };
      for (const [key, inner] of Object.entries(value)) {
        if (inner === ABSENT) delete merged[key];
        else merged[key] = inner;
      }
      return merged;
    };
  }

  try {
    cache.modify({ id: cacheId, fields });
    addAbsentFields(cache, cacheId, patch);
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: `WriteIntent ${label} (${cacheId})`,
    });
  }
}

/**
 * Write the patch fields the entity does not have yet.
 *
 * `cache.modify` only ever calls a modifier for a field that is already
 * present, so a patch adding one is silently a no-op through that path — the
 * write appears to succeed and nothing changes. `writeFragment` can add fields,
 * but needs a document naming them, so build the narrowest one that covers the
 * gap.
 *
 * Nothing to do in the common case: a local-first patch usually addresses
 * fields the display query already fetched.
 */
function addAbsentFields(
  cache: ApolloCache,
  cacheId: string,
  patch: FieldPatch,
): void {
  const existing = (cache.extract() as Record<string, unknown>)[cacheId] as
    | Record<string, unknown>
    | undefined;
  if (!existing) return;

  const missing = Object.entries(patch)
    .filter(([field, value]) => value !== ABSENT && !(field in existing))
    // An adjust against a field that is not there starts from zero.
    .map(([field, value]): [string, unknown] =>
      isAdjustBy(value) ? [field, Math.max(0, value.__adjust)] : [field, value],
    );
  if (missing.length === 0) return;

  const typename = existing.__typename as string | undefined;
  if (!typename) return;

  cache.writeFragment({
    id: cacheId,
    fragment: gql`
      fragment WriteIntentAddedFields on ${typename} {
        ${missing.map(([field]) => field).join('\n        ')}
      }
    `,
    data: {
      __typename: typename,
      ...Object.fromEntries(missing),
    },
  });
}
