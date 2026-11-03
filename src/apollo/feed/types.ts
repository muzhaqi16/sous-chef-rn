import type { ApolloCache, ApolloClient } from '@apollo/client';
import type { CacheShards } from '#/apollo/offline/ApolloCachePersistence';
import type {
  SyncPageStatus,
  SyncScopeKind,
} from '#/graphql/generated/schemaTypes';

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
  /** Reads what the page leaves out, once applied, before the pass moves on. */
  afterApply?(): Promise<void>;
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
  readonly kind: SyncScopeKind;
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
  /** Whether a restart brought back the rows a stored position claims. */
  holdsStoredRows(cache: ApolloCache, scopeId: string): boolean;
  /** The kind's rows kept apart from what loads at launch, if any. */
  readonly storage?: CacheShards;
  /**
   * The stored scopes holding the rows these ids name, which a queued write's
   * layer needs in memory; null when one of them cannot be placed. A kind that
   * stores nothing apart from what loads at launch leaves it out.
   */
  scopesNamedBy?(cache: ApolloCache, ids: readonly string[]): string[] | null;
}
