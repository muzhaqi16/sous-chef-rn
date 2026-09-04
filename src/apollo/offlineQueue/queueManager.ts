import { getApolloClient } from '#/apollo/clientRegistry';
import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
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
import { reconcileReplaySuccess } from './queueReplayReconcilers';
import { proactiveTokenRefresh } from '../links/refreshToken';
import { refreshUnitVocabulary } from './refreshUnitVocabulary';
import {
  classifyError,
  calculateRetryDelay,
  classifyReplayResult,
  ReplayRejectedError,
} from './queueErrorPolicy';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { logger } from '#/utils/environment';
import { Telemetry } from '#/services/telemetry';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { registerSessionTeardown } from '#store/sessionTeardown';

/**
 * The queue only ever runs after `client.ts` has evaluated — it is the link
 * chain that starts a drain — so a missing client here is a wiring bug, not a
 * state to handle.
 */
const requireApolloClient = () => {
  const client = getApolloClient();
  if (!client) {
    throw new Error('Apollo client not registered before a queue drain');
  }
  return client;
};

const DEFAULT_CONFIG: QueueConfig = {
  retryDelayMs: 1000,
  processingTimeoutMs: 30000,
};

/**
 * Replays offline-queued mutations for the signed-in user: auth-aware,
 * user-scoped, strict FIFO, with bounded retries.
 */
export class QueueManager {
  private config: QueueConfig;
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private failureHandler: FailureHandler | null = null;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;
  /** Whether this drain has already re-fetched the unit vocabulary. */
  private hasRefreshedUnits = false;
  /** Entries that have already spent their one re-resolution attempt. */
  private staleReferenceRetried = new Set<string>();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Invoked when a mutation permanently fails after exhausting retries. */
  setFailureHandler(handler: FailureHandler): void {
    this.failureHandler = handler;
  }

  async processQueue(): Promise<void> {
    // Telemetry level is the contract: `queueLink` drains after every successful
    // response, so production's `warn` floor carries only branches that MEAN
    // something and silence reads as a healthy idle queue. Volume rides the
    // counters instead, which no log floor can filter.
    Telemetry.debug('Queue drain invoked');

    if (this.isProcessing) {
      logger.debug('⏳ Queue: Already processing, waiting...');
      Telemetry.increment('offline_queue_drain_skipped_total', 1, {
        reason: 'already_processing',
      });
      Telemetry.warn('Queue drain skipped: already processing');
      return this.processingPromise || Promise.resolve();
    }

    const state = useStore.getState();

    if (!state.user || !state.accessToken) {
      logger.info('⚠️ Queue: No authenticated user, skipping processing');
      // Counted, not just logged: `logger` is console-only and console is
      // stripped from release builds, so this skip is invisible on a device
      // otherwise. `reason` is a fixed small set, so cardinality stays bounded.
      Telemetry.increment('offline_queue_drain_skipped_total', 1, {
        reason: 'no_authenticated_user',
      });
      Telemetry.warn('Queue drain skipped: no authenticated user');
      return;
    }

    // Don't replay when the server is unreachable (device offline OR the API
    // reachability breaker is open) — replays would just fail and re-trip it.
    if (isApiUnavailable(state)) {
      logger.debug('📴 Queue: Server unreachable, skipping processing');
      Telemetry.increment('offline_queue_drain_skipped_total', 1, {
        reason: 'api_unavailable',
      });
      Telemetry.warn('Queue drain skipped: API unavailable', {
        is_online: state.isOnline,
      });
      return;
    }

    const userId = state.user.id;
    logger.info(`🔄 Queue: Starting processing for user ${userId}`);

    Telemetry.increment('offline_queue_drain_started_total', 1);

    Telemetry.debug('Queue drain started');

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
   * Replay all pending mutations strictly in insertion order. The queue is
   * append-only from one user's actions, so insertion order IS causal order —
   * a parent create precedes any dependent referencing its client-minted id.
   * No grouping or dependency analysis: FIFO is correct by construction.
   */
  private async _processQueueInternal(userId: string): Promise<void> {
    const hasValidToken = await this.validateTokenBeforeReplay();
    if (!hasValidToken) {
      logger.error('❌ Queue: Token validation failed, cannot process');
      return;
    }

    // Per-drain, not per-entry: a backlog of writes naming the same retired
    // unit draws one refresh between them, and an entry gets one re-resolution.
    this.hasRefreshedUnits = false;
    this.staleReferenceRetried.clear();

    // Recover entries a killed process left mid-replay: drains are serialized
    // by isProcessing, so any PROCESSING entry visible here is stranded debris,
    // not live work. Reset to PENDING so this drain picks them up.
    queueStore.resetProcessingToPending(userId);

    // Never replay past the server's 90-day idempotency-dedup horizon — the
    // dedup record is pruned by then, so a replay would double-apply instead
    // of classifying as IDEMPOTENT_REPLAY. Expired entries surface as FAILED.
    queueStore.expireStalePending(userId);

    this.reconcileDiscardedEntries();

    const mutations = queueStore.getPendingMutationsForUser(userId);

    // Queue health at drain time: depth, and how long the oldest entry has
    // been waiting. A growing age across drains means changes aren't syncing.
    Telemetry.gauge('offline_queue_depth', mutations.length);
    if (mutations.length === 0) {
      logger.info('✅ Queue: No pending mutations');
      Telemetry.debug('Queue drain found no pending mutations');
      return;
    }
    Telemetry.gauge(
      'offline_queue_oldest_age_ms',
      Date.now() - Math.min(...mutations.map(m => m.createdAt)),
    );

    // The one drain outcome worth a production log line.
    Telemetry.warn('Queue drain replaying pending mutations', {
      count: mutations.length,
    });

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

        // A transient defer left this mutation PENDING; stop the drain so a
        // later, possibly dependent mutation can't replay ahead of it.
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
  }

  private async processMutation(
    mutation: QueuedMutation,
  ): Promise<ProcessingResult> {
    const mutationId = mutation.id;

    try {
      queueStore.updateMutation(mutationId, {
        status: QueueStatus.PROCESSING,
      });

      logger.info(
        `⚡ Queue: Processing ${mutation.operationName} (${mutationId})`,
      );

      const result = await this.executeWithTimeout(mutation);

      queueStore.updateMutation(mutationId, {
        status: QueueStatus.SUCCESS,
        processedAt: Date.now(),
      });

      // The change is on the server now, so drop the persisted optimistic
      // fields — otherwise restoration re-applies stale values over fresher
      // server state on a later mount. Still-PENDING entries are untouched.
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
   * Replays a queued item through its sync mutation, idempotent by the
   * client-generated id that rides along as `clientId`.
   */
  private async executeMutation(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | undefined> {
    const client = requireApolloClient();
    const { syncMutation, syncVariables } = convertToSyncMutation(
      mutation,
      client.cache,
    );

    logger.info(`🔄 Queue: Replaying ${mutation.operationName} via sync`);

    // Apollo 4.2's signatures reject a manually-passed generic, so the
    // structural payload type arrives on the document instead — a local cast
    // rather than widening `SyncConversion`, whose `TypedDocumentNode` params
    // are invariant and would reject every concrete builder's return.
    const result = await client.mutate({
      mutation: syncMutation as TypedDocumentNode<
        Record<string, unknown>,
        OperationVariables
      >,
      variables: syncVariables,
      context: {
        ...mutation.context,
        skipQueueLink: true,
      },
    });

    if (result.error) {
      throw result.error;
    }

    // The mutation field name varies per queued operation, so the payload is
    // only knowable structurally; shares the foreground path's reader.
    const payload = extractMutationPayload(result.data) as
      | {
          __typename?: string;
          code?: string;
          message?: string;
          conflict?: { message?: string };
        }
      | null
      | undefined;

    // Under errorPolicy 'all' a server refusal RESOLVES as an error union
    // member instead of throwing; without this a rejected replay is marked
    // SUCCESS and dequeued while the optimistic cache write lingers.
    const outcome = classifyReplayResult(payload);
    if (outcome === 'converged') {
      // IDEMPOTENT_REPLAY: an earlier attempt already committed this op, so the
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

    // Server wins on conflict, and its version already rides back in the
    // response; this is diagnostics only.
    if (payload?.conflict) {
      logger.warn(
        `⚠️ Queue: Conflict detected for ${mutation.operationName}:`,
        payload.conflict.message,
      );
      Telemetry.increment('offline_queue_conflicts_total', 1, {
        operation: mutation.operationName,
      });
    }

    // The replay ran with no `update` callback, so it got normalization and
    // nothing else. An operation whose server answer may name a DIFFERENT row
    // than the one written locally is settled here: the foreground path's own
    // reconciliation returned when the call classified as `'queued'`.
    reconcileReplaySuccess(mutation.operationName, syncVariables, result.data);

    return result.data;
  }

  private async handleMutationError(
    mutation: QueuedMutation,
    error: unknown,
  ): Promise<ProcessingResult> {
    const queueError = classifyError(error);

    // Auth errors force ONE token refresh, then retry through the same bounded
    // counter as every other retryable error — re-validating the existing token
    // instead would loop forever on a revoked session.
    if (queueError.type === 'auth') {
      const newToken = await proactiveTokenRefresh();
      if (!newToken) {
        // Parked, not withdrawn: the server never saw this write, so nothing
        // about it was rejected. `revivePendingAuthErrors` puts it back in play
        // on the next sign-in; withdrawing here would destroy the local change.
        logger.error(
          `❌ Queue: Token refresh failed for ${mutation.id} — parked until re-auth`,
        );
        queueStore.markMutationFailed(mutation.id, queueError);
        Telemetry.increment('offline_queue_auth_parked_total', 1, {
          operation: mutation.operationName,
        });
        return { success: false, mutationId: mutation.id, error: queueError };
      }
      useStore.getState().setNeedsTokenRefresh(false);
      logger.info(`🔐 Queue: Token refreshed for ${mutation.id}, retrying`);
    }

    // A unit the write names was merged away by the API's vocabulary repair.
    // Refresh the vocabulary and re-send ONCE — `convertToSyncMutation` rebuilds
    // the sync input from the cache on every attempt, so the rebuilt write
    // resolves against current rows. A second refusal is a real one: drop
    // `retryable` so it falls through to revert-and-inform below.
    if (queueError.type === 'stale-reference') {
      if (this.staleReferenceRetried.has(mutation.id)) {
        logger.warn(
          `❌ Queue: ${mutation.id} still names a retired unit after re-resolution`,
        );
        queueError.retryable = false;
      } else {
        this.staleReferenceRetried.add(mutation.id);
        if (!this.hasRefreshedUnits) {
          this.hasRefreshedUnits = true;
          refreshUnitVocabulary();
        }
        logger.info(
          `♻️ Queue: ${mutation.id} names a retired unit, re-resolving and retrying`,
        );
      }
    }

    // Retryable errors (refreshed-auth, network, 5xx): bounded in-run retries
    if (queueError.retryable && mutation.retryCount < mutation.maxRetries) {
      logger.info(
        `🔄 Queue: Scheduling retry for ${mutation.id} (attempt ${
          mutation.retryCount + 1
        }/${mutation.maxRetries})`,
      );

      queueStore.incrementRetry(mutation.id);

      const delay = calculateRetryDelay(
        mutation.retryCount,
        this.config.retryDelayMs,
      );
      await new Promise(resolve => setTimeout(resolve, delay));

      // Gate on `isApiUnavailable`, not bare `isOnline`: an open reachability
      // breaker (device online, API down) must defer rather than re-trip it.
      const state = useStore.getState();
      if (!isApiUnavailable(state)) {
        return await this.processMutation({
          ...mutation,
          retryCount: mutation.retryCount + 1,
        });
      }
    }

    // Transient errors that exhausted the in-run retries stay PENDING so the
    // change survives to the next drain rather than being dropped; retryCount
    // resets so that drain gets a fresh attempt.
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

    // Non-retryable (validation / client / 4xx / GraphQL) error, or an auth
    // error that exhausted its retries — `markMutationFailed` maps the latter
    // to AUTH_ERROR.
    queueStore.markMutationFailed(mutation.id, queueError);

    if (queueError.type === 'auth') {
      // Parked, not withdrawn (see the token-refresh path above): the local
      // change stands until `cleanupTerminal` ages the entry out.
      Telemetry.increment('offline_queue_auth_parked_total', 1, {
        operation: mutation.operationName,
      });
    } else {
      this.invokeFailureHandler(mutation, queueError);
      Telemetry.increment('offline_queue_permanent_failures_total', 1, {
        operation: mutation.operationName,
        error_type: queueError.type,
      });
    }

    return {
      success: false,
      mutationId: mutation.id,
      error: queueError,
    };
  }

  private async validateTokenBeforeReplay(): Promise<boolean> {
    const state = useStore.getState();

    if (!state.accessToken) {
      logger.info('⚠️ Queue: No access token available');
      return false;
    }

    if (state.needsTokenRefresh) {
      logger.info(
        '🔄 Queue: Deferred token refresh pending, attempting refresh before replay',
      );
      const newToken = await proactiveTokenRefresh();
      if (newToken) {
        useStore.getState().setNeedsTokenRefresh(false);
        return true;
      }
      logger.error(
        '❌ Queue: Deferred token refresh failed, aborting queue processing',
      );
      return false;
    }

    // No deferred refresh: the auth link handles an expired token on the wire.
    return true;
  }

  /**
   * The client entity id a queued mutation targets, across every variable shape
   * the app enqueues. Feeds the failure handler's evict target.
   */
  private getEntityId(mutation: QueuedMutation): string | null {
    const vars = mutation.variables ?? {};
    return (
      vars.id ??
      vars.input?.id ??
      // Single adds ride the batch AddItemsToShoppingListInput shape.
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
   * evict. Typename comes off the normalized cache rather than a per-operation
   * map: the hook wrote the entity under `TypeName:<clientId>` before firing
   * and client ids are globally-unique cuids, so the key identifies the type.
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
   * getEntityId's single candidate plus every `input.items[].id` of a
   * batch-shaped create, which carries one client-minted id per row.
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
   * touched. An uncached entity has nothing to restore, so skipping it is right.
   */
  private clearPersistedOptimisticFields(mutation: QueuedMutation): void {
    const entityIds = this.getAllEntityIds(mutation);
    if (entityIds.length === 0) return;
    // One snapshot for the whole batch rather than one extract per id.
    const snapshot = this.extractCacheSnapshot();
    for (const entityId of entityIds) {
      const entityType = this.findCachedTypename(entityId, snapshot);
      if (entityType) {
        optimisticDataPersistence.clearEntity(entityType, entityId);
      }
    }
  }

  /**
   * `InMemoryCache.extract()` returns the entity map keyed by `TypeName:id`;
   * the generic ApolloCache type erases that to `unknown`.
   */
  private extractCacheSnapshot(): Record<string, unknown> {
    return requireApolloClient().cache.extract() as Record<string, unknown>;
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
   * Ages out terminal entries, withdrawing the local change of any never sent.
   * Must run BEFORE the empty-queue early return, or a queue holding only
   * terminal entries is never cleaned. Only AUTH_ERROR needs withdrawing:
   * SUCCESS replayed, FAILED was refused and withdrawn at the time.
   */
  private reconcileDiscardedEntries(): void {
    for (const discarded of queueStore.cleanupTerminal()) {
      if (discarded.status !== QueueStatus.AUTH_ERROR) continue;
      this.invokeFailureHandler(
        discarded,
        discarded.lastError ?? {
          type: 'auth',
          message: 'Queued change expired without ever being authenticated',
          timestamp: Date.now(),
          retryable: false,
        },
      );
    }
  }

  /**
   * Withdraws a local-first write that could not be queued at all. The house
   * pattern writes the cache permanently and THEN fires, so a rejected enqueue
   * would otherwise leave the change on screen and in the persisted cache with
   * no entry and no drain to carry it — a silent, permanent divergence.
   */
  withdrawUnqueueableWrite(mutation: QueuedMutation, error: QueueError): void {
    this.invokeFailureHandler(mutation, error);
  }

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
      variables: mutation.variables,
      error,
    };

    try {
      this.failureHandler(info);
    } catch (handlerError) {
      logger.error('Queue: Failure handler threw an error:', handlerError);
    }
  }

  /**
   * Races the replay against the processing timeout. The timer must be cleared
   * once either settles, or every replay keeps the JS engine busy for 30s.
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
   * Resolves once no drain is in flight. The reconnect backfill sequences
   * itself behind this: replayed mutations write their own responses into the
   * cache, so refetching alongside doubles the burst and races the results.
   */
  async whenIdle(): Promise<void> {
    await this.processingPromise?.catch(() => {});
  }

  onOnline(): void {
    logger.info('📡 Queue: Network online, starting queue processing');
    this.processQueue().catch(error => {
      logger.error('Failed to process queue on online:', error);
    });
  }

  /**
   * Debounced drain for positive evidence the API is reachable while `isOnline`
   * never flipped — the case the offline→online trigger misses. `processQueue`
   * no-ops when offline, empty or busy, so calling this liberally is safe.
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

  /** Drops an unfired drain so no timer wakes against dead credentials. Queue
   * entries themselves stay. */
  cancelPendingDrain(): void {
    if (!this.drainTimer) return;
    clearTimeout(this.drainTimer);
    this.drainTimer = null;
  }

  onOffline(): void {
    logger.info('📴 Queue: Network offline, queue processing paused');
  }

  onUserChange(newUserId: string | null, previousUserId: string | null): void {
    if (previousUserId && previousUserId !== newUserId) {
      logger.info(
        `🔄 Queue: User changed from ${previousUserId} to ${newUserId}, clearing old queue`,
      );
      queueStore.clearQueueForUser(previousUserId);
    }

    if (newUserId) {
      queueStore.setCurrentUserId(newUserId);

      // A sign-in is what makes an auth-parked write replayable again, and both
      // a fresh login and a same-user re-login funnel through here.
      queueStore.revivePendingAuthErrors(newUserId);

      const state = useStore.getState();
      if (state.isOnline) {
        this.processQueue();
      }
    }
  }

  onLogout(userId: string): void {
    logger.info(`👋 Queue: User ${userId} logged out, clearing queue`);
    queueStore.clearQueueForUser(userId);
    queueStore.clearCurrentUserId();
  }

  getStats(userId?: string) {
    return queueStore.getQueueStats(userId);
  }
}

export const queueManager = new QueueManager();

// Cancel only: a rejected refresh token is not the user choosing to discard
// unsynced work, so entries wait for that user's next sign-in. Deleting them is
// `onLogout`'s job, on the deliberate sign-out path.
registerSessionTeardown('offline-queue', () => {
  queueManager.cancelPendingDrain();
});
