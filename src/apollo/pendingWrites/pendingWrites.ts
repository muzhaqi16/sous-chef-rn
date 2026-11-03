import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { orderAnswer } from '#/apollo/links/answerOrderingLink';
import {
  dependencyIdsOf,
  inputOnSurvivingRow,
  queuedSubject,
} from '#/apollo/offlineQueue/queuedSubject';
import type { RowAdoption } from '#/apollo/offlineQueue/types';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { returnedVersionOf, versionOf } from '#/apollo/utils/returnedVersion';
import type { Settled } from '#/apollo/utils/settleMutation';
import { errorService } from '#/services/errorService';
import { generateEntityId } from '#/utils/generateEntityId';
import { generateId } from '#/utils/generateId';
import { isRecord } from '#/utils/isRecord';
import { LOCAL_WRITES } from './localWriteRegistry';
import { readFenceOf } from './readFence';
import type {
  ConflictRead,
  LocalInputs,
  LocalWriteTable,
  PendingWrite,
} from './types';

const REBUILD_WINDOW_MS = 50;

/** What `send` hands the mutation: a replay reads the same context off its entry. */
export interface LocalWriteSend<
  TVariables extends OperationVariables = OperationVariables,
> {
  variables: TVariables;
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
  /** Answered writes waiting on the reads in flight, with their answers. */
  private awaitingReads = new Map<string, unknown>();
  private generation = 0;
  private applying = false;
  private rebuildOwed = false;
  private layered = false;
  private sending = new Map<string, Sending>();
  /** The newest version answers returned: a layer's copy of a row can lag it. */
  private answeredVersions = new Map<string, number>();

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
  begin(
    document: DocumentNode,
    variables: OperationVariables,
    given: LocalInputs = {},
  ): PendingWrite {
    const operationName = operationNameOf(document);
    const local = this.table[operationName];
    if (!local) {
      throw new Error(`No local write is registered for ${operationName}`);
    }
    const write: PendingWrite = {
      id: generateId(),
      operationName,
      document,
      variables: local.keyed ? withIdempotencyKey(variables) : variables,
      inputs: { ...given, ...local.capture?.(this.cache, variables) },
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
   * outcome. Queued, the write stays pending and the queue carries it. `given`
   * is what only the caller knows, such as a new row's display.
   */
  async send<TData, TVariables extends OperationVariables>(
    document: DocumentNode,
    variables: TVariables,
    settle: (send: LocalWriteSend<TVariables>) => Promise<Settled<TData>>,
    given?: LocalInputs,
  ): Promise<Settled<TData>> {
    const write = this.begin(document, variables, given);
    const { subjectIds, mintedIds } = queuedSubject({
      mutation: document,
      variables,
    });
    const orderedBy = this.orderOf(write);
    const sentAs = orderedBy ? [...subjectIds, orderedBy] : subjectIds;
    const named = new Set([
      ...sentAs,
      ...dependencyIdsOf({ mutation: document, variables }),
    ]);
    const earlier = [...this.sending.values()].filter(({ subjectIds: ids }) =>
      ids.some(id => named.has(id)),
    );

    let answer: (answered: Answered) => void = () => undefined;
    const answered = new Promise<Answered>(resolve => {
      answer = resolve;
    });
    this.sending.set(write.id, { subjectIds: sentAs, mintedIds, answered });

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
      return { ...refused.settled, data: undefined };
    }

    let data: unknown;
    let settled: Settled<TData>;
    try {
      const { input } = this.get(write.id)?.variables ?? variables;
      settled = await settle({
        variables: this.onAnsweredVersion({ ...variables, input }, subjectIds),
        context: { localFirst: true, pendingWriteId: write.id },
        update: (_cache, result) => {
          data = result.data;
        },
      });
    } catch (error) {
      // Only reporting a failure can throw, and what waits on the write must
      // still hear of it.
      this.sending.delete(write.id);
      this.drop(write.id);
      answer({
        settled: { status: 'failed', data: undefined },
        data: undefined,
      });
      throw error;
    }
    if (settled.status === 'applied') {
      this.noteAnsweredVersion(subjectIds, data ?? settled.data);
      this.confirm(write.id, data ?? settled.data);
    } else if (settled.status === 'failed') {
      this.drop(write.id);
    }
    this.sending.delete(write.id);
    answer({ settled, data });
    return settled;
  }

  /**
   * Adds to a write's inputs what was known only after it was made, such as
   * the store a check-in waited for. Queued with it from then on, so it comes
   * before the send.
   */
  amend(id: string, inputs: LocalInputs): void {
    this.writes = this.writes.map(write =>
      write.id === id
        ? { ...write, inputs: { ...write.inputs, ...inputs } }
        : write,
    );
    this.rebuild();
  }

  /** What `write` stays in order behind, beyond the rows it names. */
  orderOf(write: PendingWrite): string | undefined {
    return this.table[write.operationName]?.orderedBy?.(write);
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

  /** A pull confirming its row settles the write (`LocalWrite.settlesFromFeed`). */
  settlesFromFeed(operationName: string): boolean {
    return this.table[operationName]?.settlesFromFeed === true;
  }

  /** A refusal keeps the write for the person, unless it has a retry of its own. */
  keepsRefusal(operationName: string): boolean {
    return this.table[operationName]?.recoverable !== false;
  }

  conflictOf(operationName: string): ConflictRead | undefined {
    return this.table[operationName]?.conflict;
  }

  /** Writes the person sent back: they show again, and the queue carries them. */
  reopen(writes: readonly PendingWrite[]): void {
    this.writes = [...this.writes, ...writes];
    writes.forEach(write => this.queued.add(write.id));
    this.rebuild();
  }

  /** The server refused a queued write for good. */
  refuse(id: string): void {
    const write = this.get(id);
    if (!write) return;
    try {
      this.table[write.operationName]?.refused?.(this.cache, write);
    } catch (error) {
      errorService.reportError(error, {
        operation: `Refuse ${write.operationName}`,
      });
    }
    this.drop(id);
  }

  /**
   * The server has it. `data` is its answer, or undefined for a removal it
   * answered gone, so the write's own change is all the root can take. It commits once
   * the reads in flight now have landed: one may hold state from before it. Its
   * layer shows the answer meanwhile, as `apply` expects a root without it.
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
    this.awaitingReads.set(id, data);
    this.scheduleRebuild();
    void fence.passed().then(() => {
      if (this.get(id)) this.commit(write, data, true);
    });
  }

  /** A create the server merged: the writes held behind it go to the surviving row. */
  followMerge(
    adoption: RowAdoption,
    moves: (write: PendingWrite) => boolean,
  ): void {
    const { mintedId } = adoption;
    this.writes = this.writes.map(write => {
      const sending = this.sending.get(write.id);
      const { input } = write.variables;
      return sending &&
        !sending.mintedIds.includes(mintedId) &&
        isRecord(input) &&
        moves(write)
        ? {
            ...write,
            variables: {
              ...write.variables,
              input: inputOnSurvivingRow(input, adoption),
            },
          }
        : write;
    });
    this.rebuild();
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

  /**
   * The queue moved its writes onto a merged row, or let some go: the layers
   * show what it will send, and a queued write it dropped goes with it.
   */
  followQueue(stored: readonly PendingWrite[]): void {
    const carried = new Map(stored.map(({ id, variables }) => [id, variables]));
    const gone = [...this.queued].filter(id => !carried.has(id));
    gone.forEach(id => this.remove(id));
    this.writes = this.writes.map(write => ({
      ...write,
      variables: carried.get(write.id) ?? write.variables,
    }));
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
    this.awaitingReads.clear();
    this.answeredVersions.clear();
    this.rebuild();
  }

  /**
   * After the batch the server's answer is written in, which undoes a layer
   * change, and shared by every answer that lands in the window, as a rebuild
   * costs each pending write. Pending values hold meanwhile; only what the
   * server changed around them lags.
   */
  scheduleRebuild(): void {
    if (!this.layered || this.rebuildOwed) return;
    this.rebuildOwed = true;
    setTimeout(() => {
      if (this.rebuildOwed) this.rebuild();
    }, REBUILD_WINDOW_MS);
  }

  rebuild(): void {
    this.rebuildOwed = false;
    const hadLayers = this.layered;
    if (this.writes.length === 0 && !hadLayers) return;
    const previous = this.layerId();
    this.generation += 1;
    this.layered = this.writes.length > 0;
    if (!this.layered) {
      this.cache.removeOptimistic(previous);
      return;
    }
    // Apollo runs `update` over the old layers, and again over the root as they
    // are removed. Only the second is kept, so the first is skipped.
    let runs = 0;
    this.cache.batch({
      optimistic: this.layerId(),
      removeOptimistic: previous,
      update: layer => {
        runs += 1;
        if (runs > 1 || !hadLayers) this.applyAll(layer, this.writes);
      },
    });
    // A cache reset took the old layers, so nothing ran it a second time.
    if (hadLayers && runs === 1) {
      this.cache.recordOptimisticTransaction(
        layer => this.applyAll(layer, this.writes),
        this.layerId(),
      );
    }
  }

  private noteAnsweredVersion(
    subjectIds: readonly string[],
    data: unknown,
  ): void {
    const [subject] = subjectIds;
    const returned = subject ? returnedVersionOf(data, subject) : undefined;
    if (subject && returned !== undefined) {
      this.answeredVersions.set(subject, returned);
    }
  }

  /** Versions only rise, so what an answer returned is never older than the lock. */
  private onAnsweredVersion<TVariables extends OperationVariables>(
    variables: TVariables,
    subjectIds: readonly string[],
  ): TVariables {
    const { input } = variables;
    const [subject] = subjectIds;
    if (!isRecord(input) || !subject) return variables;
    const lock = versionOf(input);
    const answered = this.answeredVersions.get(subject);
    return lock === undefined || answered === undefined || answered <= lock
      ? variables
      : { ...variables, input: { ...input, version: answered } };
  }

  private layerId(): string {
    return `pending:${this.generation}`;
  }

  private remove(id: string): boolean {
    this.queued.delete(id);
    this.awaitingReads.delete(id);
    const kept = this.writes.filter(write => write.id !== id);
    const removed = kept.length < this.writes.length;
    this.writes = kept;
    return removed;
  }

  private applyAll(layer: ApolloCache, writes: readonly PendingWrite[]): void {
    this.applying = true;
    for (const write of writes) {
      try {
        if (this.awaitingReads.has(write.id)) {
          this.writeAnswered(
            layer,
            write,
            this.awaitingReads.get(write.id),
            true,
          );
        } else {
          this.table[write.operationName]?.apply(layer, write);
        }
      } catch (error) {
        errorService.reportError(error, {
          operation: `Apply ${write.operationName}`,
        });
      }
    }
    this.applying = false;
  }

  /** What an answered write leaves, in the root or in a layer over it. */
  private writeAnswered(
    cache: ApolloCache,
    write: PendingWrite,
    data: unknown,
    readsLanded: boolean,
  ): void {
    const local = this.table[write.operationName];
    if (data === undefined) {
      local?.apply(cache, write);
      return;
    }
    if (readsLanded) writeAnswerAgain(cache, write, data);
    local?.commit?.(cache, write, data);
  }

  private commit(
    write: PendingWrite,
    data: unknown,
    readsLanded: boolean,
  ): void {
    this.cache.batch({
      optimistic: false,
      update: root => {
        try {
          this.writeAnswered(root, write, data, readsLanded);
        } catch (error) {
          errorService.reportError(error, {
            operation: `Commit ${write.operationName}`,
          });
        }
      },
    });
    this.remove(write.id);
    this.scheduleRebuild();
  }
}

function withIdempotencyKey(variables: OperationVariables): OperationVariables {
  const { input } = variables;
  return isRecord(input)
    ? { ...variables, input: { ...input, idempotencyKey: generateEntityId() } }
    : variables;
}

/**
 * A read that landed while the write waited may have put a row back as it was
 * before the write. Written again, the answer restores it; ordered, it leaves a
 * row a later change has moved past.
 */
function writeAnswerAgain(
  cache: ApolloCache,
  write: PendingWrite,
  data: unknown,
): void {
  const answer: unknown = JSON.parse(JSON.stringify(data));
  if (!isRecord(answer)) return;
  orderAnswer(cache, write.document, write.variables, answer);
  cache.writeQuery({
    id: 'ROOT_MUTATION',
    query: write.document,
    variables: write.variables,
    data: answer,
  });
  cache.modify({
    id: 'ROOT_MUTATION',
    fields: (_value, { DELETE }) => DELETE,
  });
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
