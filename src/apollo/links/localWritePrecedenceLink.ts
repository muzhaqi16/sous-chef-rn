import { ApolloLink, Observable } from '@apollo/client';
import {
  canonicalStringify,
  isMutationOperation,
  isQueryOperation,
} from '@apollo/client/utilities';
import type { Subscriber, Subscription } from 'rxjs';
import { isIncremental } from '#/apollo/utils/isIncremental';

/** A local-first write sent while reads were in flight. */
type Write = object;

/** A read this link forwarded that has not answered the network yet. */
interface Read {
  operation: ApolloLink.Operation;
  /** The caller's context, before the links after this one add to it. */
  context: ApolloLink.OperationContext;
  forward: ApolloLink.ForwardFunction;
  observer: Subscriber<ApolloLink.Result>;
  network?: Subscription;
  /** What the cache held for it when it was sent. */
  sent: unknown;
  /** Answered from the cache; its network answer is only compared. */
  answered: boolean;
  /** Its cache read was incomplete; its network answer is dropped and the read re-sent. */
  held: boolean;
  /** Its network answer has arrived, or failed. */
  landed: boolean;
  /** Its network answer disagreed with the cache. */
  stale: boolean;
  /** The local-first writes that caught it and have not settled. */
  writes: Set<Write>;
}

const cacheRead = (operation: ApolloLink.Operation) =>
  operation.client.cache.diff<Record<string, unknown>>({
    query: operation.query,
    variables: operation.variables,
    returnPartialData: true,
    optimistic: false,
  });

// A write to a field with no keyArgs gives every argument's read a new
// identity, so an equal copy counts as the same data.
const sameData = (a: unknown, b: unknown) =>
  a === b || canonicalStringify(a) === canonicalStringify(b);

/**
 * A read already in flight when a local-first write is sent would answer with
 * the state from before the write, and Apollo shows a watcher nothing newer
 * until it does. So the write answers each such read at once from the cache
 * when it touched the read's data, and the read is asked again once the write
 * settles if the server's late answer disagrees. Verified:
 * `#apollo-a-read-in-flight-hides-a-newer-write-then-overwrites-it`.
 */
export function createLocalWritePrecedenceLink(): ApolloLink {
  const inFlight = new Set<Read>();

  const finish = (read: Read) => {
    if (read.writes.size > 0 || !read.landed) return;
    inFlight.delete(read);
    if (read.answered && read.stale) {
      const { client, query, variables } = read.operation;
      void client
        .query({
          query,
          variables,
          context: read.context,
          fetchPolicy: 'network-only',
        })
        .catch(() => undefined);
    } else if (read.held && !read.observer.closed) {
      // Sent again through this link, so a later write catches it as well.
      read.held = false;
      read.landed = false;
      inFlight.add(read);
      send(read);
    }
  };

  /** Sends a read on, answering its caller unless a write has caught it. */
  const send = (read: Read) => {
    const { operation, observer } = read;
    const land = () => {
      read.landed = true;
      finish(read);
    };
    read.sent = cacheRead(operation).result;
    read.network = read.forward(operation).subscribe({
      next: value => {
        if (read.answered) {
          read.stale ||= !sameData(
            value.data ?? null,
            cacheRead(operation).result ?? null,
          );
          return;
        }
        if (!read.held) observer.next(value);
      },
      error: (error: unknown) => {
        if (read.answered || read.held) {
          land();
          return;
        }
        inFlight.delete(read);
        observer.error(error);
      },
      complete: () => {
        if (read.answered || read.held) {
          land();
          return;
        }
        inFlight.delete(read);
        observer.complete();
      },
    });
  };

  const catchRead = (read: Read, write: Write) => {
    if (read.answered || read.held) {
      read.writes.add(write);
      return;
    }
    const { result, complete } = cacheRead(read.operation);
    // The write left its data as it was sent, so its answer cannot undo it.
    if (complete && sameData(result, read.sent)) return;
    read.writes.add(write);
    if (!complete) {
      read.held = true;
      return;
    }
    // Emitted while the subscriber is open: Apollo tears the read down after
    // `complete`, and the teardown keeps its request running to compare.
    read.answered = true;
    read.observer.next({ data: result });
    read.observer.complete();
  };

  const readThrough = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction,
  ) =>
    new Observable<ApolloLink.Result>(observer => {
      const read: Read = {
        operation,
        context: operation.getContext(),
        forward,
        observer,
        sent: undefined,
        answered: false,
        held: false,
        landed: false,
        stale: false,
        writes: new Set(),
      };
      inFlight.add(read);
      send(read);
      return () => {
        if (read.answered) return;
        inFlight.delete(read);
        read.network?.unsubscribe();
      };
    });

  const writeThrough = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction,
  ) => {
    const write: Write = {};
    const caught = [...inFlight];
    caught.forEach(read => catchRead(read, write));
    return new Observable<ApolloLink.Result>(observer => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        caught.forEach(read => {
          read.writes.delete(write);
          finish(read);
        });
      };
      const sent = forward(operation).subscribe({
        next: value => observer.next(value),
        error: (error: unknown) => {
          observer.error(error);
          settle();
        },
        complete: () => {
          observer.complete();
          settle();
        },
      });
      return () => {
        sent.unsubscribe();
        settle();
      };
    });
  };

  return new ApolloLink((operation, forward) => {
    if (isQueryOperation(operation.query) && !isIncremental(operation.query)) {
      return readThrough(operation, forward);
    }
    if (
      isMutationOperation(operation.query) &&
      operation.getContext().localFirst === true
    ) {
      return writeThrough(operation, forward);
    }
    return forward(operation);
  });
}
