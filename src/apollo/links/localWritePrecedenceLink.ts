import { ApolloLink, Observable } from '@apollo/client';
import {
  canonicalStringify,
  isMutationOperation,
  isQueryOperation,
} from '@apollo/client/utilities';
import type { Subscriber, Subscription } from 'rxjs';
import { readFenceOf } from '#/apollo/pendingWrites/readFence';
import { isIncremental } from '#/apollo/utils/isIncremental';

/** A local-first write sent while reads were in flight. */
interface Write {
  /** Held as a layer, so the root stays the server's and a late answer may land. */
  layered: boolean;
}

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
  /** A write that isn't a layer caught it, so its late answer can't land under one. */
  asksAgain: boolean;
  /** Tells the fence it has landed. */
  land: () => void;
  /** The local-first writes that caught it and have not settled. */
  writes: Set<Write>;
}

const cacheRead = (operation: ApolloLink.Operation, optimistic: boolean) =>
  operation.client.cache.diff<Record<string, unknown>>({
    query: operation.query,
    variables: operation.variables,
    returnPartialData: true,
    optimistic,
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
    read.land = readFenceOf(operation.client.cache).begin();
    read.sent = cacheRead(operation, true).result;
    read.network = read.forward(operation).subscribe({
      next: value => {
        if (!read.answered) {
          if (!read.held) observer.next(value);
          return;
        }
        if (read.asksAgain) {
          read.stale ||= !sameData(
            value.data ?? null,
            cacheRead(operation, true).result ?? null,
          );
        } else if (value.data && !value.errors) {
          // Under the write's layer, so the rest of the answer shows beside it.
          const { client, query, variables } = operation;
          client.cache.writeQuery({ query, variables, data: value.data });
        }
      },
      error: (error: unknown) => {
        read.land();
        if (read.answered || read.held) {
          land();
          return;
        }
        inFlight.delete(read);
        observer.error(error);
      },
      complete: () => {
        read.land();
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
    read.asksAgain ||= !write.layered;
    if (read.answered || read.held) {
      read.writes.add(write);
      return;
    }
    const shown = cacheRead(read.operation, true);
    // The write left its data as it was sent, so its answer cannot undo it.
    if (shown.complete && sameData(shown.result, read.sent)) return;
    read.writes.add(write);
    // Apollo stores what a link answers, so the answer is the server's data:
    // it only releases the watcher, which then reads the layer over it.
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
        context: operation.getContext(),
        forward,
        observer,
        sent: undefined,
        answered: false,
        held: false,
        landed: false,
        stale: false,
        asksAgain: false,
        land: () => undefined,
        writes: new Set(),
      };
      inFlight.add(read);
      send(read);
      return () => {
        if (read.answered) return;
        read.land();
        inFlight.delete(read);
        read.network?.unsubscribe();
      };
    });

  // Apollo stores a page a tick after its request ends, and the fence must
  // still hold then, or a page from before a removal puts the row back.
  const pageThrough = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction,
  ) =>
    new Observable<ApolloLink.Result>(observer => {
      const land = readFenceOf(operation.client.cache).begin();
      const landAfterStored = () => setTimeout(land, 0);
      const page = forward(operation).subscribe({
        next: value => observer.next(value),
        error: (error: unknown) => {
          observer.error(error);
          landAfterStored();
        },
        complete: () => {
          observer.complete();
          landAfterStored();
        },
      });
      return () => {
        page.unsubscribe();
        landAfterStored();
      };
    });

  const writeThrough = (
    operation: ApolloLink.Operation,
    forward: ApolloLink.ForwardFunction,
  ) => {
    const write: Write = {
      layered: typeof operation.getContext().pendingWriteId === 'string',
    };
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
    // A `fetchMore` page (`context.page`) is its own `no-cache` request: it never
    // holds the list's watcher back, and the cache can only answer it with the
    // list already shown, so it passes untouched.
    if (isQueryOperation(operation.query)) {
      if (operation.getContext().page === true) {
        return pageThrough(operation, forward);
      }
      if (!isIncremental(operation.query)) {
        return readThrough(operation, forward);
      }
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
