import type { WriteConvergence } from '#/apollo/offlineQueue/types';

/**
 * A locally-applied write, described as DATA rather than as procedure.
 *
 * The whole point is that every field here is plain JSON. The intent is stored
 * on the queue entry, which is serialized to MMKV, so it survives the app being
 * killed — and that is what lets a withdrawal RESTORE the preceding state
 * instead of evicting the entity. A revert expressed as a closure lives in RAM
 * and is gone by the time a withdrawal actually happens, which is why the queue
 * had no snapshot to revert to and reached for `evict` instead.
 *
 * There is no `apply`/`undo` pair: {@link WriteIntent.inverse} is another patch,
 * so reverting is applying, and there is one code path rather than two that can
 * disagree.
 */

/** A normalized entity, by the two fields that identify one. */
export interface EntityRef {
  __typename: string;
  id: string;
}

/**
 * Marks a field that did NOT exist before the write, so reverting removes it
 * rather than writing `undefined`.
 *
 * A string rather than Apollo's `DELETE` sentinel because this crosses a JSON
 * boundary — and writing `undefined` into the cache is not a no-op, it deletes
 * the field, which is the opposite of what an absent-field revert wants
 * everywhere else.
 */
export const ABSENT = '__writeIntent.absent__';

/**
 * Field values to write onto an entity.
 *
 * A plain-object value is SHALLOW-MERGED into the existing object field, so a
 * patch can address one key of a nested object (`purchaseInfo.isPurchased`)
 * without restating the rest of it. Anything else replaces. Arrays replace —
 * a patch carrying an array is the new list, not an addition to one.
 */
export type FieldPatch = Record<string, unknown>;

/**
 * A numeric field changed BY an amount rather than TO a value.
 *
 * Counters (`totalItems`, `completedItems`) must be relative or a withdrawal
 * clobbers whatever else moved them meanwhile: restoring a snapshot of "4"
 * discards a concurrent increment to 5. It also inverts for free — the undo of
 * `+1` is `-1`, with no prior value to remember.
 *
 * Floored at zero on apply, because a count cannot be negative and a drifted
 * cache should not be able to make one.
 */
export interface AdjustBy {
  __adjust: number;
}

export const adjustBy = (delta: number): AdjustBy => ({ __adjust: delta });

export const isAdjustBy = (value: unknown): value is AdjustBy =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AdjustBy).__adjust === 'number';

/**
 * What a write does to the entity's EXISTENCE, as opposed to its values.
 *
 * The kit began with patches only, and six of fourteen conversions declined on
 * that: a create and a delete are not statements about fields. Forcing one
 * through anyway is what made a removal ADD its row to an unfiltered
 * connection — `after: {}` was read as "matches every variant with no filters"
 * rather than as "is gone".
 *
 *  - `patch`  — the entity exists before and after; only values change.
 *  - `create` — the entity does not exist before. The undo is an evict.
 *  - `remove` — the entity exists before. The undo restores it from the
 *               snapshot taken at apply time, which is why a removal is
 *               undoable offline at all.
 */
export type Lifecycle = 'patch' | 'create' | 'remove';

/** A patch aimed at an entity other than the write's primary target. */
export interface EntityPatch {
  target: EntityRef;
  patch: FieldPatch;
}

/**
 * How to keep filtered collections of an entity correct after a patch moves it
 * between them.
 *
 * `decidableFilters` is an allowlist and the reason this fails closed: a cached
 * variant whose active filters are not all in it is LEFT ALONE rather than
 * guessed at. That is the direction the existing `skipUnmatchedFilterVariants`
 * prescribes — a briefly-missing row heals on the next read from the server,
 * while a wrongly-placed one does not.
 */
export interface ReindexSpec {
  /**
   * What holds the connection: an entity (the list, the pantry) or the query
   * ROOT, for a top-level collection like `Query.shoppingLists`.
   *
   * A root connection is not an edge case here — a create whose new row belongs
   * to a top-level list has nowhere else to be indexed, and describing it
   * without a reindex leaves the queue's withdrawal evicting the entity while a
   * dangling edge stays in the overview.
   */
  parent: ConnectionParent;
  /** The connection field on that parent, e.g. `itemsConnection`. */
  field: string;
  /** Filter keys this spec is competent to decide. Anything else → skip. */
  decidableFilters: string[];
  /**
   * Filter values the entity matches AFTER the write. Read for `patch` and
   * `create`; a `remove` leaves every variant regardless, so it needs no
   * membership statement — the distinction that was missing when a removal had
   * to be spelled `after: {}`.
   */
  after: Record<string, unknown>;
  /**
   * Filter values it matched BEFORE.
   *
   * Read for `patch` — and for a `remove`, by its UNDO, which is the whole
   * reason a removal states it. Leaving it `{}` was a real defect: the
   * withdrawal restored the row and then matched no variant, so the row came
   * back into the cache and into no list — present, correct, and invisible,
   * with nothing offline able to heal it. A removal does not need to say where
   * it was in order to LEAVE; it needs to say it in order to come BACK.
   */
  before: Record<string, unknown>;
}

/** A write before it has been applied — the inverse is not known yet. */
export interface WriteIntentDraft {
  target: EntityRef;
  /** Defaults to `patch` — the shape the kit started with. */
  lifecycle?: Lifecycle;
  /**
   * For `patch`: the fields to change.
   * For `create`: the COMPLETE entity to write, `__typename` and `id`
   * included. The kit does not build it — the feature's own optimistic builder
   * does, because completeness against every query that reads the entity is a
   * per-entity concern the kit cannot know.
   * For `remove`: ignored.
   */
  patch: FieldPatch;
  /**
   * Patches on OTHER entities the write also changes — in practice the parent's
   * derived counts. Kept beside the primary patch rather than left to each call
   * site, which is how six independent implementations of the same
   * shopping-list stat quartet came to exist, two of them incomplete.
   */
  aggregates?: EntityPatch[];
  reindex?: ReindexSpec;
  /**
   * Whether the patch carries a final value or a change to whatever is there.
   * Decides what a version conflict does: an absolute write refreshes its
   * version and re-sends, a relative one reports the overwrite. Cannot be
   * inferred — `newQuantity` and a delta are both numbers.
   */
  convergence: WriteConvergence;
}

/** A write that has been applied, carrying what undoes it. */
export interface WriteIntent extends WriteIntentDraft {
  /**
   * The patch that restores what was there, derived from what the cache
   * ACTUALLY held at apply time rather than reconstructed later from
   * assumptions about it.
   */
  inverse: FieldPatch;
  /** Inverses for {@link WriteIntentDraft.aggregates}, in the same order. */
  aggregateInverses?: FieldPatch[];
  /**
   * For `remove`: the entity as the cache held it, so the undo can put it back
   * whole. Serializable like everything else here, which is what makes a
   * removal reversible after a restart — an evict alone is not, because
   * offline there is no read that could restore the row.
   */
  snapshot?: Record<string, unknown>;
}

/** Whether `value` is a plain object, i.e. a partial patch rather than a replacement. */
export const isPatchObject = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

/** The cache id for a ref, in the form `InMemoryCache` keys entities by. */
export const refToCacheId = (ref: EntityRef): string =>
  `${ref.__typename}:${ref.id}`;

/**
 * The query root, as a connection parent.
 *
 * Spelled as a constant rather than as a `{ __typename: 'Query' }` ref because
 * `refToCacheId` would render that `Query:undefined` — the root has no id, and
 * Apollo keys it by this literal.
 */
export const ROOT_PARENT = 'ROOT_QUERY';

/** Where a connection hangs: an entity, or the query root. */
export type ConnectionParent = EntityRef | typeof ROOT_PARENT;

/** The cache id of whatever holds a connection. */
export const parentCacheId = (parent: ConnectionParent): string =>
  parent === ROOT_PARENT ? ROOT_PARENT : refToCacheId(parent);
