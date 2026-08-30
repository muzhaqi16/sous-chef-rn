import { client } from '../client';
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
    // Level is the contract here. `queueLink` requests a drain after every
    // successful response, so the idle path runs constantly and production's
    // floor is `warn`: only the branches that MEAN something log at `warn` — a
    // skip, or a drain that found real work — so silence in Loki means a
    // healthy idle queue. Drain volume is carried by the counters
    // (`offline_queue_drain_started_total`, `offline_queue_drain_skipped_total`)
    // and `offline_queue_depth`, which go to Mimir and no log floor can filter.
    // Debug keeps the full per-drain trace in development, where the session-id
    // breadcrumb these exist for is still readable.
    Telemetry.debug('Queue drain invoked');

    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug('⏳ Queue: Already processing, waiting...');
      Telemetry.increment('offline_queue_drain_skipped_total', 1, {
        reason: 'already_processing',
      });
      Telemetry.warn('Queue drain skipped: already processing');
      return this.processingPromise || Promise.resolve();
    }

    const state = useStore.getState();

    // Check if user is authenticated
    if (!state.user || !state.accessToken) {
      logger.info('⚠️ Queue: No authenticated user, skipping processing');
      // Counted, not just logged: `logger` is console-only and console is
      // stripped from release builds, so on a real device these two branches
      // were invisible — and they decide whether queued writes ever replay.
      // `reason` is a fixed small set, so the cardinality is bounded.
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

    // The one drain outcome worth a production log line: writes are actually
    // replaying. Everything above this point is the idle path.
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
    const { syncMutation, syncVariables } = convertToSyncMutation(
      mutation,
      client.cache,
    );

    logger.info(`🔄 Queue: Replaying ${mutation.operationName} via sync`);

    // A replay's payload field name varies per queued operation, so its shape
    // is only knowable structurally. Apollo 4.2's modern signatures reject a
    // manually-passed generic, so the structural type arrives on the document
    // instead — one local cast rather than widening `SyncConversion`, whose
    // `TypedDocumentNode` params are invariant and would reject every concrete
    // builder's return.
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

    // Dynamic payload extraction — the mutation field name varies per queued
    // operation, so the value shape is only known structurally here. Shares the
    // foreground path's reader so both locate the payload by the same rule.
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

    // The replay above ran through `client.mutate` with no `update` callback,
    // so it got normalization and nothing else. An operation whose server
    // answer may name a DIFFERENT row than the one written locally has to be
    // settled here — the foreground path's own reconciliation returned long
    // ago, when the call classified as `'queued'`.
    reconcileReplaySuccess(mutation.operationName, syncVariables, result.data);

    return result.data;
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
        // Parked, not withdrawn. The server never saw this write, so nothing
        // about it was rejected — we just could not authenticate. Withdrawing
        // here destroyed the local change AND left an entry no drain would ever
        // look at again, under a toast that said the change had been rejected.
        // `revivePendingAuthErrors` puts it back in play on the next sign-in.
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

    // Non-retryable (validation / client / 4xx / GraphQL) error, or an auth
    // error that exhausted its retries — `markMutationFailed` maps the latter
    // to AUTH_ERROR.
    queueStore.markMutationFailed(mutation.id, queueError);

    if (queueError.type === 'auth') {
      // Parked, not withdrawn — see the token-refresh path above. The local
      // change stands until the queue actually gives up on it, which is when
      // `cleanupTerminal` ages the entry out.
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
  /**
   * Ages out terminal entries, and withdraws the local change of any that was
   * never actually sent.
   *
   * Runs BEFORE the empty-queue early return: it used to run at the end of a
   * drain, so a queue holding only terminal entries — nothing pending to
   * trigger the pass — was never cleaned at all.
   *
   * Only AUTH_ERROR needs withdrawing. SUCCESS replayed and FAILED was refused
   * and withdrawn at the time; an auth failure was neither, so its change has
   * been on screen since, waiting for a sign-in that never came. Ageing the
   * entry out is the moment that stops being true.
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
   * Withdraws a local-first write that could not be queued at all.
   *
   * The house pattern writes the cache permanently and THEN fires, so a
   * rejected enqueue leaves the change on screen, in the persisted cache, with
   * no queue entry and no drain that will ever carry it — the one way this
   * system could diverge from the server silently and permanently. A capacity
   * rejection is a refusal of this write, so it takes the same withdrawal as
   * any other refusal, from outside the manager.
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
  /**
   * Resolves once no drain is in flight.
   *
   * Used by the reconnect backfill to sequence itself after replay rather than
   * alongside it — replayed mutations write their own responses into the cache,
   * so refetching at the same moment doubles the burst and races the results.
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
   * Drop a drain that hasn't fired yet, so a timer cannot wake up against
   * credentials that cannot come back. The entries themselves stay.
   */
  cancelPendingDrain(): void {
    if (!this.drainTimer) return;
    clearTimeout(this.drainTimer);
    this.drainTimer = null;
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

      // A successful sign-in is exactly the event that makes an auth-parked
      // write replayable again, and this is the one funnel both a fresh login
      // and a same-user re-login pass through.
      queueStore.revivePendingAuthErrors(newUserId);

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

// A pending drain would otherwise wake up against credentials the server has
// already refused. The queued entries themselves stay: a rejected refresh token
// is not the user choosing to discard unsynced work, so they wait for that
// user's next sign-in (`onLogout`, which does delete them, stays on the
// deliberate sign-out path).
registerSessionTeardown('offline-queue', () => {
  queueManager.cancelPendingDrain();
});
