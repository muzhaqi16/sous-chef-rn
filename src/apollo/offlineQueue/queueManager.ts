import { gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { client } from '../client';
import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { queueStore } from './queueStore';
import { GetOfflineWritePolicyDocument } from './offlineWritePolicy.generated';
import {
  entryIntents,
  primaryQueuedEntityId,
  queuedEntityIds,
} from './queuedEntityIds';
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
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { logger } from '#/utils/environment';
import { Telemetry } from '#/services/telemetry';
import { registerSessionTeardown } from '#store/sessionTeardown';

/**
 * Default configuration for the queue manager
 */
const DEFAULT_CONFIG: QueueConfig = {
  retryDelayMs: 1000,
  processingTimeoutMs: 30000,
};

/**
 * How many times one entry may conflict before the queue stops re-sending it
 * and tells the person instead. A row being edited from another device faster
 * than this queue drains is not converging, and retrying forever holds up
 * everything behind it.
 */
const MAX_CONFLICT_RETRIES = 3;

/**
 * How many drains one entry may defer before it stops holding up the queue.
 *
 * A deferral is meant to be transient — the API is down, a rate limit is in
 * force — so an entry that keeps deferring is not converging, and nothing else
 * bounded it: the drain broke on the first defer and the next drain started at
 * the same entry, with only the 90-day expiry or a sign-out as an escape.
 * A starting value, not a measured one; `offline_queue_depth` and
 * `offline_queue_oldest_age_ms` are what tune it.
 */
const MAX_DEFERRALS = 10;

/**
 * Reads just the optimistic-lock version off an entity of a known typename.
 *
 * Built per typename rather than declared once `on Node`, because this schema
 * has NO `Node` interface — a fragment on a type that does not exist matches
 * nothing, so the read came back as `{ __typename }` with no `version` and
 * every conflict silently fell through to withdrawal. The whole
 * refresh-and-re-send path was dead, which is invisible in a test that stubs
 * `readFragment` to hand back a version the real cache would never have given.
 *
 * Cached, because a drain can hit many entries of the same type and `gql`
 * parsing is not free.
 */
const versionFragments = new Map<string, DocumentNode>();

function entityVersionFragment(typename: string): DocumentNode {
  const cached = versionFragments.get(typename);
  if (cached) return cached;
  const fragment = gql`
    fragment QueuedEntityVersion on ${typename} {
      version
    }
  `;
  versionFragments.set(typename, fragment);
  return fragment;
}

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
  /** Whether this session has read the server's replay horizon yet. */
  private policyRead = false;

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
   * Adopt the server's replay horizon, once per session.
   *
   * Failure is deliberately silent and non-blocking: the queue keeps its
   * fallback and drains anyway. A drain that refused to run because a policy
   * read failed would strand exactly the writes it exists to deliver.
   */
  private async readReplayHorizon(): Promise<void> {
    if (this.policyRead) return;
    this.policyRead = true;

    let days: number | undefined;
    try {
      const result = await client.query({
        query: GetOfflineWritePolicyDocument,
        fetchPolicy: 'network-only',
      });
      days = result.data?.offlineWritePolicy?.replayHorizonDays;
    } catch (error) {
      logger.debug('Queue: could not read the replay horizon', error);
    }

    if (typeof days === 'number') {
      queueStore.setReplayHorizonDays(days);
      logger.info(`📅 Queue: replay horizon is ${days} day(s)`);
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
    // Read once per session, and only where a reachable server has already
    // been established. Deliberately INSIDE the drain rather than before it:
    // `processQueue` returns early when a drain is already running, and an
    // await between that check and the `isProcessing` latch would let a second
    // caller slip past while the first was still reading the policy.
    await this.readReplayHorizon();

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
    // An expired entry is one the queue has decided never to send. Its local
    // change is on screen with nothing left that would ever make it true, so it
    // takes the same withdrawal as any other abandoned write — the person is
    // told, rather than trusting a change that silently never synced.
    for (const expired of queueStore.expireStalePending(userId)) {
      this.invokeFailureHandler(
        expired,
        expired.lastError ?? {
          type: 'unknown',
          message: 'Queued change expired before it could be sent',
          timestamp: Date.now(),
          retryable: false,
        },
      );
    }

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
    // Client ids whose write could not be delivered this drain. Anything
    // touching one of them waits, because it may be the create that has to
    // land first.
    const blocked = new Set<string>();
    for (const mutation of mutations) {
      const ids = this.getAllEntityIds(mutation);
      if (ids.some(id => blocked.has(id))) {
        // Its dependency is still undelivered, so this cannot land either.
        // Stays PENDING for the next drain, in its original position.
        for (const id of ids) blocked.add(id);
        continue;
      }

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

        // A transient defer left this mutation PENDING. Hold back the writes
        // that DEPEND on it — a write to an entity must never be sent before
        // the write that created it — but let unrelated entities through.
        //
        // Breaking the whole drain here was the head-of-line problem: FIFO is
        // global, so one stuck pantry write held back every shopping-list write
        // behind it, for as long as the condition lasted. Causal order only
        // needs the entries that actually share an entity.
        if (result.deferred) {
          for (const id of this.getAllEntityIds(mutation)) blocked.add(id);
          logger.info(
            `🕓 Queue: ${mutation.operationName} deferred — holding back its dependents, continuing with the rest`,
          );
          continue;
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

      // Success - remove from queue. The counters go with it: they bound a run
      // of failures, and this entry's run is over.
      queueStore.updateMutation(mutationId, {
        status: QueueStatus.SUCCESS,
        processedAt: Date.now(),
        deferCount: 0,
        conflictCount: 0,
      });

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
    const { syncMutation, syncVariables } = convertToSyncMutation(mutation);

    logger.info(`🔄 Queue: Replaying ${mutation.operationName}`);

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

    // The server accepted this write's ARRIVAL but kept its own value for the
    // field: it caught the version conflict and answered with a success payload
    // carrying `converged: true` plus the conflict. So the entry is genuinely
    // done — re-sending is wrong, the payload's `item` has already normalized
    // the authoritative state into the cache, and the cache is correct.
    //
    // What was missing is the person. This dequeued as a plain success, so a
    // shopping row or pantry quantity edited offline silently snapped back to
    // another device's value with no message at all — the only trace being a
    // counter in Mimir. Report it WITHOUT evicting: the cache already holds the
    // truth, so only the signal is owed.
    if (payload?.conflict) {
      logger.warn(
        `⚠️ Queue: ${mutation.operationName} overwritten by a newer change:`,
        payload.conflict.message,
      );
      Telemetry.increment('offline_queue_conflicts_total', 1, {
        operation: mutation.operationName,
      });
      this.reportOverwritten(mutation);
    }

    return result.data;
  }

  /**
   * Tell the person a queued change was overwritten, without withdrawing it.
   *
   * The server already resolved this one in its own favour and returned its
   * state, which Apollo has normalized — so the cache is right and an evict
   * would throw away the truth rather than a stale value. `entityType`/
   * `entityId` are still resolved so the handler can point at the row.
   */
  private reportOverwritten(mutation: QueuedMutation): void {
    this.invokeFailureHandler(mutation, {
      type: 'conflict',
      message: 'Queued change was overwritten by a newer change',
      code: 'OVERWRITTEN',
      timestamp: Date.now(),
      retryable: false,
    });
  }

  /**
   * A queued write the server declined because the entity has changed since.
   *
   * Split by what the write's value MEANS, which is the one thing that cannot
   * be read off the input:
   *
   * - **absolute** — the input carries a final value the person typed as a
   *   fact. Refresh the version from cache and re-send: last-writer-wins is
   *   what they meant. Safe because the API rolls the idempotency claim back
   *   with the conflict, so the same key re-sent against a fresh version
   *   applies exactly once.
   * - **relative** — the input carries a change to whatever is there.
   *   Re-sending against a refreshed version would apply it a SECOND time, so
   *   the write is withdrawn and the person told their change was overwritten.
   *
   * Bounded either way: a row under constant concurrent edit withdraws rather
   * than deferring forever.
   */
  private handleVersionConflict(
    mutation: QueuedMutation,
    queueError: QueueError,
  ): ProcessingResult {
    const conflicts = (mutation.conflictCount ?? 0) + 1;
    const refreshed =
      mutation.convergence === 'absolute' && conflicts <= MAX_CONFLICT_RETRIES
        ? this.refreshQueuedVersion(mutation)
        : null;

    if (refreshed != null) {
      queueStore.updateMutation(mutation.id, {
        status: QueueStatus.PENDING,
        retryCount: 0,
        conflictCount: conflicts,
        variables: refreshed,
        lastError: queueError,
      });
      logger.info(
        `🔀 Queue: ${mutation.operationName} conflicted — version refreshed, re-queued (attempt ${conflicts})`,
      );
      Telemetry.increment('offline_queue_conflicts_total', 1, {
        operation: mutation.operationName,
      });
      return {
        success: false,
        deferred: true,
        mutationId: mutation.id,
        error: queueError,
      };
    }

    // Either the value is relative (re-sending would double-apply), the row is
    // under constant edit, or the entity is no longer cached to read a version
    // from. The server's state stands; the person is told it did.
    logger.warn(
      `🔀 Queue: ${mutation.operationName} overwritten by a newer change — withdrawing`,
    );
    Telemetry.increment('offline_queue_conflicts_total', 1, {
      operation: mutation.operationName,
    });
    queueStore.markMutationFailed(mutation.id, queueError);
    this.invokeFailureHandler(mutation, queueError);
    return { success: false, mutationId: mutation.id, error: queueError };
  }

  /**
   * The queued variables with `input.version` refreshed from the cache, or null
   * when there is no fresher version to send.
   *
   * The stale version is the whole cause: hooks capture it when the person taps
   * and nothing updates it before the replay, so two offline edits to one row
   * send the same number twice. Reading it back from the normalized cache —
   * which the failed replay's own response has just updated — is what makes the
   * re-send land.
   */
  private refreshQueuedVersion(
    mutation: QueuedMutation,
  ): OperationVariables | null {
    const input = mutation.variables?.input;
    if (!input || typeof input !== 'object') return null;
    const staleVersion = (input as { version?: unknown }).version;
    if (typeof staleVersion !== 'number') return null;

    const entityId = this.getEntityId(mutation);
    if (!entityId) return null;
    const entityType = this.findCachedTypename(
      entityId,
      this.extractCacheSnapshot(),
    );
    if (!entityType) return null;

    const cached = client.cache.readFragment<{ version?: number }>({
      id: `${entityType}:${entityId}`,
      fragment: entityVersionFragment(entityType),
    });
    const current = cached?.version;
    if (typeof current !== 'number' || current === staleVersion) return null;

    return {
      ...mutation.variables,
      input: { ...(input as object), version: current },
    };
  }

  /**
   * Handle mutation execution error
   */
  private async handleMutationError(
    mutation: QueuedMutation,
    error: unknown,
  ): Promise<ProcessingResult> {
    const queueError = classifyError(error);

    // The entity moved on since this write was made. Neither a retry nor a
    // withdrawal is right on its own — see handleVersionConflict.
    if (queueError.type === 'conflict') {
      return this.handleVersionConflict(mutation, queueError);
    }

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
      const deferrals = (mutation.deferCount ?? 0) + 1;

      // A deferral is supposed to be transient. One that keeps recurring is not
      // converging, and it holds the whole queue behind it — so past the bound
      // the entry stops being the head and is resolved like any other write the
      // queue has given up on, with the person told.
      if (deferrals > MAX_DEFERRALS) {
        logger.warn(
          `🛑 Queue: ${mutation.id} deferred ${MAX_DEFERRALS} times — giving up so the queue can drain`,
        );
        Telemetry.increment('offline_queue_permanent_failures_total', 1, {
          operation: mutation.operationName,
          error_type: 'deferral_bound',
        });
        queueStore.markMutationFailed(mutation.id, queueError);
        this.invokeFailureHandler(mutation, queueError);
        return { success: false, mutationId: mutation.id, error: queueError };
      }

      queueStore.updateMutation(mutation.id, {
        status: QueueStatus.PENDING,
        retryCount: 0,
        deferCount: deferrals,
      });
      logger.info(
        `🕓 Queue: ${mutation.id} deferred (transient ${queueError.type}, ${deferrals}/${MAX_DEFERRALS}) — stays PENDING for next drain`,
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
    return primaryQueuedEntityId(mutation.variables);
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
    return queuedEntityIds(mutation.variables);
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
      error,
      intents: entryIntents(mutation),
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
  // Drop the write-through mirror too. It is populated lazily, so a session end
  // can otherwise leave RAM holding entries whose durability was decided
  // elsewhere — and a later write would persist that stale view back to disk.
  // Reading from disk on the next access is the only way the two cannot drift.
  queueStore.invalidateCache();
});
