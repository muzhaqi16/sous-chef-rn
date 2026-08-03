import { gql } from '@apollo/client';
import { client } from '../client';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { queueStore } from './queueStore';
import {
  QueuedMutation,
  QueueStatus,
  ProcessingResult,
  QueueConfig,
  QueueError,
  type FailedMutationInfo,
  type FailureHandler,
} from './types';
import { convertToSyncMutation } from './convertToSyncMutation';
import { proactiveTokenRefresh } from '../links/refreshToken';
import {
  classifyError,
  calculateRetryDelay,
  classifyReplayResult,
  ReplayRejectedError,
} from './queueErrorPolicy';
import { logger } from '#/utils/environment';
import { Telemetry } from '#/services/telemetry';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';

/** Module-level fragment for reading ShoppingListItem data from cache during queue processing */
const QUEUE_ITEM_DATA_FRAGMENT = gql`
  fragment QueueItemData on ShoppingListItem {
    id
    shoppingList {
      id
    }
  }
`;

/**
 * Reads a ShoppingListItem's catalog reference from cache during queue
 * processing. `SyncShoppingListItemFieldsInput.item` is a required @oneOf ref, but
 * toggle/quantity/plain-update inputs carry only the row id — the replay
 * backfills the ref from the cached row. Kept separate from
 * {@link QUEUE_ITEM_DATA_FRAGMENT} and read with `returnPartialData` so a row
 * cached without the linked `item` entity still resolves its `itemName`.
 */
const QUEUE_ITEM_REF_FRAGMENT = gql`
  fragment QueueItemRefData on ShoppingListItem {
    id
    itemName
    item {
      id
    }
  }
`;

/**
 * Reads a PantryItem's `pantryId` from cache during queue processing.
 * `UpdatePantryItemInput` carries no `pantryId`, but `SyncPantryItemInput`
 * requires it, so the update→sync replay backfills it from the cached entity
 * (mirrors {@link QUEUE_ITEM_DATA_FRAGMENT} for shopping items).
 */
const QUEUE_PANTRY_ITEM_FRAGMENT = gql`
  fragment QueuePantryItemData on PantryItem {
    id
    pantryId
  }
`;

/**
 * Default configuration for the queue manager
 */
const DEFAULT_CONFIG: QueueConfig = {
  retryDelayMs: 1000,
  processingTimeoutMs: 30000,
};

/**
 * Queue Manager - Processes offline mutations with auth-aware logic
 *
 * Features:
 * - User-scoped queue processing
 * - Token validation and refresh before replay
 * - Strict FIFO replay (insertion order is causal order)
 * - Retry logic with exponential backoff
 * - Network-aware processing
 */
export class QueueManager {
  private config: QueueConfig;
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private failureHandler: FailureHandler | null = null;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a callback invoked when a mutation permanently fails after exhausting retries.
   * Only one handler is supported — subsequent calls replace the previous handler.
   */
  setFailureHandler(handler: FailureHandler): void {
    this.failureHandler = handler;
  }

  /**
   * Process the queue for the current user
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug('⏳ Queue: Already processing, waiting...');
      return this.processingPromise || Promise.resolve();
    }

    const state = useStore.getState();

    // Check if user is authenticated
    if (!state.user || !state.accessToken) {
      logger.info('⚠️ Queue: No authenticated user, skipping processing');
      return;
    }

    // Don't replay when the server is unreachable (device offline OR the API
    // reachability breaker is open) — replays would just fail and re-trip it.
    if (isApiUnavailable(state)) {
      logger.debug('📴 Queue: Server unreachable, skipping processing');
      return;
    }

    const userId = state.user.id;
    logger.info(`🔄 Queue: Starting processing for user ${userId}`);

    this.isProcessing = true;
    this.processingPromise = this._processQueueInternal(userId);

    try {
      await this.processingPromise;
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  /**
   * Replay all pending mutations strictly in insertion order.
   *
   * The queue is append-only from a single user's actions, so insertion order
   * IS causal order: a parent create (offline-created list/pantry/plan) always
   * precedes any dependent referencing its client-minted id, and same-entity
   * ops replay in the order the user made them. No grouping, batching, or
   * dependency analysis needed — FIFO is correct by construction.
   */
  private async _processQueueInternal(userId: string): Promise<void> {
    // Validate token before processing
    const hasValidToken = await this.validateTokenBeforeReplay();
    if (!hasValidToken) {
      logger.error('❌ Queue: Token validation failed, cannot process');
      return;
    }

    // Recover entries a killed process left mid-replay: drains are serialized
    // by isProcessing, so any PROCESSING entry visible here is stranded debris,
    // not live work. Reset to PENDING so this drain picks them up.
    queueStore.resetProcessingToPending(userId);

    // Never replay past the server's 90-day idempotency-dedup horizon — the
    // dedup record is pruned by then, so a replay would double-apply instead
    // of classifying as IDEMPOTENT_REPLAY. Expired entries surface as FAILED.
    queueStore.expireStalePending(userId);

    const mutations = queueStore.getPendingMutationsForUser(userId);

    // Queue health at drain time: depth, and how long the oldest entry has
    // been waiting. A growing age across drains means changes aren't syncing.
    Telemetry.gauge('offline_queue_depth', mutations.length);
    if (mutations.length === 0) {
      logger.info('✅ Queue: No pending mutations');
      return;
    }
    Telemetry.gauge(
      'offline_queue_oldest_age_ms',
      Date.now() - Math.min(...mutations.map(m => m.createdAt)),
    );

    logger.info(`📊 Queue: Found ${mutations.length} pending mutations`);

    let succeeded = 0;
    let failed = 0;
    for (const mutation of mutations) {
      // Stop replaying the moment the server becomes unreachable — the rest
      // of the queue stays PENDING for the next drain.
      if (isApiUnavailable(useStore.getState())) {
        logger.info('📴 Queue: Server became unreachable, pausing');
        break;
      }

      try {
        const result = await this.processMutation(mutation);
        if (result.success) succeeded++;
        else failed++;

        // A transient defer left this mutation PENDING. Stop the drain so a
        // later mutation (which may depend on this one) can't replay ahead of
        // it — the whole tail stays PENDING for the next drain, preserving
        // FIFO order. Mirrors the isApiUnavailable break above.
        if (result.deferred) {
          logger.info(
            '🕓 Queue: Mutation deferred (transient), pausing drain to preserve order',
          );
          break;
        }
      } catch (error) {
        failed++;
        logger.error('Queue: Unexpected error processing mutation:', error);
      }
    }

    logger.info(
      `📦 Queue: Drain complete — ${succeeded} succeeded, ${failed} failed`,
    );

    // Cleanup old successful mutations
    queueStore.cleanupSuccessful();
  }

  /**
   * Process a single mutation
   */
  private async processMutation(
    mutation: QueuedMutation,
  ): Promise<ProcessingResult> {
    const mutationId = mutation.id;

    try {
      // Mark as processing
      queueStore.updateMutation(mutationId, {
        status: QueueStatus.PROCESSING,
      });

      logger.info(
        `⚡ Queue: Processing ${mutation.operationName} (${mutationId})`,
      );

      // Execute mutation with timeout
      const result = await this.executeWithTimeout(mutation);

      // Success - remove from queue
      queueStore.updateMutation(mutationId, {
        status: QueueStatus.SUCCESS,
        processedAt: Date.now(),
      });

      // The change is on the server now (plain success or IDEMPOTENT_REPLAY
      // convergence both reach here) — drop the persisted optimistic fields
      // for the touched entities so restoration can't re-apply stale values
      // over fresher server state on later mounts. Entries for still-PENDING
      // mutations are untouched.
      this.clearPersistedOptimisticFields(mutation);

      // Remove after short delay (allows for reconciliation)
      setTimeout(() => queueStore.removeMutation(mutationId), 5000);

      logger.info(`✅ Queue: Mutation ${mutationId} processed successfully`);

      return {
        success: true,
        mutationId,
        serverResponse: result,
      };
    } catch (error) {
      logger.error(
        `❌ Queue: Mutation ${mutationId} failed:`,
        error instanceof Error ? error.message : String(error),
      );
      return await this.handleMutationError(mutation, error);
    }
  }

  /**
   * Execute a mutation via Apollo Client.
   * Replays offline-queued items through their sync mutation (idempotent by the
   * client-generated id, which rides the replay as `clientId`).
   */
  private async executeMutation(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | undefined> {
    const { syncMutation, syncVariables } = convertToSyncMutation(mutation, {
      readPantryId: clientId => this.readPantryId(clientId),
      readShoppingListId: clientId => this.readShoppingListId(clientId),
      readItemRef: clientId => this.readItemRef(clientId),
    });

    logger.info(`🔄 Queue: Replaying ${mutation.operationName} via sync`);

    const result = await client.mutate<Record<string, unknown>>({
      mutation: syncMutation,
      variables: syncVariables,
      context: {
        ...mutation.context,
        skipQueueLink: true,
      },
    });

    if (result.error) {
      throw result.error;
    }

    // Dynamic payload extraction — the mutation field name varies per queued
    // operation, so the value shape is only known structurally here.
    const payload = Object.values(result.data || {})[0] as
      | {
          __typename?: string;
          code?: string;
          message?: string;
          conflict?: { message?: string };
        }
      | undefined;

    // Under errorPolicy 'all' a server refusal RESOLVES as an error union
    // member instead of throwing — same trap the foreground path closes with
    // classifyCreateResult. Without this, a rejected replay would be marked
    // SUCCESS and dequeued while the optimistic cache write lingers.
    const outcome = classifyReplayResult(payload);
    if (outcome === 'converged') {
      // IDEMPOTENT_REPLAY conflict: an earlier attempt already committed this
      // op (a client-PK create, or an idempotency-keyed cumulative delta) — the
      // change is on the server. Dequeue as success.
      logger.info(
        `✅ Queue: ${mutation.operationName} already committed by an earlier attempt — dropping replay`,
      );
      return result.data;
    }
    if (outcome === 'rejected') {
      throw new ReplayRejectedError(
        payload?.__typename ?? 'Error',
        payload?.message ??
          `${mutation.operationName} was rejected by the server on replay`,
        payload?.code ?? null,
      );
    }

    // Server wins on conflict — the server's version already rides back in the
    // response; just surface it for diagnostics.
    if (payload?.conflict) {
      logger.warn(
        `⚠️ Queue: Conflict detected for ${mutation.operationName}:`,
        payload.conflict.message,
      );
      Telemetry.increment('offline_queue_conflicts_total', 1, {
        operation: mutation.operationName,
      });
    }

    return result.data;
  }

  /**
   * Read a shopping-list item's `shoppingListId` from cache — the sync input
   * requires it, but update/toggle/quantity mutation variables only carry the
   * item id.
   */
  private readShoppingListId(itemId: string | undefined): string | undefined {
    if (!itemId) return undefined;
    const itemData = client.cache.readFragment<{
      id: string;
      shoppingList: { id: string };
    }>({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      }),
      fragment: QUEUE_ITEM_DATA_FRAGMENT,
    });
    return itemData?.shoppingList?.id;
  }

  /**
   * Read a shopping-list item's @oneOf catalog ref from cache — the sync input
   * requires it, but toggle/quantity/plain-update variables only carry the row
   * id. Prefers the linked catalog item id; falls back to the row's free-text
   * name (the server links-or-creates by name, matching the original add).
   */
  private readItemRef(
    itemId: string | undefined,
  ): { itemId: string } | { itemName: string } | undefined {
    if (!itemId) return undefined;
    const itemData = client.cache.readFragment<{
      id: string;
      itemName: string | null;
      item: { id: string } | null;
    }>({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      }),
      fragment: QUEUE_ITEM_REF_FRAGMENT,
      returnPartialData: true,
    });
    if (itemData?.item?.id) return { itemId: itemData.item.id };
    if (itemData?.itemName) return { itemName: itemData.itemName };
    return undefined;
  }

  /**
   * Read a pantry item's `pantryId` from cache — `SyncPantryItemInput` requires
   * it, but `UpdatePantryItem` variables only carry the item id.
   */
  private readPantryId(itemId: string | undefined): string | undefined {
    if (!itemId) return undefined;
    const itemData = client.cache.readFragment<{
      id: string;
      pantryId: string;
    }>({
      id: client.cache.identify({
        __typename: 'PantryItem',
        id: itemId,
      }),
      fragment: QUEUE_PANTRY_ITEM_FRAGMENT,
    });
    return itemData?.pantryId ?? undefined;
  }

  /**
   * Handle mutation execution error
   */
  private async handleMutationError(
    mutation: QueuedMutation,
    error: unknown,
  ): Promise<ProcessingResult> {
    const queueError = classifyError(error);

    // Auth errors: force ONE token refresh, then retry through the same
    // bounded counter as every other retryable error. (A dedicated auth path
    // that only re-validated the existing token would loop forever on a
    // persistent 401 — revoked session — because "token exists" read as
    // "refreshed".)
    if (queueError.type === 'auth') {
      const newToken = await proactiveTokenRefresh();
      if (!newToken) {
        logger.error(`❌ Queue: Token refresh failed for ${mutation.id}`);
        queueStore.markMutationFailed(mutation.id, queueError);
        this.invokeFailureHandler(mutation, queueError);
        return { success: false, mutationId: mutation.id, error: queueError };
      }
      useStore.getState().setNeedsTokenRefresh(false);
      logger.info(`🔐 Queue: Token refreshed for ${mutation.id}, retrying`);
    }

    // Retryable errors (refreshed-auth, network, 5xx): bounded in-run retries
    if (queueError.retryable && mutation.retryCount < mutation.maxRetries) {
      logger.info(
        `🔄 Queue: Scheduling retry for ${mutation.id} (attempt ${
          mutation.retryCount + 1
        }/${mutation.maxRetries})`,
      );

      // Update retry count
      queueStore.incrementRetry(mutation.id);

      // Schedule retry with exponential backoff
      const delay = calculateRetryDelay(
        mutation.retryCount,
        this.config.retryDelayMs,
      );
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry immediately only if the API is actually reachable. Gating on
      // `isApiUnavailable` (not bare `isOnline`) means an open reachability
      // breaker — device online but API down — defers instead of firing a
      // doomed retry that would just re-trip the breaker, matching every other
      // gate in this file.
      const state = useStore.getState();
      if (!isApiUnavailable(state)) {
        return await this.processMutation({
          ...mutation,
          retryCount: mutation.retryCount + 1,
        });
      }
    }

    // Transient (network / 5xx server) errors that exhausted the in-run retries:
    // keep the mutation PENDING so the change survives for the next drain /
    // recovery trigger instead of being permanently dropped. Local-first: a
    // queued change must not be lost just because the API was unreachable for a
    // while. (Reset retryCount so the next drain gets a fresh attempt.)
    if (queueError.type === 'network' || queueError.type === 'server') {
      queueStore.updateMutation(mutation.id, {
        status: QueueStatus.PENDING,
        retryCount: 0,
      });
      logger.info(
        `🕓 Queue: ${mutation.id} deferred (transient ${queueError.type}) — stays PENDING for next drain`,
      );
      return {
        success: false,
        deferred: true,
        mutationId: mutation.id,
        error: queueError,
      };
    }

    // Non-retryable (validation / client / 4xx / GraphQL) error — or an auth
    // error that exhausted its retries (markMutationFailed maps it to
    // AUTH_ERROR) → permanent failure: mark failed and notify so the
    // optimistic change can be reverted.
    queueStore.markMutationFailed(mutation.id, queueError);
    this.invokeFailureHandler(mutation, queueError);
    Telemetry.increment('offline_queue_permanent_failures_total', 1, {
      operation: mutation.operationName,
      error_type: queueError.type,
    });

    return {
      success: false,
      mutationId: mutation.id,
      error: queueError,
    };
  }

  /**
   * Validate and refresh token if needed
   */
  private async validateTokenBeforeReplay(): Promise<boolean> {
    const state = useStore.getState();

    // Check if token exists
    if (!state.accessToken) {
      logger.info('⚠️ Queue: No access token available');
      return false;
    }

    // Check if a deferred token refresh is pending
    if (state.needsTokenRefresh) {
      logger.info(
        '🔄 Queue: Deferred token refresh pending, attempting refresh before replay',
      );
      const newToken = await proactiveTokenRefresh();
      if (newToken) {
        useStore.getState().setNeedsTokenRefresh(false);
        return true;
      }
      // Refresh failed — cannot safely replay queue
      logger.error(
        '❌ Queue: Deferred token refresh failed, aborting queue processing',
      );
      return false;
    }

    // Token exists and no deferred refresh — assume valid
    // The Apollo auth link will handle expired tokens automatically via attemptTokenRefresh
    return true;
  }

  /**
   * The client entity id a queued mutation targets, across every variable shape
   * the app enqueues: create `input.id`, qty/move `input.itemId` or top-level
   * `itemId`, recipe/meal/batch inputs, or a sync `clientId`. Feeds the failure
   * handler's evict target.
   */
  private getEntityId(mutation: QueuedMutation): string | null {
    const vars = mutation.variables ?? {};
    return (
      vars.id ??
      vars.input?.id ??
      // Single adds ride the batch AddItemsToShoppingListInput shape — the
      // client-minted row id lives on the one queued item.
      vars.input?.items?.[0]?.id ??
      vars.input?.pantryItemId ??
      vars.input?.itemId ??
      vars.itemId ??
      vars.input?.recipeId ??
      vars.input?.mealPlanId ??
      vars.input?.batchId ??
      vars.clientId ??
      null
    );
  }

  /**
   * The entity a failed mutation targets, for the failure handler's cache
   * evict. The typename is read off the normalized cache rather than
   * maintained per operation: every queued mutation's hook already wrote its
   * entity to the cache under `TypeName:<clientId>` before firing, and client
   * ids are globally-unique cuids, so the cache key identifies the type. An
   * entity that isn't cached (already evicted, or an op with no single
   * entity) yields null and the handler skips the evict — the next refetch
   * heals.
   */
  private extractEntityInfo(mutation: QueuedMutation): {
    entityType: string | null;
    entityId: string | null;
  } {
    const entityId = this.getEntityId(mutation);
    if (!entityId) return { entityType: null, entityId: null };
    const snapshot = this.extractCacheSnapshot();
    return {
      entityType: this.findCachedTypename(entityId, snapshot),
      entityId,
    };
  }

  /**
   * Every client entity id a queued mutation targets: getEntityId's single
   * candidate plus all `input.items[].id` of a batch-shaped create (multi-item
   * adds carry one client-minted id per row).
   */
  private getAllEntityIds(mutation: QueuedMutation): string[] {
    const ids = new Set<string>();
    const single = this.getEntityId(mutation);
    if (single) ids.add(single);

    const items = mutation.variables?.input?.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item?.id === 'string' && item.id) ids.add(item.id);
      }
    }
    return [...ids];
  }

  /**
   * Drop persisted optimistic field values for every entity a landed mutation
   * touched. Typename comes off the normalized cache the same way the failure
   * pipeline resolves its evict target; an uncached entity has nothing to
   * restore, so skipping it is correct.
   */
  private clearPersistedOptimisticFields(mutation: QueuedMutation): void {
    const entityIds = this.getAllEntityIds(mutation);
    if (entityIds.length === 0) return;
    // One cache snapshot for every entity this mutation touched — a batch
    // create scans the single normalized map instead of re-extracting it per id.
    const snapshot = this.extractCacheSnapshot();
    for (const entityId of entityIds) {
      const entityType = this.findCachedTypename(entityId, snapshot);
      if (entityType) {
        optimisticDataPersistence.clearEntity(entityType, entityId);
      }
    }
  }

  /**
   * A single normalized-cache snapshot. `InMemoryCache.extract()` returns the
   * entity map keyed by `TypeName:id`; the generic ApolloCache type erases that
   * to `unknown`. Extract once per mutation and scan the result — the map is
   * large, so re-extracting per entity id is wasteful.
   */
  private extractCacheSnapshot(): Record<string, unknown> {
    return client.cache.extract() as Record<string, unknown>;
  }

  private findCachedTypename(
    entityId: string | null,
    snapshot: Record<string, unknown>,
  ): string | null {
    if (!entityId) return null;
    const suffix = `:${entityId}`;
    const key = Object.keys(snapshot).find(k => k.endsWith(suffix));
    return key ? key.slice(0, key.length - suffix.length) : null;
  }

  /**
   * Invoke the registered failure handler for a permanently failed mutation.
   * Extracts entity metadata and passes it to the handler.
   */
  private invokeFailureHandler(
    mutation: QueuedMutation,
    error: QueueError,
  ): void {
    if (!this.failureHandler) {
      logger.debug(
        `Queue: No failure handler registered for failed mutation ${mutation.id}`,
      );
      return;
    }

    const { entityType, entityId } = this.extractEntityInfo(mutation);

    const info: FailedMutationInfo = {
      mutationId: mutation.id,
      operationName: mutation.operationName,
      entityType,
      entityId,
      error,
    };

    try {
      this.failureHandler(info);
    } catch (handlerError) {
      logger.error('Queue: Failure handler threw an error:', handlerError);
    }
  }

  /**
   * Race the replay against the processing timeout, clearing the timer once
   * either settles — an unclamped timer per mutation would otherwise keep the
   * JS engine busy for 30s after every replay in a drain.
   */
  private async executeWithTimeout(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Operation timed out')),
        this.config.processingTimeoutMs,
      );
    });
    try {
      return await Promise.race([this.executeMutation(mutation), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Event: User went online
   */
  onOnline(): void {
    logger.info('📡 Queue: Network online, starting queue processing');
    this.processQueue().catch(error => {
      logger.error('Failed to process queue on online:', error);
    });
  }

  /**
   * Debounced drain — call when there's positive evidence the API is reachable
   * again (e.g. a successful network response) while `isOnline` never flipped:
   * the "API-down-while-online" recovery case that the offline→online trigger
   * misses. Coalesces bursts; `processQueue` itself no-ops when offline, empty,
   * or already processing, so this is safe to call liberally.
   */
  requestDrain(delayMs = 600): void {
    if (this.drainTimer) return;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.processQueue().catch(error => {
        logger.error('Failed to drain queue:', error);
      });
    }, delayMs);
  }

  /**
   * Event: User went offline
   */
  onOffline(): void {
    logger.info('📴 Queue: Network offline, queue processing paused');
  }

  /**
   * Event: User changed (logout or different user login)
   */
  onUserChange(newUserId: string | null, previousUserId: string | null): void {
    if (previousUserId && previousUserId !== newUserId) {
      logger.info(
        `🔄 Queue: User changed from ${previousUserId} to ${newUserId}, clearing old queue`,
      );
      queueStore.clearQueueForUser(previousUserId);
    }

    if (newUserId) {
      queueStore.setCurrentUserId(newUserId);

      // Process queue for new user if online
      const state = useStore.getState();
      if (state.isOnline) {
        this.processQueue();
      }
    }
  }

  /**
   * Event: User logged out
   */
  onLogout(userId: string): void {
    logger.info(`👋 Queue: User ${userId} logged out, clearing queue`);
    queueStore.clearQueueForUser(userId);
    queueStore.clearCurrentUserId();
  }

  /**
   * Get queue statistics
   */
  getStats(userId?: string) {
    return queueStore.getQueueStats(userId);
  }
}

// Singleton instance
export const queueManager = new QueueManager();
