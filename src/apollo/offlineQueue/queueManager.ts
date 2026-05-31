import { gql } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { client } from '../client';
import { useStore } from '#store';
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
import {
  SyncPantryItemDocument,
  SyncDeletePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  SyncShoppingListItemDocument,
  SyncDeleteShoppingListItemDocument,
  SyncMoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { generateId } from '#/utils/generateId';
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
  private idMapping = new Map<string, string>(); // temp-ID → real-ID
  private failureHandler: FailureHandler | null = null;

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

    // Check if online
    if (!state.isOnline) {
      logger.debug('📴 Queue: Offline, skipping processing');
      return;
    }

    const userId = state.user.id;
    logger.info(`🔄 Queue: Starting processing for user ${userId}`);

    this.isProcessing = true;
    this.idMapping.clear(); // Reset ID mappings for fresh processing session
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
      // Check if still online before each batch
      const state = useStore.getState();
      if (!state.isOnline) {
        logger.info('📴 Queue: Went offline during processing, pausing');
        break;
      }

      // Group mutations by entity ID to process same-entity operations sequentially
      // This prevents race conditions like create-then-update on the same entity
      const { independent, entityGroups } = this.groupByEntity(batch);

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
   * Execute a mutation via Apollo Client
   * Uses sync mutations for offline-queued items to handle temp-IDs
   */
  private async executeMutation(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | undefined> {
    const useSyncMutation = this.shouldUseSync();

    if (useSyncMutation) {
      return await this.executeSyncMutation(mutation);
    }

    // Fallback to regular mutation (shouldn't happen for offline-queued items)
    const result = await client.mutate<Record<string, unknown>>({
      mutation: mutation.mutation,
      variables: mutation.variables,
      context: {
        ...mutation.context,
        skipQueueLink: true,
      },
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  /**
   * Execute sync mutation and handle ID mapping
   */
  private async executeSyncMutation(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | undefined> {
    const { syncMutation, syncVariables } =
      this.convertToSyncMutation(mutation);

    logger.info(`🔄 Queue: Using sync mutation for ${mutation.operationName}`);

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
    const syncResult = Object.values(result.data || {})[0] as {
      wasCreated?: boolean;
      serverId?: string;
      clientId?: string;
      conflict?: { message?: string };
    };

    // Handle ID mapping for creates
    if (syncResult.wasCreated && syncResult.serverId && syncResult.clientId) {
      this.idMapping.set(syncResult.clientId, syncResult.serverId);
      logger.info(
        `🔗 Queue: Mapped ${syncResult.clientId} → ${syncResult.serverId}`,
      );
    }

    // Handle conflicts
    if (syncResult.conflict) {
      logger.warn(
        `⚠️ Queue: Conflict detected for ${mutation.operationName}:`,
        syncResult.conflict.message,
      );
      // Server wins - return server's version (already in syncResult.item)
    }

    return result.data;
  }

  /**
   * Convert regular mutation to sync mutation
   */
  private convertToSyncMutation(mutation: QueuedMutation): {
    syncMutation: DocumentNode;
    syncVariables: Record<string, unknown>;
  } {
    const operationName = mutation.operationName;
    const variables = this.resolveIds(mutation.variables);

    // Determine clientId (temp-ID or real ID)
    const clientId =
      variables.id || variables.input?.id || `temp-${generateId()}`;

    // PantryItem sync mutations
    if (
      operationName === 'CreatePantryItem' ||
      operationName === 'UpdatePantryItem'
    ) {
      return {
        syncMutation: SyncPantryItemDocument,
        syncVariables: {
          clientId,
          input: variables.input,
        },
      };
    }

    if (operationName === 'DeletePantryItem') {
      return {
        syncMutation: SyncDeletePantryItemDocument,
        syncVariables: {
          clientId: variables.id,
          version: variables.version,
        },
      };
    }

    // ShoppingListItem sync mutations
    if (
      operationName === 'AddItemToShoppingList' ||
      operationName === 'UpdateShoppingListItem' ||
      operationName === 'UpdateShoppingListItemQuantity' ||
      operationName === 'ToggleShoppingListItemPurchased'
    ) {
      let input = variables.input;

      // For specialized mutations like UpdateShoppingListItemQuantity and ToggleShoppingListItemPurchased
      // that don't have input wrapper
      if (!input) {
        // Read item from cache to get shoppingListId (required by sync mutation)
        const itemId = variables.id;
        const itemData = client.cache.readFragment({
          id: client.cache.identify({
            __typename: 'ShoppingListItem',
            id: itemId,
          }),
          fragment: QUEUE_ITEM_DATA_FRAGMENT,
        }) as { id: string; shoppingList: { id: string } } | null;

        if (!itemData?.shoppingList?.id) {
          throw new Error(
            `Cannot sync ${operationName}: shoppingListId not found in cache for item ${itemId}`,
          );
        }

        // Construct input based on mutation type
        if (operationName === 'UpdateShoppingListItemQuantity') {
          input = {
            shoppingListId: itemData.shoppingList.id,
            quantity: variables.quantity,
            version: variables.version,
          };
        } else if (operationName === 'ToggleShoppingListItemPurchased') {
          input = {
            shoppingListId: itemData.shoppingList.id,
            isPurchased: variables.purchased,
            version: variables.version,
          };
        }
      }

      return {
        syncMutation: SyncShoppingListItemDocument,
        syncVariables: {
          clientId,
          input,
        },
      };
    }

    if (operationName === 'RemoveItemFromShoppingList') {
      return {
        syncMutation: SyncDeleteShoppingListItemDocument,
        syncVariables: {
          clientId: variables.id,
          version: variables.version,
        },
      };
    }

    if (operationName === 'MoveShoppingListItem') {
      return {
        syncMutation: SyncMoveShoppingListItemDocument,
        syncVariables: {
          clientId: variables.input?.itemId,
          afterId: variables.input?.afterId,
          beforeId: variables.input?.beforeId,
          version: variables.input?.version,
        },
      };
    }

    // Fallback: For mutations without Sync versions, replay the original mutation
    // This allows all queued mutations to be replayed when coming back online
    logger.info(
      `ℹ️ Queue: No sync mutation for ${operationName}, using original mutation`,
    );
    return {
      syncMutation: mutation.mutation,
      syncVariables: variables,
    };
  }

  /**
   * Resolve temp-IDs to real IDs in variables
   */
  private resolveIds<T>(variables: T): T {
    if (!variables) return variables;

    const resolved = JSON.parse(JSON.stringify(variables)); // Deep clone

    // Recursively replace temp-IDs with real IDs
    const replaceIds = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(replaceIds);
      }

      const record = obj as Record<string, unknown>;
      for (const [key, value] of Object.entries(record)) {
        if (
          (key === 'id' || key.endsWith('Id')) &&
          typeof value === 'string' &&
          value.startsWith('temp-')
        ) {
          const realId = this.idMapping.get(value);
          if (realId) {
            logger.info(`🔄 Queue: Resolved ${value} → ${realId}`);
            record[key] = realId;
          }
        } else if (typeof value === 'object') {
          record[key] = replaceIds(value);
        }
      }

      return record;
    };

    return replaceIds(resolved) as T;
  }

  /**
   * Determine if mutation should use sync endpoint
   */
  private shouldUseSync(): boolean {
    // Always use sync for offline-queued mutations
    // The sync mutations handle temp-IDs, version conflicts, and idempotency
    return true;
  }

  /**
   * Handle mutation execution error
   */
  private async handleMutationError(
    mutation: QueuedMutation,
    error: unknown,
  ): Promise<ProcessingResult> {
    const queueError = this.classifyError(error);

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
      const delay = this.calculateRetryDelay(mutation.retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry immediately if still online
      const state = useStore.getState();
      if (state.isOnline) {
        return await this.processMutation({
          ...mutation,
          retryCount: mutation.retryCount + 1,
        });
      }
    }

    // Max retries exceeded or non-retryable error
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
   * Extract entity type and ID from a mutation's variables.
   * Inspects common variable patterns used across the app.
   */
  private extractEntityInfo(mutation: QueuedMutation): {
    entityType: string | null;
    entityId: string | null;
  } {
    const vars = mutation.variables ?? {};
    const opName = mutation.operationName;

    // Extract entity ID from common variable shapes
    const entityId =
      vars.id ??
      vars.input?.id ??
      vars.input?.pantryItemId ??
      vars.input?.itemId ??
      vars.input?.recipeId ??
      vars.input?.mealPlanId ??
      vars.input?.batchId ??
      vars.clientId ??
      null;

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
   * Classify error type
   */
  private classifyError(error: unknown): QueueError {
    const err = (error ?? {}) as {
      message?: string;
      code?: string;
      extensions?: { code?: string };
      networkError?: { statusCode?: number };
    };
    const message = err.message || String(error);
    const code = err.extensions?.code || err.code;

    // Auth errors
    if (
      code === 'UNAUTHENTICATED' ||
      code === 'FORBIDDEN' ||
      message.toLowerCase().includes('expired') ||
      message.toLowerCase().includes('unauthorized')
    ) {
      return {
        type: 'auth',
        message,
        code,
        timestamp: Date.now(),
        retryable: true, // Can retry after token refresh
      };
    }

    // Network errors
    if (
      message.toLowerCase().includes('network') ||
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('econnrefused')
    ) {
      return {
        type: 'network',
        message,
        code,
        timestamp: Date.now(),
        retryable: true,
      };
    }

    // Server errors (5xx)
    if ((err.networkError?.statusCode ?? 0) >= 500) {
      return {
        type: 'server',
        message,
        code,
        timestamp: Date.now(),
        retryable: true,
      };
    }

    // Unknown/client errors (4xx, GraphQL errors)
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false, // Don't retry client errors
    };
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    const baseDelay = this.config.retryDelayMs;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 500; // Add jitter to prevent thundering herd
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  /**
   * Group mutations by entity ID for safe ordering.
   * Same-entity mutations must be processed sequentially to prevent race conditions
   * (e.g., create followed by update on the same temp-id entity).
   * Mutations targeting different entities can run concurrently.
   */
  private groupByEntity(mutations: QueuedMutation[]): {
    independent: QueuedMutation[];
    entityGroups: QueuedMutation[][];
  } {
    const entityMap = new Map<string, QueuedMutation[]>();

    for (const mutation of mutations) {
      const entityId =
        mutation.variables?.id ||
        mutation.variables?.input?.id ||
        mutation.variables?.clientId ||
        mutation.variables?.input?.pantryItemId ||
        mutation.variables?.input?.itemId ||
        mutation.variables?.itemId;

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
