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

import { errorService } from '#/services/errorService';

/** Wraps an async mutation — returns T on success, false on failure.
 *  Pass a string for default logging, or a function for custom error handling (rollbacks, Alerts, etc.). */
export async function executeMutation<T>(
  mutationFn: () => Promise<T>,
  errorMsgOrOnError: string | ((error: unknown) => void | Promise<void>),
): Promise<T | false> {
  try {
    return await mutationFn();
  } catch (error) {
    if (typeof errorMsgOrOnError === 'function') {
      await errorMsgOrOnError(error);
    } else {
      errorService.reportError(error, { operation: errorMsgOrOnError });
    }
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
    errorService.reportError(error, { operation: errorMsg });
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
    errorService.reportError(error, { operation: errorMsg });
    return null;
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
    errorService.reportError(error, { operation: errorMsg });
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

/** Wraps an async operation with loading state management (try-catch-finally).
 *  Sets loading true before, false after, and swallows errors (optionally calling onError). */
export async function executeWithLoadingState(
  fn: () => Promise<void>,
  setLoading: (value: boolean) => void,
  onError?: (error: unknown) => void,
): Promise<void> {
  setLoading(true);
  await executeAsyncWithCleanup(fn, () => setLoading(false), onError);
}

/** Wraps an Apollo client.query() call — returns data on success, null on cancellation/failure */
export async function executeSearchQuery<TData>(
  queryFn: () => Promise<{ data?: TData }>,
  cancelled: () => boolean,
): Promise<TData | null> {
  try {
    const result = await queryFn();
    if (cancelled()) return null;
    return result.data ?? null;
  } catch {
    return null;
  }
}
