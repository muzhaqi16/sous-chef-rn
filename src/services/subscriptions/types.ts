/** Types for the configuration-driven subscription service. */

import type { ApolloClient, ErrorLike } from '@apollo/client';
import type { useSubscription } from '@apollo/client/react';
import { type MutationType } from '#/graphql/generated/schemaTypes';

/** Apollo Client 4 dropped the cache-shape generic; the cache type is inferred. */
export type SubscriptionApolloClient = ApolloClient;

export enum CacheStrategy {
  /** Apollo normalizes the payload; for UPDATEs carrying full fragment data. */
  AUTOMATIC = 'automatic',
  /** `cache.modify()`; for CREATE/DELETE on arrays. */
  MANUAL = 'manual',
  /** No cache write; for events that need no persistence. */
  NONE = 'none',
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface SubscriptionPayload<T = unknown> {
  mutation?: MutationType | string;
  userId?: string;
  timestamp?: string;
  item?: T;
  node?: T;
  previousValues?: Partial<T>;
  updatedFields?: string[];
  /** Subtype on consolidated event streams (PantryEvents, MyShoppingListsEvents);
   *  part of the dedup key so distinct same-tick events aren't collapsed. */
  subtype?: string;
}

export interface SubscriptionConfig<TData = unknown> {
  /** Unique name for logging (e.g. 'MyShoppingListsEvents'). */
  subscriptionName: string;

  /** GraphQL typename; required for cache.modify() and cache.evict(). */
  entityType: string;

  /** Default mutation type; `payload.mutation` overrides it at runtime. */
  mutation?: MutationType;

  /** Filter self-echo and same timestamp+mutation duplicates. @default true */
  enableDeduplication?: boolean;

  /** Required when `enableDeduplication` is true. */
  userId?: string;

  /** @default CacheStrategy.AUTOMATIC */
  cacheUpdateStrategy?: CacheStrategy;

  /** Required for CacheStrategy.MANUAL on CREATE/DELETE. */
  cacheFieldName?: string;

  /**
   * Runs after dedup, cache update and logging. Pass a concrete `TData` at the
   * call site to get type checking inside the handler.
   */
  customOnData?: (data: TData, client: SubscriptionApolloClient) => void;

  customOnError?: (error: ErrorLike) => void;

  /** Called once the subscription connection is established. */
  customOnComplete?: () => void;

  /** @default true in development, false in production */
  enableLogging?: boolean;

  /** @default LogLevel.INFO */
  logLevel?: LogLevel;

  /** Additional logging context. */
  entityId?: string;
}

/**
 * Spread into `useSubscription(DOC, { ...handlers })`, so these match Apollo's
 * own handler types. `onData` takes the FULL result and the service extracts the
 * payload field generically, hence the open `Record<string, unknown>` shape.
 */
export interface SubscriptionHandlers {
  onData: (
    options: useSubscription.OnDataOptions<Record<string, unknown>>,
  ) => void;
  onError: (error: ErrorLike) => void;
  onComplete: () => void;
}

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

export interface SubscriptionStats {
  totalSubscriptions: number;
  activeSubscriptions: SubscriptionEntry[];
  totalUpdates: number;
  totalErrors: number;
  dedupedUpdates: number;
}
