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
import { classifyError, calculateRetryDelay } from './queueErrorPolicy';
import { logger } from '#/utils/environment';

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
 * Operations that create a PARENT entity other queued mutations may depend on.
 * A shopping list created offline can have items added to it (still offline)
 * whose variables reference its client-minted id. Entity grouping can't see
 * that dependency — the list create keys on the list id while each item add
 * keys on its own item id — so a batch containing one of these is processed
 * strictly in FIFO order instead of concurrently (insertion order is causal
 * order: the user can't act on an entity before creating it).
 */
const PARENT_CREATE_OPERATIONS = [
  'CreateShoppingList',
  'CreateMealPlan',
  'CreateRecipe',
  'CreatePantry',
];

/**
 * Default configuration for the queue manager
 */
const DEFAULT_CONFIG: QueueConfig = {
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelayMs: 1000,
  processingTimeoutMs: 30000,
  batchSize: 5,
  enablePersistence: true,
};

/**
 * Queue Manager - Processes offline mutations with auth-aware logic
 *
 * Features:
 * - User-scoped queue processing
 * - Token validation and refresh before replay
 * - Retry logic with exponential backoff
 * - Auth error handling
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
   * Merge multiple move mutations for the same item
   * Keeps only the latest move per item to prevent conflicts
   */
  private mergeMoveItemMutations(mutations: QueuedMutation[]): {
    merged: QueuedMutation[];
    removed: string[];
  } {
    const moveMutations = new Map<string, QueuedMutation>();
    const otherMutations: QueuedMutation[] = [];
    const removedIds: string[] = [];

    mutations.forEach(mutation => {
      if (mutation.operationName === 'MoveShoppingListItem') {
        const itemId = mutation.variables?.input?.itemId;

        if (itemId) {
          // If we already have a move for this item, mark the old one for removal
          const existing = moveMutations.get(itemId);
          if (existing) {
            removedIds.push(existing.id);
            logger.info(
              `🔄 Queue: Merging move mutation ${existing.id} into ${mutation.id} for item ${itemId}`,
            );
          }

          // Keep only the latest move for each item
          moveMutations.set(itemId, mutation);
        } else {
          // No itemId found, keep mutation as-is
          otherMutations.push(mutation);
        }
      } else if (mutation.operationName === 'ReorderShoppingListItems') {
        // Legacy mutation - keep for backward compatibility during migration
        const listId = mutation.variables?.input?.shoppingListId;
        if (listId) {
          logger.info(
            `⚠️ Queue: Found legacy ReorderShoppingListItems mutation ${mutation.id} - consider migrating to MoveShoppingListItem`,
          );
        }
        otherMutations.push(mutation);
      } else {
        otherMutations.push(mutation);
      }
    });

    return {
      merged: [...otherMutations, ...Array.from(moveMutations.values())],
      removed: removedIds,
    };
  }

  /**
   * Internal queue processing logic
   */
  private async _processQueueInternal(userId: string): Promise<void> {
    // Validate token before processing
    const hasValidToken = await this.validateTokenBeforeReplay();
    if (!hasValidToken) {
      logger.error('❌ Queue: Token validation failed, cannot process');
      return;
    }

    // Get pending mutations for user
    const mutations = queueStore.getPendingMutationsForUser(userId);

    if (mutations.length === 0) {
      logger.info('✅ Queue: No pending mutations');
      return;
    }

    logger.info(`📊 Queue: Found ${mutations.length} pending mutations`);

    // Merge multiple move mutations for the same item
    const { merged: mergedMutations, removed: removedIds } =
      this.mergeMoveItemMutations(mutations);

    // Remove merged mutations from queue
    removedIds.forEach(id => {
      queueStore.removeMutation(id);
    });

    if (removedIds.length > 0) {
      logger.info(
        `🔄 Queue: Merged ${removedIds.length} duplicate move mutations, processing ${mergedMutations.length} mutations`,
      );
    }

    // Process mutations in batches (use merged mutations)
    const batches = this.createBatches(mergedMutations, this.config.batchSize);

    for (const batch of batches) {
      // Check the server is still reachable before each batch
      const state = useStore.getState();
      if (isApiUnavailable(state)) {
        logger.info('📴 Queue: Server became unreachable, pausing');
        break;
      }

      // A parent-entity create (an offline-created shopping list) may have
      // dependents queued behind it (items added to it while offline) that
      // entity grouping can't chain — replay the whole batch in FIFO order so
      // the create lands before anything referencing its id.
      const hasParentCreate = batch.some(mutation =>
        PARENT_CREATE_OPERATIONS.includes(mutation.operationName),
      );

      // Group mutations by entity ID to process same-entity operations sequentially
      // This prevents race conditions like create-then-update on the same entity
      const { independent, entityGroups } = hasParentCreate
        ? { independent: [], entityGroups: [batch] }
        : this.groupByEntity(batch);

      // Process independent mutations (different entities) concurrently
      const independentResults = await Promise.allSettled(
        independent.map(mutation => this.processMutation(mutation)),
      );

      // Process same-entity groups sequentially
      const sequentialResults: PromiseSettledResult<ProcessingResult>[] = [];
      for (const group of entityGroups) {
        for (const mutation of group) {
          try {
            const result = await this.processMutation(mutation);
            sequentialResults.push({ status: 'fulfilled', value: result });
          } catch (error) {
            sequentialResults.push({ status: 'rejected', reason: error });
          }
        }
      }

      const results = [...independentResults, ...sequentialResults];

      // Log batch results - check actual mutation success, not promise resolution
      const succeeded = results.filter(
        r => r.status === 'fulfilled' && r.value.success,
      ).length;
      const failed = results.filter(
        r =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success),
      ).length;
      logger.info(
        `📦 Queue: Batch complete - ${succeeded} succeeded, ${failed} failed`,
      );
    }

    // Cleanup old successful mutations
    queueStore.cleanupSuccessful();

    logger.info('✅ Queue: Processing complete');
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
      const result = await Promise.race([
        this.executeMutation(mutation),
        this.timeout(this.config.processingTimeoutMs),
      ]);

      // Success - remove from queue
      queueStore.updateMutation(mutationId, {
        status: QueueStatus.SUCCESS,
        processedAt: Date.now(),
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
    const { syncMutation, syncVariables } = convertToSyncMutation(mutation, {
      readPantryId: clientId => this.readPantryId(clientId),
      readShoppingListId: clientId => this.readShoppingListId(clientId),
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
    const syncResult = Object.values(result.data || {})[0] as
      | { conflict?: { message?: string } }
      | undefined;

    // Server wins on conflict — the server's version already rides back in the
    // response; just surface it for diagnostics.
    if (syncResult?.conflict) {
      logger.warn(
        `⚠️ Queue: Conflict detected for ${mutation.operationName}:`,
        syncResult.conflict.message,
      );
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

    // Handle auth errors specially
    if (queueError.type === 'auth') {
      return await this.handleAuthError(mutation, queueError);
    }

    // Handle retryable errors
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
        mutationId: mutation.id,
        error: queueError,
      };
    }

    // Non-retryable (validation / client / 4xx / GraphQL) error → permanent
    // failure: mark failed and notify so the optimistic change can be reverted.
    queueStore.markMutationFailed(mutation.id, queueError);
    this.invokeFailureHandler(mutation, queueError);

    return {
      success: false,
      mutationId: mutation.id,
      error: queueError,
    };
  }

  /**
   * Handle authentication errors
   */
  private async handleAuthError(
    mutation: QueuedMutation,
    error: QueueError,
  ): Promise<ProcessingResult> {
    logger.info(
      `🔐 Queue: Auth error for ${mutation.id}, attempting token refresh`,
    );

    // Try token refresh one more time
    const refreshed = await this.validateTokenBeforeReplay();

    if (refreshed) {
      logger.info(`✅ Queue: Token refreshed, retrying ${mutation.id}`);
      // Retry mutation with fresh token
      return await this.processMutation(mutation);
    }

    // Token refresh failed - mark as auth error
    logger.error(`❌ Queue: Token refresh failed for ${mutation.id}`);
    const authError: QueueError = { ...error, type: 'auth' };
    queueStore.markMutationFailed(mutation.id, authError);
    this.invokeFailureHandler(mutation, authError);

    return {
      success: false,
      mutationId: mutation.id,
      error,
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
      const { proactiveTokenRefresh } = await import('../links/refreshToken');
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
   * `itemId`, recipe/meal/batch inputs, or a sync `clientId`. One source of truth
   * so replay ordering (`groupByEntity`) and failure reporting
   * (`extractEntityInfo`) always agree on which entity a mutation belongs to.
   */
  private getEntityId(mutation: QueuedMutation): string | null {
    const vars = mutation.variables ?? {};
    return (
      vars.id ??
      vars.input?.id ??
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
   * Extract entity type and ID from a mutation's variables.
   * Inspects common variable patterns used across the app.
   */
  private extractEntityInfo(mutation: QueuedMutation): {
    entityType: string | null;
    entityId: string | null;
  } {
    const opName = mutation.operationName;

    const entityId = this.getEntityId(mutation);

    // Infer entity type from operation name
    let entityType: string | null = null;
    if (opName.includes('PantryItemBatch')) entityType = 'PantryItemBatch';
    else if (opName.includes('PantryItem') || opName.includes('Pantry'))
      entityType = 'PantryItem';
    else if (
      opName.includes('ShoppingListItem') ||
      opName.includes('ShoppingList')
    )
      entityType = 'ShoppingListItem';
    else if (opName.includes('MealPlanItem')) entityType = 'MealPlanItem';
    else if (opName.includes('MealPlan')) entityType = 'MealPlan';
    else if (opName.includes('Recipe') || opName.includes('Favorite'))
      entityType = 'SavedRecipe';

    return { entityType, entityId };
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
   * Group mutations by entity ID for safe ordering.
   * Same-entity mutations must be processed sequentially to prevent race conditions
   * (e.g., create followed by update on the same entity id).
   * Mutations targeting different entities can run concurrently.
   */
  private groupByEntity(mutations: QueuedMutation[]): {
    independent: QueuedMutation[];
    entityGroups: QueuedMutation[][];
  } {
    const entityMap = new Map<string, QueuedMutation[]>();

    for (const mutation of mutations) {
      const entityId = this.getEntityId(mutation);

      if (entityId) {
        const group = entityMap.get(entityId) || [];
        group.push(mutation);
        entityMap.set(entityId, group);
      } else {
        // No entity ID identifiable — treat as independent
        const key = `__no_entity_${mutation.id}`;
        entityMap.set(key, [mutation]);
      }
    }

    const independent: QueuedMutation[] = [];
    const entityGroups: QueuedMutation[][] = [];

    for (const group of entityMap.values()) {
      if (group.length === 1) {
        independent.push(group[0]);
      } else {
        entityGroups.push(group);
      }
    }

    return { independent, entityGroups };
  }

  /**
   * Create batches from mutations
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Timeout promise helper
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), ms),
    );
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
