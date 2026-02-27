/**
 * Module-level try-catch wrappers for React Compiler compatibility.
 *
 * The React Compiler bails out on hooks/components that contain try-catch,
 * preventing auto-memoization of all derived values. These helpers move the
 * try-catch outside the hook body so the compiler can optimize normally.
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
