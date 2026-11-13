import type {
  ApolloCache,
  ApolloClient,
  DocumentNode,
  OperationVariables,
  TypedDocumentNode,
} from '@apollo/client';

/** How long a wait holds before it fails, saying what it saw. */
export const WAIT_MS = 5000;

// Captured as the module loads, so a suite's fake clock never fires a deadline.
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;

/**
 * Resolves when `wait` calls its `done`, or rejects after `ms` with what
 * `failure()` says then. A wait that never ends fails here, with a reason,
 * instead of at the test's own timeout with none.
 */
export function withDeadline(
  wait: (done: () => void) => () => void,
  failure: () => string,
  ms = WAIT_MS,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let stop: (() => void) | undefined;
    let settled = false;
    const timer = realSetTimeout(() => {
      if (settled) return;
      settled = true;
      stop?.();
      reject(new Error(`Waited ${ms} ms: ${failure()}`));
    }, ms);
    stop = wait(() => {
      if (settled) return;
      settled = true;
      realClearTimeout(timer);
      resolve();
      // Stopped after the watcher's own callback returns, inside which an
      // unsubscribe throws, and after `wait` has handed its stop over.
      queueMicrotask(() => stop?.());
    });
  });
}

type Watched =
  | {
      query: DocumentNode | TypedDocumentNode;
      variables?: OperationVariables;
      optimistic?: boolean;
    }
  | {
      fragment: DocumentNode | TypedDocumentNode;
      fragmentName?: string;
      from: string;
    };

const shown = (value: unknown) => {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
};

/**
 * Resolves once `read()` satisfies `ok`, re-read on every change to `watched`
 * in the cache. A write's own waits: a hook's, a cache helper's. A screen
 * hears a change a task later, so a screen test uses {@link screenShows}.
 */
export function cacheShows<T>(
  cache: ApolloCache,
  watched: Watched,
  read: () => T,
  ok: (seen: T) => boolean,
): Promise<void> {
  let seen: T | undefined;
  const check = (done: () => void) => {
    seen = read();
    if (ok(seen)) done();
  };
  return withDeadline(
    done => {
      if ('fragment' in watched) {
        const subscription = cache
          .watchFragment({
            fragment: watched.fragment,
            fragmentName: watched.fragmentName,
            from: watched.from,
          })
          .subscribe(() => check(done));
        return () => subscription.unsubscribe();
      }
      return cache.watch({
        query: watched.query,
        variables: watched.variables,
        optimistic: watched.optimistic ?? true,
        immediate: true,
        callback: () => check(done),
      });
    },
    () => `the cache never showed what was asked; it last read ${shown(seen)}`,
  );
}

/**
 * Resolves once `read()` satisfies `ok`, checked each time a cache-only watch
 * of `query` is told of a change. A cache write reaches a watching query a
 * task later (`scheduleNotify`), and a screen's watcher, older than this one,
 * is told first: awaited inside `act`, what the screen renders has settled.
 */
export function screenShows<T>(
  client: ApolloClient,
  watched: {
    query: DocumentNode | TypedDocumentNode;
    variables?: OperationVariables;
  },
  read: () => T,
  ok: (seen: T) => boolean,
): Promise<void> {
  let seen: T | undefined;
  return withDeadline(
    done => {
      const subscription = client
        .watchQuery({
          query: watched.query,
          variables: watched.variables,
          fetchPolicy: 'cache-only',
        })
        .subscribe(() => {
          seen = read();
          if (ok(seen)) done();
        });
      return () => subscription.unsubscribe();
    },
    () =>
      `the screen's read never showed what was asked; it last read ${shown(
        seen,
      )}`,
  );
}
