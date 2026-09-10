import { MutationType } from '#/graphql/generated/schemaTypes';
import type { SubscriptionPayload } from './types';

/**
 * What a live subscription must IGNORE. Three overlapping reasons: an event for
 * an item the user just deleted optimistically, one for a parent mid-delete,
 * and a sortOrder-only echo of a reorder this device just made. Each needs
 * timers and a short memory, and none of it is the registry's business.
 */
export class SubscriptionSuppression {
  private processedMutations = new Set<string>();
  private readonly MAX_PROCESSED_MUTATIONS = 100;

  /** itemId -> timestamp of a reorder this device just made. */
  private recentReorders = new Map<string, number>();
  /** Expiry timers for {@link recentReorders}, so a session end can cancel them. */
  private reorderTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // An optimistic delete can be undone by Apollo re-normalizing the subscription
  // payload for the same item; tracked here so it can be re-evicted.
  private pendingDeletes = new Map<
    string,
    {
      parentId: string;
      entityType: string;
      parentTypename: string;
      connectionField: string;
      // 30s safety-net expiry; cancelled when the entry is removed early.
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  // Subscriptions stay live while a parent (list, pantry) is being deleted, so
  // its id is parked here to skip processing until the delete settles.
  private pendingParentDeletes = new Set<string>();
  /** Expiry timers for {@link pendingParentDeletes}, cancelled by `cleanup()`. */
  private parentDeleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Counted for the service's stats, which report the whole picture. */
  filteredSortOrderUpdates = 0;

  /**
   * Guards an optimistic delete: a subscription carrying the deleted item's data
   * makes Apollo re-add it by normalization, and this is what re-evicts it.
   */
  registerPendingDelete(
    itemId: string,
    parentId: string,
    entityType: string,
    parentTypename: string = 'Pantry',
    connectionField: string = 'itemsConnection',
  ): void {
    // Or the previous entry's timer is stranded, holding a reference for 30s.
    this.clearPendingDelete(itemId);
    this.pendingDeletes.set(itemId, {
      parentId,
      entityType,
      parentTypename,
      connectionField,
      // Safety net against an entry never being unregistered.
      timer: setTimeout(() => this.clearPendingDelete(itemId), 30000),
    });
  }

  /**
   * The single removal path: deleting the map entry alone strands a live 30s
   * timer per delete, long after the mutation it guards has settled.
   */
  private clearPendingDelete(itemId: string): void {
    const pending = this.pendingDeletes.get(itemId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingDeletes.delete(itemId);
  }

  /** Called once the delete mutation completes. */
  unregisterPendingDelete(itemId: string): void {
    this.clearPendingDelete(itemId);
  }

  /** True while the item may still be re-added by Apollo's normalization. */
  isPendingDelete(itemId: string): boolean {
    return this.pendingDeletes.has(itemId);
  }

  /**
   * A handler re-reading a parent from the network must wait on this, or the
   * server's copy resurrects rows the user has already removed locally.
   */
  hasPendingDeletes(): boolean {
    return this.pendingDeletes.size > 0;
  }

  /**
   * Register that a parent entity (shopping list, pantry) is being deleted.
   * Subscriptions for this entity will be skipped during the deletion process.
   *
   * @param entityId - The ID of the entity being deleted
   */
  registerParentDeletion(entityId: string): void {
    this.pendingParentDeletes.add(entityId);
    // Tracked, so `cleanup()` can cancel it. `pendingDeletes` sixty lines above
    // already keeps its timer handle for exactly this reason; these two did not,
    // so a session end cleared the SET while leaving callbacks scheduled against
    // it — they then fired against post-teardown state, and in a test they keep
    // the fake-timer queue alive past the assertions.
    this.clearParentDeletionTimer(entityId);
    this.parentDeleteTimers.set(
      entityId,
      setTimeout(() => {
        this.parentDeleteTimers.delete(entityId);
        this.pendingParentDeletes.delete(entityId);
      }, 10000),
    );
  }

  /** Cancel a pending parent-deletion expiry, if one is scheduled. */
  private clearParentDeletionTimer(entityId: string): void {
    const timer = this.parentDeleteTimers.get(entityId);
    if (timer) {
      clearTimeout(timer);
      this.parentDeleteTimers.delete(entityId);
    }
  }

  /**
   * Unregister a parent entity deletion (called after navigation completes)
   */
  unregisterParentDeletion(entityId: string): void {
    this.clearParentDeletionTimer(entityId);
    this.pendingParentDeletes.delete(entityId);
  }

  /**
   * Check if a parent entity is currently being deleted
   */
  /** The delete's shape, for the re-evict — null when nothing is pending. */
  getPendingDelete(itemId: string) {
    return this.pendingDeletes.get(itemId) ?? null;
  }

  isParentDeleting(entityId: string): boolean {
    return this.pendingParentDeletes.has(entityId);
  }

  /**
   * Filter out items that are pending deletion.
   * Call this on arrays of items before rendering to prevent flicker
   * during the race condition between optimistic delete and subscription.
   */
  filterPendingDeletes<T extends { id: string }>(items: T[]): T[] {
    if (this.pendingDeletes.size === 0) {
      return items;
    }
    return items.filter(item => !this.pendingDeletes.has(item.id));
  }

  /** Main entry point: handlers to spread into an Apollo subscription hook. */
  /**
   * Mark an item as recently reordered to ignore subscription echoes
   * Call this after a successful drag-and-drop mutation
   */
  markItemReordered(itemId: string): void {
    this.recentReorders.set(itemId, Date.now());
    // Clean up after 200ms — tracked so `cleanup()` can cancel it.
    const existing = this.reorderTimers.get(itemId);
    if (existing) clearTimeout(existing);
    this.reorderTimers.set(
      itemId,
      setTimeout(() => {
        this.reorderTimers.delete(itemId);
        this.recentReorders.delete(itemId);
      }, 200),
    );
  }

  /**
   * Check if subscription update is ONLY for sortOrder changes
   * These should be ignored since we handle reordering optimistically
   */
  private isSortOrderOnlyUpdate<TData>(
    payload: SubscriptionPayload<TData>,
  ): boolean {
    // Only filter ITEM_UPDATED mutations
    if (payload.mutation !== MutationType.ItemUpdated) {
      return false;
    }

    // If no updatedFields, process the update (can't tell what changed)
    if (!payload.updatedFields || payload.updatedFields.length === 0) {
      return false;
    }

    // Check if ONLY sortOrder was updated
    const onlySortOrder =
      payload.updatedFields.length === 1 &&
      payload.updatedFields[0] === 'sortOrder';

    return onlySortOrder;
  }

  /**
   * Drops duplicates (same timestamp + mutation) and sortOrder-only updates,
   * which optimistic mutations already applied. Self-echo is deliberately NOT
   * filtered here — a call site that needs it uses `isSelfEcho`, so one user on
   * two devices still sees their own changes on the other.
   */
  shouldProcessUpdate<TData>(
    payload: SubscriptionPayload<TData>,
    onFiltered?: (info: { itemId: string; recentReorder: boolean }) => void,
  ): boolean {
    if (!payload) return false;

    // Filter sortOrder-only updates (handled by optimistic mutations)
    if (this.isSortOrderOnlyUpdate(payload)) {
      const itemId =
        (payload.item as { id?: string } | undefined)?.id ||
        (payload.node as { id?: string } | undefined)?.id;

      if (itemId) {
        const reorderTime = this.recentReorders.get(itemId);
        const isRecentReorder = reorderTime && Date.now() - reorderTime < 200;

        if (isRecentReorder || this.recentReorders.size > 0) {
          this.filteredSortOrderUpdates++;
          onFiltered?.({ itemId, recentReorder: !!isRecentReorder });
          return false;
        }
      }
    }

    // Dedup key = mutation + subtype + node + tick. The server can emit distinct
    // events in one tick, so subtype + node keep those apart.
    if (payload.timestamp && payload.mutation) {
      const nodeId =
        (payload.node as { id?: string } | undefined)?.id ??
        (payload.item as { id?: string } | undefined)?.id ??
        '';
      const mutationKey = `${payload.mutation}-${
        payload.subtype ?? ''
      }-${nodeId}-${payload.timestamp}`;

      if (this.processedMutations.has(mutationKey)) {
        return false;
      }

      this.processedMutations.add(mutationKey);

      if (this.processedMutations.size > this.MAX_PROCESSED_MUTATIONS) {
        const iterator = this.processedMutations.values();
        const firstKey = iterator.next().value;
        if (firstKey) {
          this.processedMutations.delete(firstKey);
        }
      }
    }

    return true;
  }

  /**
   * CREATE adds to the array via cache.modify(), UPDATE relies on Apollo's
   * normalization, DELETE removes from the array and evicts.
   */

  /** Cancel every timer. A session end must leave none armed. */
  cleanup(): void {
    for (const entry of this.pendingDeletes.values()) {
      clearTimeout(entry.timer);
    }
    this.pendingDeletes.clear();
    for (const timer of this.parentDeleteTimers.values()) {
      clearTimeout(timer);
    }
    this.parentDeleteTimers.clear();
    this.pendingParentDeletes.clear();
    for (const timer of this.reorderTimers.values()) {
      clearTimeout(timer);
    }
    this.reorderTimers.clear();
    this.recentReorders.clear();
    this.processedMutations.clear();
    this.filteredSortOrderUpdates = 0;
  }
}
