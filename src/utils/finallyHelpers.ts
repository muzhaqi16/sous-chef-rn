/**
 * The React Compiler SILENTLY bails out of a whole function whose body contains
 * a `finally` (or a catch-less `try`), so the finalizer lives here and the caller
 * keeps compiling. A plain `try/catch` does not bail, but its TRY BODY must stay
 * free of value blocks (`?.`, `??`, `&&`, `||`, ternary). See CLAUDE.md.
 */

/**
 * The ONLY correct way to drive a pull-to-refresh flag: Apollo's `refetch()`
 * REJECTS on a network error, so an inline set-true/await/set-false never
 * reaches the third line and the spinner hangs. The swallow is part of the
 * contract — the query's own error state already surfaces the failure.
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
 * The same finalizer for a WRITE, with `onError` REQUIRED: a mutation has no
 * second error surface, so swallowing a throw clears the spinner and reports
 * nothing. Prefer it for every write, and never widen the parameter to optional.
 */
export async function executeWriteWithFinally(
  writeFn: () => Promise<unknown>,
  setPending: (value: boolean) => void,
  onError: (error: unknown) => void,
): Promise<void> {
  setPending(true);
  await executeAsyncWithCleanup(writeFn, () => setPending(false), onError);
}

/** Catch + finally only; the caller sets its loading state. `fn` resolves to
 *  anything: `Promise<void>` would reject a `Promise<T>` callback, since the
 *  void-return exemption does not cover a `void` wrapped in a Promise. */
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

/** Loading true before, false after; errors swallowed via `onError`. `onCleanup`
 *  shares the finalizer, so a caller releases something on EVERY outcome without
 *  a `try/finally` that would bail the compiler out of the component. */
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
