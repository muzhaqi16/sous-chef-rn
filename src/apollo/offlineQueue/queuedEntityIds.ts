import type { OperationVariables } from '@apollo/client';
import type { WriteIntent } from '#/apollo/write/writeIntent';

/**
 * The client-minted entity ids a queued mutation targets.
 *
 * One extractor, because there used to be three and they disagreed. The queue
 * asks this question in three places for three reasons — which row to protect
 * from an authoritative refetch (`queueStore.getPendingClientIds`), which row a
 * failure withdraws (`queueManager`), and which entries depend on a blocked one
 * — and a shape known to one list but not another produced a row that was
 * protected but not withdrawable, or withdrawable but not protected.
 *
 * Duck-typed on purpose: `OperationVariables` spans every queued operation and
 * these values cross a persistence boundary, so shapes are checked at runtime
 * rather than trusted from a compile-time type.
 */

/** Ordered candidates for the ONE entity a mutation is chiefly about. */
const PRIMARY_PATHS: ((vars: QueuedVariables) => unknown)[] = [
  vars => vars.id,
  vars => vars.input?.id,
  // Single adds ride the batch AddItemsToShoppingListInput shape — the
  // client-minted row id lives on the one queued item.
  vars => vars.input?.items?.[0]?.id,
  vars => vars.input?.pantryItemId,
  vars => vars.input?.itemId,
  vars => vars.itemId,
  vars => vars.input?.recipeId,
  vars => vars.input?.mealPlanId,
  vars => vars.input?.batchId,
  vars => vars.clientId,
];

interface QueuedVariables {
  id?: unknown;
  itemId?: unknown;
  clientId?: unknown;
  input?: {
    id?: unknown;
    itemId?: unknown;
    pantryItemId?: unknown;
    recipeId?: unknown;
    mealPlanId?: unknown;
    batchId?: unknown;
    items?: { id?: unknown }[];
  };
}

const asClientId = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

/**
 * The single entity a mutation is chiefly about, by the first path that
 * resolves — the failure pipeline's evict target.
 */
export function primaryQueuedEntityId(
  variables: OperationVariables | undefined,
): string | null {
  const vars = (variables ?? {}) as QueuedVariables;
  for (const read of PRIMARY_PATHS) {
    const id = asClientId(read(vars));
    if (id) return id;
  }
  return null;
}

/**
 * EVERY client-minted id a mutation touches: the primary plus each
 * `input.items[].id` of a batch-shaped create, which mints one id per row.
 *
 * A superset is the safe direction for all three consumers — an id that should
 * not have been listed costs a row one extra moment of protection, while a
 * missing one costs the row itself.
 */
export function queuedEntityIds(
  variables: OperationVariables | undefined,
): string[] {
  const ids = new Set<string>();
  const primary = primaryQueuedEntityId(variables);
  if (primary) ids.add(primary);

  const items = (variables as QueuedVariables | undefined)?.input?.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      const id = asClientId(item?.id);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * The changes an entry undoes, oldest first.
 *
 * One reader for two shapes: `intents` is what the queue writes now, and
 * `intent` is what entries persisted before it carry — the horizon is ninety
 * days, so both are live in the same build.
 */
export function entryIntents(entry: {
  intents?: WriteIntent[];
  intent?: WriteIntent;
}): WriteIntent[] {
  if (entry.intents?.length) return entry.intents;
  return entry.intent ? [entry.intent] : [];
}

/**
 * Whether an intent actually describes a change, as opposed to existing only to
 * carry the `localFirst` context.
 *
 * A context-only intent (empty patch, no aggregates, no reindex, no lifecycle
 * of its own) is legitimate — `useConvertExpiredBatchesToWaste` files one
 * because the server resolves the effect and there is no local value to write.
 * But the withdrawal branched on "are there intents?", so one of those
 * SUPPRESSED the evict fallback and the withdrawal became a no-op under a
 * "we couldn't save this" toast.
 */
export function describesAChange(intent: WriteIntent): boolean {
  if ((intent.lifecycle ?? 'patch') !== 'patch') return true;
  if (Object.keys(intent.patch ?? {}).length > 0) return true;
  if (intent.aggregates?.length) return true;
  return Boolean(intent.reindex);
}
