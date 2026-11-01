import { ApolloLink, Observable } from '@apollo/client';
import {
  canonicalStringify,
  isMutationOperation,
  isQueryOperation,
} from '@apollo/client/utilities';
import type { Subscriber } from 'rxjs';
import { readFenceOf } from '#/apollo/pendingWrites/readFence';
import { isIncremental } from '#/apollo/utils/isIncremental';

/** A read this link forwarded that has not answered the network yet. */
interface Read {
  operation: ApolloLink.Operation;
  observer: Subscriber<ApolloLink.Result>;
  /** What the cache held for it when it was sent. */
  sent: unknown;
  /** Answered from the cache; its network answer lands under the write's layer. */
  answered: boolean;
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
 * when it touched the read's data, and the read's late answer lands under the
 * write's layer, where the fence holds the commit until it has. A read the
 * cache cannot answer goes on, and lands under the layer the same way.
 * Verified: `#apollo-a-read-in-flight-hides-a-newer-write-then-overwrites-it`.
 */
export function createLocalWritePrecedenceLink(): ApolloLink {
  const inFlight = new Set<Read>();

  const catchRead = (read: Read) => {
    if (read.answered) return;
    const shown = cacheRead(read.operation, true);
    // The write left its data as it was sent, so its answer cannot undo it.
    if (shown.complete && sameData(shown.result, read.sent)) return;
    // Apollo stores what a link answers, so the answer is the server's data:
    // it only releases the watcher, which then reads the layer over it.
    const { result, complete } = cacheRead(read.operation, false);
    if (!complete) return;
    // Emitted while the subscriber is open: Apollo tears the read down after
    // `complete`, and the teardown keeps its request running to land under the
    // layer.
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
        observer,
        sent: cacheRead(operation, true).result,
        answered: false,
      };
      const land = readFenceOf(operation.client.cache).begin();
      const landed = () => {
        land();
        inFlight.delete(read);
      };
      inFlight.add(read);
      const network = forward(operation).subscribe({
        next: value => {
          if (!read.answered) {
            observer.next(value);
            return;
          }
          if (value.data && !value.errors) {
            // Under the write's layer, so the rest of the answer shows beside it.
            const { client, query, variables } = operation;
            client.cache.writeQuery({ query, variables, data: value.data });
          }
        },
        error: (error: unknown) => {
          landed();
          if (!read.answered) observer.error(error);
        },
        complete: () => {
          landed();
          if (!read.answered) observer.complete();
        },
      });
      return () => {
        if (read.answered) return;
        landed();
        network.unsubscribe();
      };
    });

  // A page is stored a tick after its request ends, and the fence must still
  // hold then, or a page from before a removal puts the row back.
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

  return new ApolloLink((operation, forward) => {
    // A page (`context.page`) is its own request beside the list's watcher, and
    // the cache can only answer it with the list already shown, so it passes.
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
      [...inFlight].forEach(catchRead);
    }
    return forward(operation);
  });
}
