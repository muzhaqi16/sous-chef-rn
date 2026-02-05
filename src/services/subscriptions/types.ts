/**
 * Subscription Service Type Definitions
 *
 * Centralized type definitions for the unified subscription architecture.
 * These types support configuration-driven subscription management across
 * all domains (shopping lists, pantry, home, notifications).
 */

import { type MutationType } from '#/graphql/generated/types';

/**
 * Cache update strategies for handling subscription data
 */
export enum CacheStrategy {
  /**
   * Let Apollo handle cache updates automatically via normalization
   * Best for: UPDATE operations with full fragment data
   */
  AUTOMATIC = 'automatic',

  /**
   * Manually update cache using cache.modify()
   * Best for: CREATE/DELETE operations on arrays
   */
  MANUAL = 'manual',

  /**
   * Don't update cache at all
   * Best for: Notifications or events that don't need cache persistence
   */
  NONE = 'none',
}

/**
 * Log levels for subscription events
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Standard subscription payload structure
 * Most subscriptions follow this pattern
 */
export interface SubscriptionPayload<T = any> {
  mutation?: MutationType | string;
  userId?: string;
  timestamp?: string;
  item?: T;
  node?: T;
  previousValues?: Partial<T>;
  updatedFields?: string[];
}

/**
 * Configuration for registering a subscription with the service
 */
export interface SubscriptionConfig<TData = any> {
  /**
   * Unique name for this subscription (e.g., 'ShoppingListItemsChanged')
   * Used for logging and debugging
   */
  subscriptionName: string;

  /**
   * GraphQL typename for cache operations (e.g., 'ShoppingListItem')
   * Required for cache.modify() and cache.evict()
   */
  entityType: string;

  /**
   * Primary mutation type this subscription handles
   * Can be overridden by payload.mutation at runtime
   */
  mutation?: MutationType;

  /**
   * Enable deduplication filtering
   * - Filters self-echo (updates from current user)
   * - Filters duplicate updates (same timestamp + mutation)
   * @default true
   */
  enableDeduplication?: boolean;

  /**
   * Current user ID for self-echo filtering
   * Required if enableDeduplication is true
   */
  userId?: string;

  /**
   * Strategy for updating Apollo cache
   * @default CacheStrategy.AUTOMATIC
   */
  cacheUpdateStrategy?: CacheStrategy;

  /**
   * Cache field name for array updates (e.g., 'shoppingListItems')
   * Required for CacheStrategy.MANUAL with CREATE/DELETE operations
   */
  cacheFieldName?: string;

  /**
   * Custom onData handler for additional logic
   * Called after standard processing (deduplication, cache update, logging)
   */
  customOnData?: (data: TData, client?: any) => void;

  /**
   * Custom onError handler
   * If not provided, uses standard error handling
   */
  customOnError?: (error: any) => void;

  /**
   * Custom onComplete handler
   * Called when subscription connection is established
   */
  customOnComplete?: () => void;

  /**
   * Enable logging for this subscription
   * @default true in development, false in production
   */
  enableLogging?: boolean;

  /**
   * Log level for this subscription
   * @default LogLevel.INFO
   */
  logLevel?: LogLevel;

  /**
   * Additional context for logging
   */
  entityId?: string;
}

/**
 * Return type from SubscriptionService.register()
 * Contains configured handlers ready to spread into Apollo subscription hooks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface SubscriptionHandlers<TData = any> {
  onData: (context: { data: any; client: any }) => void;
  onError: (error: any) => void;
  onComplete: () => void;
}

/**
 * Internal subscription registry entry
 * Tracks active subscriptions for lifecycle management
 */
export interface SubscriptionEntry {
  subscriptionName: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  connectedAt: Date;
  lastUpdate?: Date;
  updateCount: number;
  errorCount: number;
}

/**
 * Subscription statistics for monitoring
 */
export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: SubscriptionEntry[];
  totalUpdates: number;
  totalErrors: number;
  dedupedUpdates: number;
}
