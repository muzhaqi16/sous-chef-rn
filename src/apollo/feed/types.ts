import type { ApolloCache, ApolloClient } from '@apollo/client';
import type { SyncPageStatus } from '#/graphql/generated/schemaTypes';

export interface FeedScopeCursor {
  id: string;
  /** Null when no position is held, which a pull answers `RESYNC_REQUIRED`. */
  cursor: string | null;
}

/** One of this device's writes that reached a row. */
export interface FeedApplied {
  operationId: string;
  entityType: string;
  entityId: string;
  version: number | null;
}

/** A scope's page. Its rows are in the cache when the engine sees it. */
export interface FeedPage {
  scopeId: string;
  status: SyncPageStatus;
  cursor: string | null;
  hasMore: boolean;
  applied: readonly FeedApplied[];
  /** Places the rows in every view of the scope, and takes out the removed. */
  apply(cache: ApolloCache): void;
}

/** A scope read in full. `cursor` is the first page's, taken before any row. */
export interface FeedSnapshot {
  status: SyncPageStatus;
  cursor: string | null;
  /** Makes the scope's server rows exactly these. */
  replace(cache: ApolloCache): void;
}

export type FeedAnswer<T> =
  | { data: T; error?: undefined }
  | { data?: undefined; error: unknown };

/** What one scope kind supplies; a kind with none is ignored. */
export interface FeedAdapter {
  /** A string: a newer server can name a kind this build's enum does not hold. */
  readonly kind: string;
  pull(
    client: ApolloClient,
    scopes: readonly FeedScopeCursor[],
  ): Promise<FeedAnswer<readonly FeedPage[]>>;
  snapshot(
    client: ApolloClient,
    scopeId: string,
  ): Promise<FeedAnswer<FeedSnapshot>>;
  /** Removes the scope's rows from the device, a stored copy included. */
  evict(cache: ApolloCache, scopeId: string): void;
  /** A create the server has not taken, whose rows a pull would race. */
  holdsUnacknowledgedCreate(scopeId: string): boolean;
  /** The scope on screen, which reads in full ahead of the rest. */
  isOnScreen(scopeId: string): boolean;
}
