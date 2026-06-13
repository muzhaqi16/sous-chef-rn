/**
 * SubscriptionService - Centralized Subscription Management
 *
 * A singleton service that provides unified subscription handling across
 * the entire application. Eliminates code duplication and provides consistent
 * patterns for deduplication, cache updates, error handling, and logging.
 *
 * @example
 * ```typescript
 * const service = SubscriptionService.getInstance();
 *
 * const handlers = service.register({
 *   subscriptionName: 'ShoppingListItemsChanged',
 *   entityType: 'ShoppingListItem',
 *   enableDeduplication: true,
 *   userId: user?.id,
 *   cacheUpdateStrategy: CacheStrategy.AUTOMATIC,
 *   cacheFieldName: 'shoppingListItems',
 * });
 *
 * useShoppingListItemsChangedSubscription({
 *   variables: { listId },
 *   skip: !listId,
 *   ...handlers,
 * });
 * ```
 */

import type {
  ApolloCache,
  ErrorLike,
  Reference,
  StoreObject,
} from '@apollo/client';
import type { NormalizedCacheObject } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import {
  SubscriptionConfig,
  SubscriptionHandlers,
  SubscriptionPayload,
  SubscriptionEntry,
  SubscriptionStats,
  CacheStrategy,
  LogLevel,
} from './types';
import { MutationType } from '#/graphql/generated/schemaTypes';
import {
  serializeError,
  isCircularStructureError,
  isTimerCircularStructureError,
} from '#/utils/errorSerialization';
import { safeEvict, type ConnectionData } from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';

/**
 * Entity shape extracted from a subscription payload's `item`/`node`.
 * Extends `StoreObject` so it can be passed to `toReference`, while
 * surfacing the `id` the service reads for cache identification.
 */
type PayloadEntity = StoreObject & { id?: string };

export class SubscriptionService {
  private static instance: SubscriptionService;

  // Active subscription registry
  private subscriptions = new Map<string, SubscriptionEntry>();

  // Deduplication tracking
  private processedMutations = new Set<string>();
  private readonly MAX_PROCESSED_MUTATIONS = 100;

  // Recent reorder tracking (for ignoring subscription echoes)
  private recentReorders = new Map<string, number>(); // itemId -> timestamp

  // Pending delete tracking (to handle subscription race conditions)
  // When we optimistically delete an item, Apollo's auto-normalization may re-add it
  // from the subscription payload. We track pending deletes to re-evict if needed.
  private pendingDeletes = new Map<
    string,
    {
      parentId: string;
      entityType: string;
      parentTypename: string;
      connectionField: string;
    }
  >();

  // Pending parent entity deletes (shopping lists, pantries)
  // When deleting a parent entity, subscriptions may still be active and receiving
  // messages. We track pending parent deletes to skip subscription processing.
  private pendingParentDeletes = new Set<string>();

  // Statistics
  private stats = {
    totalUpdates: 0,
    totalErrors: 0,
    dedupedUpdates: 0,
    filteredSortOrderUpdates: 0,
  };

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Register a pending delete to handle subscription race conditions.
   * When we optimistically delete an item, the subscription may arrive with
   * the deleted item's data, causing Apollo to re-add it via auto-normalization.
   * By tracking pending deletes, we can re-evict the item if this happens.
   *
   * @param itemId - The ID of the item being deleted
   * @param parentId - The parent entity ID (e.g., pantryId)
   * @param entityType - The GraphQL typename (e.g., 'PantryItem')
   * @param parentTypename - The parent entity typename (e.g., 'Pantry')
   * @param connectionField - The Connection field name (e.g., 'itemsConnection')
   */
  registerPendingDelete(
    itemId: string,
    parentId: string,
    entityType: string,
    parentTypename: string = 'Pantry',
    connectionField: string = 'itemsConnection',
  ): void {
    this.pendingDeletes.set(itemId, {
      parentId,
      entityType,
      parentTypename,
      connectionField,
    });
    // Auto-cleanup after 30s to prevent memory leaks in edge cases
    setTimeout(() => this.pendingDeletes.delete(itemId), 30000);
  }

  /**
   * Unregister a pending delete (called after mutation completes)
   */
  unregisterPendingDelete(itemId: string): void {
    this.pendingDeletes.delete(itemId);
  }

  /**
   * Check if an item is pending deletion.
   * Use this to filter out items that are being deleted but may have been
   * temporarily re-added to cache by Apollo's auto-normalization.
   */
  isPendingDelete(itemId: string): boolean {
    return this.pendingDeletes.has(itemId);
  }

  /**
   * Register that a parent entity (shopping list, pantry) is being deleted.
   * Subscriptions for this entity will be skipped during the deletion process.
   *
   * @param entityId - The ID of the entity being deleted
   */
  registerParentDeletion(entityId: string): void {
    this.pendingParentDeletes.add(entityId);
    // Auto-cleanup after 10s to prevent memory leaks
    setTimeout(() => this.pendingParentDeletes.delete(entityId), 10000);
  }

  /**
   * Unregister a parent entity deletion (called after navigation completes)
   */
  unregisterParentDeletion(entityId: string): void {
    this.pendingParentDeletes.delete(entityId);
  }

  /**
   * Check if a parent entity is currently being deleted
   */
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

  /**
   * Register a subscription and get configured handlers
   *
   * This is the main entry point for using the service. It returns handlers
   * that can be spread directly into Apollo subscription hooks.
   *
   * @param config - Subscription configuration
   * @returns Configured handlers (onData, onError, onComplete)
   */
  register<TData = unknown>(
    config: SubscriptionConfig<TData>,
  ): SubscriptionHandlers {
    // Set defaults - use Partial for optional fields
    const finalConfig = {
      subscriptionName: config.subscriptionName,
      entityType: config.entityType,
      mutation: config.mutation || MutationType.Updated,
      enableDeduplication: config.enableDeduplication ?? true,
      userId: config.userId,
      cacheUpdateStrategy:
        config.cacheUpdateStrategy || CacheStrategy.AUTOMATIC,
      cacheFieldName: config.cacheFieldName || '',
      customOnData: config.customOnData,
      customOnError: config.customOnError,
      customOnComplete: config.customOnComplete,
      enableLogging: config.enableLogging ?? __DEV__,
      logLevel: config.logLevel || LogLevel.INFO,
      entityId: config.entityId,
    };

    // Register subscription in tracking registry
    const key = this.getSubscriptionKey(finalConfig);
    this.subscriptions.set(key, {
      subscriptionName: finalConfig.subscriptionName,
      entityType: finalConfig.entityType,
      entityId: finalConfig.entityId,
      userId: finalConfig.userId,
      connectedAt: new Date(),
      updateCount: 0,
      errorCount: 0,
    });

    return {
      onData: this.createOnDataHandler(finalConfig),
      onError: this.createOnErrorHandler(finalConfig),
      onComplete: this.createOnCompleteHandler(finalConfig),
    };
  }

  /**
   * Create unified onData handler
   */
  private createOnDataHandler<TData>(
    config: SubscriptionConfig<TData>,
  ): SubscriptionHandlers['onData'] {
    return ({ data, client }) => {
      try {
        // Skip processing if parent entity is being deleted
        if (config.entityId && this.pendingParentDeletes.has(config.entityId)) {
          this.log(
            config,
            LogLevel.DEBUG,
            'Skipping update for entity being deleted',
            {
              entityId: config.entityId,
            },
          );
          return;
        }

        // Extract payload from subscription data
        const subscriptionData = data?.data;
        if (!subscriptionData) {
          this.log(
            config,
            LogLevel.WARN,
            'No subscription data received',
            data,
          );
          return;
        }

        // Get the actual payload (first property of subscription data)
        const payload = Object.values(
          subscriptionData,
        )[0] as SubscriptionPayload<TData>;

        if (!payload) {
          this.log(
            config,
            LogLevel.WARN,
            'Empty subscription payload',
            subscriptionData,
          );
          return;
        }

        // Step 1: Deduplication check
        if (
          config.enableDeduplication &&
          !this.shouldProcessUpdate(payload, config)
        ) {
          this.stats.dedupedUpdates++;
          this.log(
            config,
            LogLevel.DEBUG,
            'Filtered duplicate/self-echo update',
            {
              userId: payload.userId,
              mutation: payload.mutation,
            },
          );
          return;
        }

        // Step 2: Update statistics
        this.stats.totalUpdates++;
        this.updateSubscriptionStats(config, 'update');

        // Step 3: Log subscription update
        const item = this.getPayloadEntity(payload);

        this.log(config, LogLevel.INFO, 'Subscription update received', {
          mutation: payload.mutation,
          userId: payload.userId,
          timestamp: payload.timestamp,
          entityId: item?.id,
        });

        // Step 4: Update cache based on strategy
        if (config.cacheUpdateStrategy !== CacheStrategy.NONE) {
          // For AUTOMATIC: Apollo normalization handles UPDATE, but we need to manually handle CREATE/DELETE
          // For MANUAL: We handle all mutations manually
          const mutation = payload.mutation || config.mutation;
          const shouldUpdateCache =
            config.cacheUpdateStrategy === CacheStrategy.MANUAL ||
            // CREATE operations - add to arrays
            mutation === MutationType.Created ||
            mutation === MutationType.ItemAdded ||
            mutation === MutationType.CollaboratorAdded ||
            // DELETE operations - remove from arrays
            mutation === MutationType.Deleted ||
            mutation === MutationType.ItemRemoved ||
            mutation === MutationType.CollaboratorRemoved;

          if (shouldUpdateCache) {
            this.updateCache(client.cache, config, payload);
          } else {
            // UPDATE with AUTOMATIC - let Apollo normalization handle it
            this.log(
              config,
              LogLevel.DEBUG,
              'Using Apollo normalization for UPDATE',
              {
                mutation,
              },
            );
          }
        }
        // CacheStrategy.NONE - Skip all cache updates

        // Step 5: Call custom handler if provided
        if (config.customOnData && typeof config.customOnData === 'function') {
          config.customOnData(payload as TData, client);
        }
      } catch (error) {
        this.log(
          config,
          LogLevel.ERROR,
          'Error in onData handler',
          serializeError(error),
        );
      }
    };
  }

  /**
   * Create unified onError handler
   */
  private createOnErrorHandler<TData>(
    config: SubscriptionConfig<TData>,
  ): SubscriptionHandlers['onError'] {
    return (error: ErrorLike) => {
      // Check if this is a network-related error that will be auto-recovered
      const errorMessage = error?.message?.toLowerCase() || '';
      const isSocketClosed = errorMessage.includes('socket closed');
      const isNetworkError =
        errorMessage.includes('network') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('websocket');

      // Socket closed errors are expected during network transitions — debug
      // level: one WS drop interrupts EVERY active subscription at once, so a
      // warn here multiplies into a wall of identical lines per disconnect
      // (wsLink already warns once per socket event).
      if (isSocketClosed || isNetworkError) {
        this.log(config, LogLevel.DEBUG, 'WebSocket connection interrupted', {
          error: errorMessage,
          hint: 'WebSocket will attempt auto-reconnect if enabled',
        });
        return; // Don't count as error or call custom handler for expected disconnects
      }

      this.stats.totalErrors++;
      this.updateSubscriptionStats(config, 'error');

      this.log(
        config,
        LogLevel.ERROR,
        'Subscription error',
        serializeError(error),
      );

      // Call custom error handler if provided
      if (config.customOnError && typeof config.customOnError === 'function') {
        config.customOnError(error);
      }
    };
  }

  /**
   * Create unified onComplete handler
   * Also removes the subscription entry from the registry when the subscription ends
   */
  private createOnCompleteHandler<TData>(
    config: SubscriptionConfig<TData>,
  ): () => void {
    const key = this.getSubscriptionKey(config);
    return () => {
      this.log(config, LogLevel.INFO, 'Subscription completed', {
        entityId: config.entityId,
      });

      // Remove from registry when subscription completes to prevent memory leak
      this.subscriptions.delete(key);

      // Call custom complete handler if provided
      if (
        config.customOnComplete &&
        typeof config.customOnComplete === 'function'
      ) {
        config.customOnComplete();
      }
    };
  }

  /**
   * Mark an item as recently reordered to ignore subscription echoes
   * Call this after a successful drag-and-drop mutation
   */
  markItemReordered(itemId: string): void {
    this.recentReorders.set(itemId, Date.now());
    // Clean up after 200ms
    setTimeout(() => this.recentReorders.delete(itemId), 200);
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
   * Unified deduplication logic
   *
   * Filters out:
   * 1. Duplicate updates (same timestamp + mutation)
   * 2. SortOrder-only updates (handled optimistically)
   *
   * Note: Self-echo filtering (userId check) has been removed to support
   * multi-device scenarios where the same user may be on multiple devices.
   * For most use cases (family members on shared pantry/shopping lists),
   * different users will see each other's updates in real-time.
   */
  private shouldProcessUpdate<TData>(
    payload: SubscriptionPayload<TData>,
    config: SubscriptionConfig<TData>,
  ): boolean {
    if (!payload) return false;

    // Filter sortOrder-only updates (handled by optimistic mutations)
    if (this.isSortOrderOnlyUpdate(payload)) {
      const itemId =
        (payload.item as { id?: string } | undefined)?.id ||
        (payload.node as { id?: string } | undefined)?.id;

      // Check if we recently reordered this item
      if (itemId) {
        const reorderTime = this.recentReorders.get(itemId);
        const isRecentReorder = reorderTime && Date.now() - reorderTime < 200;

        if (isRecentReorder || this.recentReorders.size > 0) {
          this.stats.filteredSortOrderUpdates++;
          this.log(config, LogLevel.DEBUG, 'Filtered sortOrder-only update', {
            itemId,
            updatedFields: payload.updatedFields,
            recentReorder: isRecentReorder,
          });
          return false;
        }
      }
    }

    // Dedup key = mutation + subtype + node + tick. The server can emit distinct
    // events in one tick (LIST_UPDATED then STATUS_CHANGED, or two items), so
    // subtype + node keep them apart while true duplicates still collapse.
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

      // Add to processed set
      this.processedMutations.add(mutationKey);

      // Clean up old entries if set gets too large
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
   * Unified cache update strategy
   *
   * Handles:
   * - CREATE: Add item to array using cache.modify()
   * - UPDATE: Apollo automatic normalization (no action needed)
   * - DELETE: Remove item from array and evict from cache
   */
  private updateCache<TData>(
    cache: ApolloCache,
    config: SubscriptionConfig<TData>,
    payload: SubscriptionPayload<TData>,
  ): void {
    if (!config.cacheFieldName) {
      this.log(
        config,
        LogLevel.WARN,
        'No cacheFieldName provided for manual cache update',
      );
      return;
    }

    const item = this.getPayloadEntity(payload);
    const mutation = payload.mutation || config.mutation;
    const itemId = item?.id;

    if (!item || !itemId) {
      this.log(config, LogLevel.WARN, 'No item ID found in payload', payload);
      return;
    }

    try {
      switch (mutation) {
        case MutationType.Created:
        case MutationType.ItemAdded:
        case MutationType.CollaboratorAdded:
          // Add item to array field
          cache.modify({
            fields: {
              [config.cacheFieldName]: (
                existingItems: readonly Reference[] = [],
                { toReference, readField }: ModifierDetails,
              ) => {
                const newItemRef = toReference(item);
                if (!newItemRef) return existingItems;

                // Check if item already exists (prevent duplicates)
                const exists = existingItems.some(
                  (itemRef: Reference) => readField('id', itemRef) === itemId,
                );

                if (exists) {
                  this.log(
                    config,
                    LogLevel.DEBUG,
                    'Item already in cache, skipping add',
                    itemId,
                  );
                  return existingItems;
                }

                // Add to beginning of array (newest first)
                return [newItemRef, ...existingItems];
              },
            },
          });

          this.log(config, LogLevel.DEBUG, 'Added item to cache', itemId);
          break;

        case MutationType.Updated:
        case MutationType.ItemUpdated:
        case MutationType.StatusChanged:
        case MutationType.ItemCompleted:
        case MutationType.Completed:
          // Apollo automatic normalization handles this
          // The item data in the subscription will be merged into the cache automatically
          this.log(
            config,
            LogLevel.DEBUG,
            'Update handled by Apollo normalization',
            itemId,
          );
          break;

        case MutationType.Deleted:
        case MutationType.ItemRemoved:
        case MutationType.CollaboratorRemoved: {
          // Build cache ID for this item
          const cacheId = cache.identify({
            __typename: config.entityType,
            id: itemId,
          });

          // Check if this is a pending delete (self-triggered from our mutation)
          // Apollo's auto-normalization may have re-added the item from the subscription
          // payload, so we need to re-evict it AND ensure it's removed from the Connection
          const pendingDelete = this.pendingDeletes.get(itemId);
          if (pendingDelete) {
            this.log(
              config,
              LogLevel.DEBUG,
              'Re-evicting pending delete (counteract auto-normalization)',
              itemId,
            );

            // First, ensure the item is removed from the parent Connection
            // This prevents the race condition where auto-normalization writes the item
            // back and React renders before we evict
            try {
              const parentCacheId = cache.identify({
                __typename: pendingDelete.parentTypename,
                id: pendingDelete.parentId,
              });

              if (parentCacheId) {
                cache.modify({
                  id: parentCacheId,
                  fields: {
                    [pendingDelete.connectionField]: (
                      existingConnection: ConnectionData = {},
                      { readField }: ModifierDetails,
                    ) => {
                      const existingEdges = existingConnection?.edges || [];
                      const edges = existingEdges.filter(
                        edge => readField('id', edge?.node) !== itemId,
                      );

                      // If edges didn't change, no need to update
                      if (edges.length === existingEdges.length) {
                        return existingConnection;
                      }

                      return {
                        ...existingConnection,
                        edges,
                        totalCount: Math.max(
                          0,
                          (existingConnection?.totalCount || 0) - 1,
                        ),
                      };
                    },
                  },
                });
              }
            } catch (error) {
              this.log(
                config,
                LogLevel.WARN,
                'Failed to remove from parent Connection during pending delete',
                serializeError(error),
              );
            }

            // Then evict the item itself
            safeEvict(cache, config.entityType, itemId);
            this.pendingDeletes.delete(itemId);
            break;
          }

          // Check if item is already evicted (e.g., from a previous operation)
          const normalizedCache =
            cacheId && typeof cache.extract === 'function'
              ? (cache.extract() as NormalizedCacheObject)
              : undefined;
          const itemExists = cacheId ? normalizedCache?.[cacheId] : undefined;
          if (!itemExists) {
            this.log(
              config,
              LogLevel.DEBUG,
              'Item already evicted, skipping delete',
              itemId,
            );
            break;
          }

          // Normal delete processing for other users' deletes
          // Remove item from array field
          cache.modify({
            fields: {
              [config.cacheFieldName]: (
                existingItems: readonly Reference[] = [],
                { readField }: ModifierDetails,
              ) => {
                return existingItems.filter(
                  (itemRef: Reference) => readField('id', itemRef) !== itemId,
                );
              },
            },
          });

          // Evict item from cache
          safeEvict(cache, config.entityType, itemId);
          this.log(
            config,
            LogLevel.DEBUG,
            'Removed and evicted item from cache',
            itemId,
          );
          break;
        }

        default:
          this.log(config, LogLevel.WARN, 'Unknown mutation type', mutation);
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('❌ [CACHE UPDATE] Cache update failed:', {
          subscriptionName: config.subscriptionName,
          mutation,
          itemId,
          error: serializeError(error),
        });
      }
      this.log(
        config,
        LogLevel.ERROR,
        'Cache update failed',
        serializeError(error),
      );
    }
  }

  /**
   * Extract the entity (`item` or `node`) from a subscription payload.
   * Returns the entity as a `StoreObject` (so it can be passed to
   * `toReference`) carrying an optional `id`, or `undefined` when neither
   * field holds an object.
   */
  private getPayloadEntity<TData>(
    payload: SubscriptionPayload<TData>,
  ): PayloadEntity | undefined {
    const candidate = payload.item ?? payload.node;
    if (candidate && typeof candidate === 'object') {
      const entity = candidate as PayloadEntity;
      return entity;
    }
    return undefined;
  }

  /**
   * Unified logging
   */
  private log<TData>(
    config: SubscriptionConfig<TData>,
    level: LogLevel,
    message: string,
    data?: unknown,
  ): void {
    if (!config.enableLogging && level !== LogLevel.ERROR) {
      return;
    }

    // Silently skip timer-related circular structure errors
    // These are expected during subscription teardown/setup due to graphql-ws internals
    if (level === LogLevel.ERROR && isTimerCircularStructureError(data)) {
      return;
    }

    // Skip logs below configured level
    const logLevels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
    ];
    const configLogLevel = config.logLevel || LogLevel.INFO;
    if (logLevels.indexOf(level) < logLevels.indexOf(configLogLevel)) {
      return;
    }

    // Extract a `message` string from `data` when present (errors, payloads)
    const dataMessage =
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : undefined;

    // Check if this is a circular structure error - downgrade to warning
    const isCircular =
      level === LogLevel.ERROR &&
      Boolean(data) &&
      (isCircularStructureError(data) ||
        (dataMessage !== undefined && isCircularStructureError(dataMessage)));

    // Extract raw error message for visibility even when circular refs detected
    const rawErrorMessage =
      dataMessage !== undefined
        ? dataMessage
        : typeof data === 'string'
        ? data
        : 'Unknown error';

    const actualLevel = isCircular ? LogLevel.WARN : level;
    const actualMessage = isCircular
      ? `${message} (may have circular refs - raw: ${rawErrorMessage})`
      : message;

    // For circular errors, still log raw message but skip full data object to avoid serialization issues
    const actualData = isCircular ? '' : data || '';

    const emoji = {
      [LogLevel.DEBUG]: '🔍',
      [LogLevel.INFO]: '🔔',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
    }[actualLevel];

    const prefix = `${emoji} [${config.subscriptionName}]`;

    switch (actualLevel) {
      case LogLevel.ERROR:
        logger.error(prefix, actualMessage, actualData);
        break;
      case LogLevel.WARN:
        logger.warn(prefix, actualMessage, actualData);
        break;
      case LogLevel.DEBUG:
      case LogLevel.INFO:
      default:
        logger.debug(prefix, actualMessage, actualData);
    }
  }

  /**
   * Update subscription statistics
   */
  private updateSubscriptionStats<TData>(
    config: SubscriptionConfig<TData>,
    type: 'update' | 'error',
  ): void {
    const key = this.getSubscriptionKey(config);
    const entry = this.subscriptions.get(key);

    if (entry) {
      if (type === 'update') {
        entry.updateCount++;
        entry.lastUpdate = new Date();
      } else if (type === 'error') {
        entry.errorCount++;
      }
    }
  }

  /**
   * Generate unique subscription key
   */
  private getSubscriptionKey<TData>(config: SubscriptionConfig<TData>): string {
    return `${config.subscriptionName}-${config.entityId || 'default'}-${
      config.userId || 'anonymous'
    }`;
  }

  /**
   * Get subscription statistics
   */
  getStats(): SubscriptionStats {
    return {
      totalSubscriptions: this.subscriptions.size,
      activeSubscriptions: Array.from(this.subscriptions.values()),
      totalUpdates: this.stats.totalUpdates,
      totalErrors: this.stats.totalErrors,
      dedupedUpdates: this.stats.dedupedUpdates,
    };
  }

  /**
   * Cleanup all subscriptions
   * Should be called on logout
   */
  cleanup(): void {
    this.subscriptions.clear();
    this.processedMutations.clear();
    this.recentReorders.clear();
    this.pendingDeletes.clear();
    this.pendingParentDeletes.clear();
    this.stats = {
      totalUpdates: 0,
      totalErrors: 0,
      dedupedUpdates: 0,
      filteredSortOrderUpdates: 0,
    };
  }

  /**
   * Get list of active subscription names (for debugging)
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.values()).map(
      sub => sub.subscriptionName,
    );
  }
}

// Export singleton instance
export const subscriptionService = SubscriptionService.getInstance();
