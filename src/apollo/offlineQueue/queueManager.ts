import { getApolloClient } from '#/apollo/clientRegistry';
import type { OperationVariables, TypedDocumentNode } from '@apollo/client';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { queueStore } from './queueStore';
import type {
  QueuedMutation,
  ProcessingResult,
  QueueConfig,
  QueueError,
} from './types';
import {
  QueueStatus,
  type FailedMutationInfo,
  type FailureHandler,
  type OverwriteReporter,
} from './types';
import { convertToSyncMutation, hasSyncMapping } from './convertToSyncMutation';
import { reconcileReplaySuccess } from './queueReplayReconcilers';
import { queuedSubject } from './queuedSubject';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  AdjustPantryItemQuantityDocument,
  AdjustPantryItemWeightDocument,
} from '#features/pantry/graphql/pantry.generated';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { proactiveTokenRefresh } from '../links/refreshToken';
import { refreshUnitVocabulary } from './refreshUnitVocabulary';
import {
  classifyError,
  calculateRetryDelay,
  classifyReplayResult,
  ReplayRejectedError,
} from './queueErrorPolicy';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { TimeoutError } from '#/utils/errors/timeoutError';
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

/** One version-free re-send. A second conflict is a race, not a stale read. */
const MAX_CONFLICT_RESENDS = 1;

/**
 * Queued operations that replay their ORIGINAL document against an input whose
 * `version` is non-null. A version-free re-send of one is refused as malformed,
 * so the conflict is reported instead. Pinned to the SDL by
 * `__tests__/apollo/queueVersionRequirement.test.ts`.
 */
export const VERSION_REQUIRED_OPERATIONS: ReadonlySet<string> = new Set(
  [
    AdjustPantryItemQuantityDocument,
    AdjustPantryItemWeightDocument,
    UpdateShoppingListDocument,
    UpdateHomeDocument,
  ].map(operationNameOf),
);

/**
 * Input keys that name the PARENT a queued write attaches to. A deferred
 * parent holds these children back; the keys stay out of
 * {@link QueueManager.getAllEntityIds} so a refused child never evicts its parent.
 */
export const PARENT_REFERENCE_KEYS: readonly string[] = [
  'homeId',
  'appliesToHomeId',
  'pantryId',
  'shoppingListId',
  'shoppingListItemId',
  'afterItemId',
  'beforeItemId',
  'storageLocationId',
  'parentLocationId',
  'mealPlanId',
  'mealPlanItemId',
  'templateId',
  'recipeIngredientId',
  'cookingLogId',
  'targetBatchId',
  'purchaseId',
];

/**
 * Drops the `version` a write captured when the user acted. Covers the batch
 * shape too: single-add shopping ops send `input.items[]`, each line carrying
 * its own version.
 */
const withoutVersion = (variables: OperationVariables): OperationVariables => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return variables;

  const { version: _version, ...rest } = input;
  const items = rest.items;
  if (Array.isArray(items)) {
    rest.items = items.map((line: unknown) =>
      isRecord(line)
        ? (({ version: _lineVersion, ...lineRest }) => lineRest)(line)
        : line,
    );
  }
  return { ...variables, input: rest };
};

// Queued variables are persisted JSON, so their shape is read structurally.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Replays offline-queued mutations for the signed-in user: auth-aware,
 * user-scoped, dependency-ordered, with bounded retries.
 */
/** The fields a replay reads off whichever union member the server returned. */
interface ReplayPayload {
  code?: string;
  message?: string;
  // `NotFoundError.resource`: without it a refusal over a merged-away Unit is
  // indistinguishable from one over the record itself.
  resource?: string;
  conflict?: { message?: string };
}

export class QueueManager {
  private config: QueueConfig;
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private failureHandler: FailureHandler | null = null;
  private overwriteReporter: OverwriteReporter | null = null;
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

  /** Invoked when the server accepted a replay but kept its own value. */
  setOverwriteReporter(reporter: OverwriteReporter): void {
    this.overwriteReporter = reporter;
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
      return this.processingPromise ?? Promise.resolve();
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
   * Replay pending mutations in insertion order, holding back only what
   * depends on an undelivered entry: a write waits behind the write that
   * minted its subject OR its parent. A transport-class deferral pauses the
   * pass; a row-scoped one (DEADLOCK) holds that entry and its dependents.
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
    // Client ids belonging to an entry that did not deliver this drain. Only
    // entries touching one of them wait; the rest of the queue drains, so a
    // create→update chain keeps its order without blocking unrelated entities.
    const blockedIds = new Set<string>();
    for (const mutation of mutations) {
      // Stop replaying the moment the server becomes unreachable — the rest
      // of the queue stays PENDING for the next drain.
      if (isApiUnavailable(useStore.getState())) {
        logger.info('📴 Queue: Server became unreachable, pausing');
        break;
      }

      const entityIds = this.getAllEntityIds(mutation);
      const dependencyIds = this.getDependencyIds(mutation);
      if ([...entityIds, ...dependencyIds].some(id => blockedIds.has(id))) {
        // Depends on an entry that has not landed; blocked itself, so anything
        // downstream of IT waits too.
        for (const id of entityIds) blockedIds.add(id);
        logger.info(
          `⏭️ Queue: ${mutation.id} waits behind an undelivered dependency`,
        );
        continue;
      }

      try {
        const result = await this.processMutation(mutation);
        if (result.success) succeeded++;
        else failed++;

        if (result.deferred) {
          if (result.deferralScope === 'transport') {
            // The API's own state, not this entry's: every later entry would
            // meet it too, and each attempt costs a retry cycle.
            logger.info('🕓 Queue: server-side deferral, pausing the drain');
            break;
          }
          for (const id of entityIds) blockedIds.add(id);
          logger.info(
            '🕓 Queue: Mutation deferred (transient), holding its dependents',
          );
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
    // structural payload type arrives on the document: `SyncConversion` carries
    // a plain `DocumentNode`, which this declaration types.
    const typedMutation: TypedDocumentNode<
      Record<string, unknown>,
      OperationVariables
    > = syncMutation;
    const result = await client.mutate({
      mutation: typedMutation,
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
    const payload: ReplayPayload | null | undefined = extractMutationPayload(
      result.data,
    );

    // Under errorPolicy 'all' a server refusal RESOLVES as an error union
    // member instead of throwing; without this a rejected replay is marked
    // SUCCESS and dequeued while the optimistic cache write lingers.
    const outcome = classifyReplayResult(payload);
    if (outcome.status === 'converged') {
      // IDEMPOTENT_REPLAY: an earlier attempt already committed this op, so the
      // change is on the server. Dequeue as success.
      logger.info(
        `✅ Queue: ${mutation.operationName} already committed by an earlier attempt — dropping replay`,
      );
      return result.data;
    }
    if (outcome.status === 'rejected') {
      throw new ReplayRejectedError(
        outcome.typename,
        payload?.message ??
          `${mutation.operationName} was rejected by the server on replay`,
        payload?.code ?? null,
        payload?.resource ?? null,
      );
    }

    // The server accepted the replay and kept its own value. The entry dequeues
    // as success — nothing to withdraw — but the user's change is gone, so
    // saying nothing would leave them believing it stuck.
    if (payload?.conflict) {
      logger.warn(
        `⚠️ Queue: Conflict detected for ${mutation.operationName}:`,
        payload.conflict.message,
      );
      Telemetry.increment('offline_queue_conflicts_total', 1, {
        operation: mutation.operationName,
      });
      this.reportOverwrite(mutation);
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

    // The captured `version` is knowingly stale, so it is stripped and the
    // user's value re-sent once. That needs a replay document whose input lets
    // `version` be omitted: a Sync twin, or an original not listed above.
    if (queueError.type === 'conflict') {
      const conflictCount = (mutation.conflictCount ?? 0) + 1;
      queueStore.updateMutation(mutation.id, { conflictCount });

      const canResendVersionFree =
        hasSyncMapping(mutation.operationName) ||
        !VERSION_REQUIRED_OPERATIONS.has(mutation.operationName);

      if (conflictCount > MAX_CONFLICT_RESENDS || !canResendVersionFree) {
        logger.warn(
          canResendVersionFree
            ? `❌ Queue: ${mutation.id} still conflicts after a version-free re-send`
            : `❌ Queue: ${mutation.id} conflicts and its input requires a version — reporting`,
        );
        Telemetry.increment('offline_queue_conflicts_total', 1, {
          operation: mutation.operationName,
        });
        queueError.retryable = false;
      } else {
        const variables = withoutVersion(mutation.variables);
        queueStore.updateMutation(mutation.id, { variables });
        logger.info(
          `♻️ Queue: ${mutation.id} conflicted, re-sending without the captured version`,
        );
        return await this.processMutation({
          ...mutation,
          variables,
          conflictCount,
        });
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
    // resets so that drain gets a fresh attempt. The only lifetime bound is
    // `queueStore.expireStalePending`'s age horizon.
    if (queueError.type === 'network' || queueError.type === 'server') {
      // DEADLOCK is the one deferral the API scopes to the row; every other
      // network/server verdict is the API's own state, which pauses the drain.
      const deferralScope =
        queueError.code === ErrorCode.Deadlock ? 'entry' : 'transport';
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
        deferralScope,
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

  /** The entity a queued write creates or changes: the failure handler's evict target. */
  private getEntityId(mutation: QueuedMutation): string | null {
    return queuedSubject(mutation).subjectIds[0] ?? null;
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

  /** Every entity a queued write creates or changes — one per row of a batch. */
  private getAllEntityIds(mutation: QueuedMutation): string[] {
    return queuedSubject(mutation).subjectIds;
  }

  /**
   * What a write waits on: the parents it attaches to, top-level and per batch
   * row, and the entity it is derived from (a fork's source recipe).
   */
  private getDependencyIds(mutation: QueuedMutation): string[] {
    const ids = new Set<string>(queuedSubject(mutation).sourceIds);
    const collect = (record: unknown) => {
      if (!isRecord(record)) return;
      for (const key of PARENT_REFERENCE_KEYS) {
        const value = record[key];
        if (typeof value === 'string' && value) ids.add(value);
      }
    };
    const input: unknown = mutation.variables.input;
    collect(input);
    const items = isRecord(input) ? input.items : undefined;
    if (Array.isArray(items)) items.forEach(collect);
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
    const snapshot = requireApolloClient().cache.extract();
    return isRecord(snapshot) ? snapshot : {};
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

  private reportOverwrite(mutation: QueuedMutation): void {
    if (!this.overwriteReporter) return;
    const { entityType, entityId } = this.extractEntityInfo(mutation);
    try {
      this.overwriteReporter({
        mutationId: mutation.id,
        operationName: mutation.operationName,
        entityType,
        entityId,
      });
    } catch (reporterError) {
      logger.error('Queue: Overwrite reporter threw an error:', reporterError);
    }
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
        () =>
          reject(
            new TimeoutError(
              'Operation timed out',
              this.config.processingTimeoutMs,
            ),
          ),
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
   * Resolves once nothing is in flight and nothing is scheduled. It DRAINS
   * rather than observes: a scheduled drain has no `processingPromise`, so a
   * caller would read "idle" during `requestDrain`'s debounce and refetch a
   * server the queued writes have not reached, overwriting their rows.
   */
  async whenIdle(): Promise<void> {
    this.cancelPendingDrain();
    // No-ops when offline, empty or already draining — and when it is already
    // draining it hands back that same promise, which is what we want to await.
    await this.processQueue().catch(() => {});
    await this.processingPromise?.catch(() => {});
  }

  /**
   * A new access token for the signed-in user. A write parked for re-auth is
   * replayable again, and a restored or rotated session never signs in to say so.
   */
  onSessionToken(userId: string): void {
    if (queueStore.revivePendingAuthErrors(userId) > 0) this.requestDrain();
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
        this.processQueue().catch(error => {
          logger.error('Failed to process queue on user change:', error);
        });
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
  // The store is write-through over an in-RAM mirror. Dropping the mirror keeps
  // it from outliving the blob and answering the next session from memory.
  queueStore.invalidateCache();
});
