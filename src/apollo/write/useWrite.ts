import { useApolloClient } from '@apollo/client/react';
import { applyIntent, revertIntent } from './applyIntent';
import {
  adjustBy,
  isAdjustBy,
  type WriteIntent,
  type WriteIntentDraft,
} from './writeIntent';

/**
 * The declared path for a write that must survive being made offline.
 *
 * Replaces the lifecycle every call site used to assemble by hand — identify,
 * snapshot, modify, move between connections, recompute parents, persist a
 * marker, write a revert closure, branch on the queued-null result, branch
 * again on the resolved refusal. All of that was the same shape at every site
 * and drifted at each one.
 *
 * The call site now says WHAT changed; the kit decides how it is applied, what
 * undoes it, and what carries it to the server.
 */
export interface UseWriteResult {
  /**
   * Record what a write did WITHOUT applying it, for a change the caller has
   * already made itself.
   *
   * Creates are the case. The complete optimistic entity — every field every
   * query reads, or the row is invisible offline — is a per-entity concern the
   * feature's own builder owns, and re-deriving it in the kit would duplicate
   * exactly the knowledge the completeness test exists to protect. So the
   * builder writes, and this records what undoes it.
   *
   * Only sound where the undo needs nothing from the pre-write cache, which is
   * true of a create: its inverse is the entity's absence. A patch must go
   * through {@link UseWriteResult.apply}, which reads the prior values while
   * they still exist.
   */
  describe: (draft: WriteIntentDraft & { lifecycle: 'create' }) => AppliedWrite;
  /**
   * Apply a change locally and hand back the context to fire the mutation with.
   *
   * Apply first, then fire: the queue completes an offline mutation with a null
   * result, and an `optimisticResponse` would be torn down at exactly that
   * moment — so the change has to be a permanent cache write, and the intent is
   * what makes it undoable anyway.
   */
  apply: (draft: WriteIntentDraft) => AppliedWrite;
  /**
   * Apply several changes as ONE write, for a mutation that touches more than
   * one entity — a batch that takes N rows out of a list in a single call.
   *
   * Not expressible as N separate `apply` calls: each returns its own context
   * and a mutation carries one, so only the last would reach the queue and the
   * rest would be applied with nothing able to undo them. They travel together
   * or the withdrawal is partial.
   */
  applyAll: (drafts: WriteIntentDraft[]) => AppliedWrite;
}

export interface AppliedWrite {
  /** Spread into the mutation's `context`. Carries the intents to the queue. */
  context: {
    localFirst: true;
    convergence: string;
    writeIntents: WriteIntent[];
  };
  /** The applied intents, should the call site need them. */
  intents: WriteIntent[];
  /**
   * Undo this write now.
   *
   * For the SYNCHRONOUS refusal — the mutation reached the server and was
   * refused on the spot, so it never entered the queue and the queue's
   * withdrawal path will never see it. The asynchronous case (a queued write
   * refused on a later replay, possibly after a restart) is handled from the
   * persisted intent instead. Same inverse, two triggers.
   */
  revert: () => void;
}

export function useWrite(): UseWriteResult {
  const client = useApolloClient();

  const applied = (
    intents: WriteIntent[],
    convergence: string,
  ): AppliedWrite => ({
    context: { localFirst: true, convergence, writeIntents: intents },
    intents,
    // Reverse order, matching the queue's own withdrawal: the last change made
    // is the first put back.
    revert: () => {
      for (const intent of [...intents].reverse()) {
        revertIntent(client.cache, intent);
      }
    },
  });

  const apply = (draft: WriteIntentDraft): AppliedWrite =>
    applied([applyIntent(client.cache, draft)], draft.convergence);

  const applyAll = (drafts: WriteIntentDraft[]): AppliedWrite =>
    applied(
      drafts.map(draft => applyIntent(client.cache, draft)),
      // One write, so one convergence; they are all the same shape of change.
      drafts[0]?.convergence ?? 'relative',
    );

  const describe = (
    draft: WriteIntentDraft & { lifecycle: 'create' },
  ): AppliedWrite => {
    // No cache read and no write: the undo of a create is an evict plus the
    // aggregate inverses, both derivable from the draft alone.
    const intent: WriteIntent = {
      ...draft,
      inverse: {},
      aggregateInverses: (draft.aggregates ?? []).map(entry =>
        Object.fromEntries(
          Object.entries(entry.patch).map(([field, value]) => [
            field,
            isAdjustBy(value) ? adjustBy(-value.__adjust) : value,
          ]),
        ),
      ),
    };
    return applied([intent], draft.convergence);
  };

  return { apply, applyAll, describe };
}
