/**
 * Module-level `finally` wrappers, so hooks and components don't need one.
 *
 * The React Compiler bails out of a whole function when its body contains a
 * `finally` (or a `try` with no `catch`), and a bailout is silent: the function
 * simply stops being memoized. Keeping the finalizer in a module-level helper
 * lets the calling hook keep compiling.
 *
 * A plain `try/catch` does NOT bail out and needs no helper — write it inline.
 * The one rule for inline try/catch is that the TRY BODY must stay free of
 * value blocks (`?.`, `??`, `&&`, `||`, ternary); hoist those above the try.
 * `node scripts/probe-compiler-try-forms.mjs` re-derives all of this against
 * the installed compiler, and `node scripts/check-compiler-bailouts.mjs`
 * enforces it — no linter can (see CLAUDE.md's React Compiler Conventions).
 */

/**
 * Wraps an async refresh so `setRefreshing(false)` is guaranteed.
 *
 * This is the ONLY correct way to drive a pull-to-refresh flag. Writing
 * `setRefreshing(true); await onRefresh(); setRefreshing(false);` inline looks
 * equivalent and is not: Apollo's `refetch()` REJECTS on a network error, and
 * the un-finalized form then never reaches the third line — the spinner spins
 * until the screen unmounts. That was the "pull to refresh sometimes hangs"
 * report, and "sometimes" was "whenever the network was flaky".
 *
 * The catch is part of the contract, not an extra: a refresh that rejects has
 * already been surfaced by the query's own error state, so re-throwing here
 * only produces an unhandled rejection. Pass `onError` when a caller wants to
 * do more than clear the flag.
 */
export async function executeRefreshWithFinally(
  refreshFn: () => Promise<unknown>,
  setRefreshing: (value: boolean) => void,
  onError?: (error: unknown) => void,
): Promise<void> {
  setRefreshing(true);
  await executeAsyncWithCleanup(refreshFn, () => setRefreshing(false), onError);
}

/**
 * The same finalizer for a WRITE, with `onError` REQUIRED rather than optional.
 *
 * `executeRefreshWithFinally`'s swallow is safe for a refetch because the query
 * it refreshes surfaces its own error state. A mutation has no such second
 * surface: if it throws rather than resolving `{ success: false }` — a payload
 * unwrap raising, or a network throw outside `errorPolicy: 'all'` — swallowing
 * clears the spinner and reports nothing at all. Requiring the handler is what
 * makes that omission a type error instead of a silent one, so this is not a
 * convenience wrapper: prefer it for every write, and never widen the parameter
 * back to optional.
 */
export async function executeWriteWithFinally(
  writeFn: () => Promise<unknown>,
  setPending: (value: boolean) => void,
  onError: (error: unknown) => void,
): Promise<void> {
  setPending(true);
  await executeAsyncWithCleanup(writeFn, () => setPending(false), onError);
}

/** Wraps an async operation with try-catch-finally where loading state is set externally
 *  before the call. Only provides catch + finally cleanup.
 *  `fn` may resolve to anything — the value is discarded, and `Promise<void>`
 *  would reject a `Promise<T>` callback (the void-return exemption covers a bare
 *  `void` return type, not one wrapped in a Promise). */
export async function executeAsyncWithCleanup(
  fn: () => Promise<unknown>,
  cleanup: () => void,
  onError?: (error: unknown) => void,
): Promise<void> {
  try {
    await fn();
  } catch (error) {
    onError?.(error);
  } finally {
    cleanup();
  }
}

/** Wraps an async operation with loading state management (try-catch-finally).
 *  Sets loading true before, false after, and swallows errors (optionally calling onError).
 *  `onCleanup` runs in the same finalizer as the loading reset, so a caller can
 *  release something on EVERY outcome — including a throw — without writing a
 *  `try/finally` of its own, which would bail the React Compiler out of the
 *  whole component. */
export async function executeWithLoadingState(
  fn: () => Promise<void>,
  setLoading: (value: boolean) => void,
  onError?: (error: unknown) => void,
  onCleanup?: () => void,
): Promise<void> {
  setLoading(true);
  await executeAsyncWithCleanup(
    fn,
    () => {
      setLoading(false);
      onCleanup?.();
    },
    onError,
  );
}
