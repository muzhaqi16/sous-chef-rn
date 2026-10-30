import { ApolloLink, Observable } from '@apollo/client';
import {
  canonicalStringify,
  isMutationOperation,
  isQueryOperation,
} from '@apollo/client/utilities';
import { BREAK, visit, type DocumentNode } from 'graphql';
import type { Subscriber, Subscription } from 'rxjs';

/** A local-first write sent while reads were in flight. */
type Write = object;

/** A read this link forwarded that has not answered the network yet. */
interface Read {
  operation: ApolloLink.Operation;
  forward: ApolloLink.ForwardFunction;
  observer: Subscriber<ApolloLink.Result>;
  network?: Subscription;
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

const isIncremental = (query: DocumentNode): boolean => {
  let found = false;
  visit(query, {
    Directive(node) {
      if (node.name.value === 'defer' || node.name.value === 'stream') {
        found = true;
        return BREAK;
      }
      return undefined;
    },
  });
  return found;
};

const cacheRead = (
  operation: ApolloLink.Operation,
  returnPartialData: boolean,
) =>
  operation.client.cache.diff<Record<string, unknown>>({
    query: operation.query,
    variables: operation.variables,
    returnPartialData,
    optimistic: false,
  });

/**
 * A read already in flight when a local-first write is sent would answer with
 * the state from before the write, and Apollo shows a watcher nothing newer
 * until it does. So the write answers each such read from the cache at once,
 * and the read is asked again once the write settles if the server's late
 * answer disagrees. Verified:
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
        .query({ query, variables, fetchPolicy: 'network-only' })
        .catch(() => undefined);
    } else if (read.held) {
      read.held = false;
      read.landed = false;
      inFlight.add(read);
      read.network = read.forward(read.operation).subscribe(read.observer);
    }
  };

  const catchRead = (read: Read, write: Write) => {
    read.writes.add(write);
    if (read.answered || read.held) return;
    const { result, complete } = cacheRead(read.operation, false);
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
        forward,
        observer,
        answered: false,
        held: false,
        landed: false,
        stale: false,
        writes: new Set(),
      };
      inFlight.add(read);
      const land = () => {
        read.landed = true;
        finish(read);
      };
      read.network = forward(operation).subscribe({
        next: value => {
          if (read.answered) {
            read.stale ||=
              canonicalStringify(value.data ?? null) !==
              canonicalStringify(cacheRead(operation, true).result ?? null);
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
