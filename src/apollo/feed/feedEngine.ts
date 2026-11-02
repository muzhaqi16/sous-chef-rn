import type { ApolloCache, ApolloClient } from '@apollo/client';
import { requireApolloClient } from '#/apollo/clientRegistry';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { SyncPageStatus, SyncPokeKind } from '#/graphql/generated/schemaTypes';
import { getDeviceId } from '#/services/auth/deviceId';
import { Telemetry } from '#/services/telemetry';
import { registerSessionTeardown } from '#/store/sessionTeardown';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import type { FeedPokesSubscription } from './feed.generated';
import { FeedScopesDocument } from './feed.generated';
import {
  clearPositions,
  forgetPosition,
  heldScopes,
  holdPosition,
  positionOf,
} from './feedPositions';
import { FEED_ADAPTERS } from './feedRegistry';
import type { FeedAdapter, FeedPage } from './types';

/** The API refuses a pull naming more; `offlineLimits` states it once on production. */
const MAX_SCOPES_PER_PULL = 25;
const SCOPES_PAGE_SIZE = 100;
const RATE_LIMIT_FALLBACK_MS = 60_000;

type Poke = FeedPokesSubscription['mySyncPokes'];

const adapterFor = (kind: string): FeedAdapter | undefined =>
  FEED_ADAPTERS.find(adapter => adapter.kind === kind);

const readScopesPage = (client: ApolloClient, after: string | null) =>
  client.query({
    query: FeedScopesDocument,
    variables: { first: SCOPES_PAGE_SIZE, after },
    fetchPolicy: 'no-cache',
  });

/** Left behind, a page would pin its rows, and answer a read made offline. */
function forgetAnswers(cache: ApolloCache): void {
  cache.evict({ id: 'ROOT_QUERY', fieldName: 'syncChanges', broadcast: false });
  cache.evict({
    id: 'ROOT_QUERY',
    fieldName: 'syncSnapshot',
    broadcast: false,
  });
}

/**
 * Keeps held scopes current: reads what the person reaches, pulls what moved,
 * and reads in full what has no position. One pass at a time; what arrives
 * during one joins it, so a burst of signals costs one more pull.
 */
export class FeedEngine {
  private enabled = false;
  private draining = false;
  private scopesOwed = false;
  private readonly owed = new Map<string, string>();
  private notBefore = 0;
  private wakeTimer: ReturnType<typeof setTimeout> | undefined;
  private pass: Promise<void> = Promise.resolve();
  /** Moves on at each stop, so a pass outlived by its session writes nothing. */
  private session = 0;

  start(): void {
    this.enabled = true;
    this.catchUp();
  }

  stop(): void {
    this.enabled = false;
    this.session += 1;
    this.scopesOwed = false;
    this.owed.clear();
    this.notBefore = 0;
    clearTimeout(this.wakeTimer);
  }

  /** On a connection or a change of reach: re-reads what the person reaches. */
  catchUp(): void {
    if (!this.enabled) return;
    this.scopesOwed = true;
    this.drain();
  }

  receivePoke({ kind, scope, originDeviceId }: Poke): void {
    if (!this.enabled) return;
    if (kind === SyncPokeKind.ReachChanged) {
      this.catchUp();
      return;
    }
    if (!scope || !adapterFor(scope.kind)) return;
    if (positionOf(scope.id)?.cursor === scope.cursor) return;
    // The origin is null unless one write of this person's made the whole range.
    if (originDeviceId && originDeviceId === getDeviceId()) return;
    this.owed.set(scope.id, scope.kind);
    this.drain();
  }

  /** Reads a held scope in full, for what the feed does not report. */
  refresh(kind: string, scopeId: string): void {
    if (!this.enabled) return;
    void this.snapshotOf(kind, scopeId, this.session);
  }

  private drain(): void {
    if (!this.enabled || this.draining) return;
    this.draining = true;
    this.pass = this.runOwed(this.session)
      .catch((error: unknown) => {
        logger.warn('Feed: a pass stopped', error);
      })
      .finally(() => {
        this.draining = false;
      });
  }

  /** @internal Resolves when the pass running now has ended. */
  whenSettled(): Promise<void> {
    return this.pass;
  }

  private isCurrent(session: number): boolean {
    return this.enabled && session === this.session;
  }

  private async runOwed(session: number): Promise<void> {
    // A scope answering `RESYNC_REQUIRED` from a position it just gave would
    // otherwise be read in full for as long as the pass runs.
    const readInFull = new Set<string>();
    while (
      this.isCurrent(session) &&
      (this.scopesOwed || this.owed.size > 0) &&
      this.mayAsk()
    ) {
      const reached = !this.scopesOwed || (await this.readReachable(session));
      if (!reached || !(await this.pullOwed(session, readInFull))) return;
    }
  }

  private mayAsk(): boolean {
    if (isApiUnavailable(useStore.getState())) return false;
    const wait = this.notBefore - Date.now();
    if (wait <= 0) return true;
    this.wakeIn(wait);
    return false;
  }

  private wakeIn(ms: number): void {
    clearTimeout(this.wakeTimer);
    this.wakeTimer = setTimeout(() => this.drain(), ms);
  }

  private paceAfter(error: unknown): void {
    const pacing = getRateLimitDetails(error);
    if (!pacing) return;
    const wait = pacing.retryAfter
      ? pacing.retryAfter * 1000
      : RATE_LIMIT_FALLBACK_MS;
    this.notBefore = Date.now() + wait;
    this.wakeIn(wait);
  }

  /** False leaves the read owed, and removes nothing. */
  private async readReachable(session: number): Promise<boolean> {
    const client = requireApolloClient();
    const reached = new Map<string, { kind: string; cursor: string }>();
    let after: string | null = null;
    let hasNextPage = true;
    // Taken up before asking: a change of reach during the read asks again.
    this.scopesOwed = false;
    while (hasNextPage) {
      const { data, error }: Awaited<ReturnType<typeof readScopesPage>> =
        await readScopesPage(client, after);
      if (!this.isCurrent(session)) return false;
      if (error || !data) {
        this.scopesOwed = true;
        this.paceAfter(error);
        return false;
      }
      for (const { node } of data.syncScopes.edges) {
        reached.set(node.id, { kind: node.kind, cursor: node.cursor });
      }
      ({ hasNextPage } = data.syncScopes.pageInfo);
      after = data.syncScopes.pageInfo.endCursor ?? null;
      if (hasNextPage && !after) {
        this.scopesOwed = true;
        return false;
      }
    }

    this.evictMissing(client, reached);
    for (const [id, { kind, cursor }] of reached) {
      if (adapterFor(kind) && positionOf(id)?.cursor !== cursor) {
        this.owed.set(id, kind);
      }
    }
    return true;
  }

  private evictMissing(
    client: ApolloClient,
    reached: ReadonlyMap<string, unknown>,
  ): void {
    const gone = [...heldScopes()].filter(([id, { kind }]) => {
      const adapter = adapterFor(kind);
      return (
        !reached.has(id) &&
        adapter !== undefined &&
        !adapter.holdsUnacknowledgedCreate(id)
      );
    });
    if (gone.length === 0) return;
    client.cache.batch({
      optimistic: false,
      update: cache => {
        for (const [id, { kind }] of gone) {
          const adapter = adapterFor(kind);
          if (adapter) this.evict(adapter, cache, id);
        }
      },
    });
    pendingWritesOf(client.cache).scheduleRebuild();
  }

  private evict(adapter: FeedAdapter, cache: ApolloCache, id: string): void {
    this.owed.delete(id);
    adapter.evict(cache, id);
    forgetPosition(id);
    Telemetry.increment('feed_evicted_total', 1, { kind: adapter.kind });
  }

  private async pullOwed(
    session: number,
    readInFull: Set<string>,
  ): Promise<boolean> {
    for (const adapter of FEED_ADAPTERS) {
      const ready = [...this.owed]
        .filter(([, kind]) => kind === adapter.kind)
        .map(([id]) => id)
        .filter(id => {
          const waits = adapter.holdsUnacknowledgedCreate(id);
          // Queue-drained catches it up once the create is answered.
          if (waits) this.owed.delete(id);
          return !waits;
        });
      const unread: string[] = [];
      for (let at = 0; at < ready.length; at += MAX_SCOPES_PER_PULL) {
        const batch = ready.slice(at, at + MAX_SCOPES_PER_PULL);
        const pulled = await this.pullBatch(adapter, batch, unread, session);
        if (!pulled) return false;
      }
      unread.sort(
        (a, b) => Number(adapter.isOnScreen(b)) - Number(adapter.isOnScreen(a)),
      );
      for (const id of unread) {
        if (readInFull.has(id)) continue;
        readInFull.add(id);
        const read = await this.snapshotOf(adapter.kind, id, session);
        if (!read) return false;
      }
    }
    return true;
  }

  private async pullBatch(
    adapter: FeedAdapter,
    batch: readonly string[],
    unread: string[],
    session: number,
  ): Promise<boolean> {
    const client = requireApolloClient();
    const startedAt = performance.now();
    // Taken up before asking: a poke during the pull can name a change its
    // answer cannot hold, so it has to owe another.
    for (const id of batch) this.owed.delete(id);
    const answer = await adapter.pull(
      client,
      batch.map(id => ({ id, cursor: positionOf(id)?.cursor ?? null })),
    );
    if (!this.isCurrent(session)) {
      forgetAnswers(client.cache);
      return false;
    }
    if (answer.data === undefined) {
      forgetAnswers(client.cache);
      for (const id of batch) this.owed.set(id, adapter.kind);
      this.paceAfter(answer.error);
      return false;
    }
    const { data: pages } = answer;
    client.cache.batch({
      optimistic: false,
      update: cache => {
        for (const page of pages) this.settle(adapter, cache, page, unread);
        forgetAnswers(cache);
      },
    });
    pendingWritesOf(client.cache).scheduleRebuild();
    Telemetry.histogram('feed_pull_ms', performance.now() - startedAt);
    const applied = pages.flatMap(page => page.applied);
    if (applied.length > 0) queueManager.settleFromFeed(applied);
    return true;
  }

  private settle(
    adapter: FeedAdapter,
    cache: ApolloCache,
    page: FeedPage,
    unread: string[],
  ): void {
    const { scopeId, status, cursor, hasMore } = page;
    if (status === SyncPageStatus.Unavailable) {
      this.evict(adapter, cache, scopeId);
      return;
    }
    if (status === SyncPageStatus.ResyncRequired || !cursor) {
      unread.push(scopeId);
      return;
    }
    page.apply(cache);
    // Last, so a position never claims rows the device does not have.
    holdPosition(scopeId, {
      kind: adapter.kind,
      cursor,
      snapshotAt: positionOf(scopeId)?.snapshotAt ?? 0,
    });
    if (hasMore) this.owed.set(scopeId, adapter.kind);
  }

  private async snapshotOf(
    kind: string,
    id: string,
    session: number,
  ): Promise<boolean> {
    const adapter = adapterFor(kind);
    if (!adapter) return true;
    const client = requireApolloClient();
    const answer = await adapter.snapshot(client, id);
    if (!this.isCurrent(session) || answer.data === undefined) {
      forgetAnswers(client.cache);
      if (answer.data === undefined) this.paceAfter(answer.error);
      return false;
    }
    const { status, cursor, replace } = answer.data;
    client.cache.batch({
      optimistic: false,
      update: cache => {
        if (status === SyncPageStatus.Unavailable) {
          this.evict(adapter, cache, id);
        } else if (status === SyncPageStatus.Current && cursor) {
          replace(cache);
          holdPosition(id, { kind, cursor, snapshotAt: Date.now() });
          // What landed during the read comes from its position.
          this.owed.set(id, kind);
        }
        forgetAnswers(cache);
      },
    });
    pendingWritesOf(client.cache).scheduleRebuild();
    Telemetry.increment('feed_snapshot_total', 1, { kind });
    this.drain();
    return true;
  }
}

export const feedEngine = new FeedEngine();

registerSessionTeardown('change-feed', () => {
  feedEngine.stop();
  clearPositions();
});
