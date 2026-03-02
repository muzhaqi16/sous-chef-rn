/**
 * Module-level try-catch/try-finally wrappers for React Compiler compatibility.
 *
 * The React Compiler bails out on hooks/components that contain try-catch OR
 * try-finally, preventing auto-memoization of ALL derived values in that
 * component. Critically, the `react-compiler/react-compiler` ESLint rule has a
 * known bug (https://github.com/facebook/react/issues/35644) where it silently
 * stops reporting diagnostics when encountering unsupported syntax like
 * `finally` — producing zero warnings instead of flagging the bailout.
 *
 * Use the `react-hooks/todo` ESLint rule to detect these silent bailouts:
 *   npx eslint --rule '{"react-hooks/todo": "warn"}' <file>
 *
 * These helpers move the try-catch/try-finally outside the hook body so the
 * compiler can optimize normally.
 */

/** Wraps an async mutation — returns T on success, false on failure */
export async function executeMutation<T>(
  mutationFn: () => Promise<T>,
  errorMsg: string,
): Promise<T | false> {
  try {
    return await mutationFn();
  } catch (error) {
    console.error(errorMsg, error);
    return false;
  }
}

/** Wraps a sync Apollo cache update — calls refetch on failure */
export function executeCacheUpdate(
  updateFn: () => void,
  errorMsg: string,
  refetch?: () => void,
): void {
  try {
    updateFn();
  } catch (error) {
    console.warn(errorMsg, error);
    refetch?.();
  }
}

/** Wraps an async query — returns T on success, null on failure */
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  errorMsg: string,
): Promise<T | null> {
  try {
    return await queryFn();
  } catch (error) {
    console.error(errorMsg, error);
    return null;
  }
}

/** Wraps an async mutation with a custom error handler (for rollbacks, Alerts, etc.) */
export async function executeMutationWithErrorHandler<T>(
  mutationFn: () => Promise<T>,
  onError: (error: unknown) => void,
): Promise<T | false> {
  try {
    return await mutationFn();
  } catch (error) {
    onError(error);
    return false;
  }
}

/** Wraps an async refetch call */
export async function executeRefetch(
  refetchFn: () => Promise<unknown>,
  errorMsg: string,
): Promise<void> {
  try {
    await refetchFn();
  } catch (error) {
    console.warn(errorMsg, error);
  }
}

/** Wraps an async refresh with try/finally to keep setRefreshing(false) guaranteed */
export async function executeRefreshWithFinally(
  refreshFn: () => Promise<unknown>,
  setRefreshing: (value: boolean) => void,
): Promise<void> {
  setRefreshing(true);
  try {
    await refreshFn();
  } finally {
    setRefreshing(false);
  }
}

/** Wraps an async operation with loading state management (try-catch-finally).
 *  Sets loading true before, false after, and swallows errors (optionally calling onError). */
export async function executeWithLoadingState(
  fn: () => Promise<void>,
  setLoading: (value: boolean) => void,
  onError?: (error: unknown) => void,
): Promise<void> {
  setLoading(true);
  try {
    await fn();
  } catch (error) {
    onError?.(error);
  } finally {
    setLoading(false);
  }
}

/** Wraps an async operation with try-catch-finally where loading state is set externally
 *  before the call. Only provides catch + finally cleanup. */
export async function executeAsyncWithCleanup(
  fn: () => Promise<void>,
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
