import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { orderAnswer } from '#/apollo/links/answerOrderingLink';
import {
  dependencyIdsOf,
  queuedSubject,
} from '#/apollo/offlineQueue/queuedSubject';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { returnedVersionOf, versionOf } from '#/apollo/utils/returnedVersion';
import type { Settled } from '#/apollo/utils/settleMutation';
import { errorService } from '#/services/errorService';
import { generateId } from '#/utils/generateId';
import { isRecord } from '#/utils/isRecord';
import { LOCAL_WRITES } from './localWriteRegistry';
import { readFenceOf } from './readFence';
import type { LocalWriteTable, PendingWrite } from './types';

/** What `send` hands the mutation: a replay reads the same context off its entry. */
export interface LocalWriteSend {
  variables: OperationVariables;
  context: { localFirst: true; pendingWriteId: string };
  /** Masking applies only to what `mutate` returns; a commit reads the whole answer. */
  update: (cache: ApolloCache, result: { data?: unknown }) => void;
}

/** A write on its way, which a later write to its row or a child of it waits for. */
interface Sending {
  subjectIds: readonly string[];
  mintedIds: readonly string[];
  answered: Promise<Answered>;
}

interface Answered {
  settled: Settled<unknown>;
  data: unknown;
}

/**
 * The changes the server has not taken, held as optimistic layers over its
 * data: the root stays what the server said, so a refused write is just
 * dropped. Layers under one id form a generation, and a rebuild swaps it for
 * one layer of every write in order, since a layer's copy of a row hides the
 * root's later changes to it. Verified:
 * `#apollo-an-optimistic-layer-copies-the-whole-entity`.
 */
export class PendingWrites {
  private writes: PendingWrite[] = [];
  private queued = new Set<string>();
  private generation = 0;
  private applying = false;
  private rebuildOwed = false;
  private layered = false;
  private sending = new Map<string, Sending>();

  constructor(
    private readonly cache: ApolloCache,
    private readonly table: LocalWriteTable,
  ) {}

  /** A layer's own write is running, not a write to the server's data. */
  get isApplying(): boolean {
    return this.applying;
  }

  get(id: string): PendingWrite | undefined {
    return this.writes.find(write => write.id === id);
  }

  /** Never inside `cache.batch`, which undoes a layer added in its `update`. */
  begin(document: DocumentNode, variables: OperationVariables): PendingWrite {
    const operationName = operationNameOf(document);
    const local = this.table[operationName];
    if (!local) {
      throw new Error(`No local write is registered for ${operationName}`);
    }
    const write: PendingWrite = {
      id: generateId(),
      operationName,
      document,
      variables,
      inputs: local.capture?.(this.cache, variables) ?? {},
    };
    this.writes.push(write);
    this.layered = true;
    this.cache.recordOptimisticTransaction(
      layer => this.applyAll(layer, [write]),
      this.layerId(),
    );
    return write;
  }

  /**
   * Shows the write at once and sends it once the earlier writes it builds on
   * have answered: sent at once it would reach the server first, as an edit
   * before its row's create, or at a version the earlier write moved. A write
   * on a row whose create was refused is refused with it, and only that
   * create's failure is reported. `settle` runs the mutation and reads its
   * outcome. Queued, the write stays pending and the queue carries it.
   */
  async send<TSettled extends Settled<unknown>>(
    document: DocumentNode,
    variables: OperationVariables,
    settle: (send: LocalWriteSend) => Promise<TSettled>,
  ): Promise<TSettled | Settled<unknown>> {
    const write = this.begin(document, variables);
    const { subjectIds, mintedIds } = queuedSubject({
      mutation: document,
      variables,
    });
    const named = new Set([
      ...subjectIds,
      ...dependencyIdsOf({ mutation: document, variables }),
    ]);
    const earlier = [...this.sending.values()].filter(({ subjectIds: ids }) =>
      ids.some(id => named.has(id)),
    );

    let answer: (answered: Answered) => void = () => undefined;
    const answered = new Promise<Answered>(resolve => {
      answer = resolve;
    });
    this.sending.set(write.id, { subjectIds, mintedIds, answered });

    const landed = await Promise.all(
      earlier.map(async entry => ({ ...entry, ...(await entry.answered) })),
    );
    const refused = landed.find(
      ({ settled, mintedIds: minted }) =>
        settled.status === 'failed' && minted.some(id => named.has(id)),
    );
    if (refused) {
      this.sending.delete(write.id);
      this.drop(write.id);
      answer({ settled: refused.settled, data: undefined });
      return refused.settled;
    }

    let data: unknown;
    const settled = await settle({
      variables: onReturnedVersion(variables, subjectIds, landed),
      context: { localFirst: true, pendingWriteId: write.id },
      update: (_cache, result) => {
        data = result.data;
      },
    });
    if (settled.status === 'applied') {
      this.confirm(write.id, data ?? settled.data);
    } else if (settled.status === 'failed') {
      this.drop(write.id);
    }
    this.sending.delete(write.id);
    answer({ settled, data });
    return settled;
  }

  /** The queue holds the write now: a later enqueue may supersede it. */
  markQueued(id: string): void {
    this.queued.add(id);
  }

  /** Refused, or superseded: the screen ends on what is under it. */
  drop(id: string): void {
    if (!this.remove(id)) return;
    this.rebuild();
  }

  /**
   * The server has it. `data` is its answer, or undefined when it answered with
   * no row, so the write's own change is all the root can take. It commits once
   * the reads in flight now have landed: one may hold state from before it.
   */
  confirm(id: string, data?: unknown): void {
    const write = this.get(id);
    if (!write) return;
    this.queued.delete(id);
    const fence = readFenceOf(this.cache);
    if (fence.isClear) {
      this.commit(write, data, false);
      return;
    }
    void fence.passed().then(() => {
      if (this.get(id)) this.commit(write, data, true);
    });
  }

  /** Drops the queued writes a later write superseded, which the queue has let go. */
  keepQueued(held: () => ReadonlySet<string>): void {
    if (this.queued.size === 0) return;
    const holding = held();
    const gone = [...this.queued].filter(id => !holding.has(id));
    if (gone.length === 0) return;
    gone.forEach(id => this.remove(id));
    this.rebuild();
  }

  /** The writes a stored queue carries, over a cache that holds none. */
  restore(writes: readonly PendingWrite[]): void {
    this.writes = [...writes];
    this.queued = new Set(writes.map(write => write.id));
    this.rebuild();
  }

  clear(): void {
    this.writes = [];
    this.queued.clear();
    this.rebuild();
  }

  /** After the batch the server's answer is written in, which undoes a layer change. */
  scheduleRebuild(): void {
    if (this.writes.length === 0 || this.rebuildOwed) return;
    this.rebuildOwed = true;
    queueMicrotask(() => {
      if (this.rebuildOwed) this.rebuild();
    });
  }

  rebuild(): void {
    this.rebuildOwed = false;
    if (this.writes.length === 0 && !this.layered) return;
    const previous = this.layerId();
    this.generation += 1;
    this.layered = this.writes.length > 0;
    if (!this.layered) {
      this.cache.removeOptimistic(previous);
      return;
    }
    this.cache.batch({
      optimistic: this.layerId(),
      removeOptimistic: previous,
      update: layer => this.applyAll(layer, this.writes),
    });
  }

  private layerId(): string {
    return `pending:${this.generation}`;
  }

  private remove(id: string): boolean {
    this.queued.delete(id);
    const kept = this.writes.filter(write => write.id !== id);
    const removed = kept.length < this.writes.length;
    this.writes = kept;
    return removed;
  }

  private applyAll(layer: ApolloCache, writes: readonly PendingWrite[]): void {
    this.applying = true;
    for (const write of writes) {
      try {
        this.table[write.operationName]?.apply(layer, write);
      } catch (error) {
        errorService.reportError(error, {
          operation: `Apply ${write.operationName}`,
        });
      }
    }
    this.applying = false;
  }

  private commit(
    write: PendingWrite,
    data: unknown,
    readsLanded: boolean,
  ): void {
    const local = this.table[write.operationName];
    this.cache.batch({
      optimistic: false,
      update: root => {
        try {
          if (data === undefined) {
            local?.apply(root, write);
            return;
          }
          if (readsLanded) writeAnswerAgain(root, write, data);
          local?.commit?.(root, write, data);
        } catch (error) {
          errorService.reportError(error, {
            operation: `Commit ${write.operationName}`,
          });
        }
      },
    });
    this.remove(write.id);
    this.rebuild();
  }
}

/**
 * A read that landed while the write waited may have put a row back as it was
 * before the write. Written again, the answer restores it; ordered, it leaves a
 * row a later change has moved past.
 */
function writeAnswerAgain(
  root: ApolloCache,
  write: PendingWrite,
  data: unknown,
): void {
  const answer: unknown = JSON.parse(JSON.stringify(data));
  if (!isRecord(answer)) return;
  orderAnswer(root, write.document, write.variables, answer);
  root.writeQuery({
    id: 'ROOT_MUTATION',
    query: write.document,
    variables: write.variables,
    data: answer,
  });
  root.modify({
    id: 'ROOT_MUTATION',
    fields: (_value, { DELETE }) => DELETE,
  });
}

/** Variables moved onto the version an earlier write to the subject returned. */
function onReturnedVersion(
  variables: OperationVariables,
  subjectIds: readonly string[],
  landed: readonly Answered[],
): OperationVariables {
  const { input } = variables;
  const [subject] = subjectIds;
  if (!isRecord(input) || versionOf(input) === undefined || !subject) {
    return variables;
  }
  const returned = landed
    .map(({ data }) => returnedVersionOf(data, subject))
    .filter(version => version !== undefined)
    .at(-1);
  return returned === undefined
    ? variables
    : { ...variables, input: { ...input, version: returned } };
}

const instances = new WeakMap<ApolloCache, PendingWrites>();

/** The cache's pending writes; a new client starts with none. */
export function pendingWritesOf(cache: ApolloCache): PendingWrites {
  const known = instances.get(cache);
  if (known) return known;
  const created = new PendingWrites(cache, LOCAL_WRITES);
  instances.set(cache, created);
  return created;
}
