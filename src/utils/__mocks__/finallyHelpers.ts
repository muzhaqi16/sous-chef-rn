/** Passthrough auto-mock — wraps every export in jest.fn() while preserving real behavior. */

export const executeRefreshWithFinally = jest.fn(
  async (
    refreshFn: () => Promise<unknown>,
    setRefreshing: (v: boolean) => void,
    onError?: (error: unknown) => void,
  ): Promise<void> => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch (error) {
      onError?.(error);
    } finally {
      setRefreshing(false);
    }
  },
);

/** `onError` is REQUIRED here, matching the real helper — see finallyHelpers.ts. */
export const executeWriteWithFinally = jest.fn(
  async (
    writeFn: () => Promise<unknown>,
    setPending: (v: boolean) => void,
    onError: (error: unknown) => void,
  ): Promise<void> => {
    setPending(true);
    try {
      await writeFn();
    } catch (error) {
      onError(error);
    } finally {
      setPending(false);
    }
  },
);

export const executeAsyncWithCleanup = jest.fn(
  async (
    fn: () => Promise<void>,
    cleanup: () => void,
    onError?: (error: unknown) => void,
  ): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      onError?.(error);
    } finally {
      cleanup();
    }
  },
);

export const executeWithLoadingState = jest.fn(
  async (
    fn: () => Promise<void>,
    setLoading: (v: boolean) => void,
    onError?: (error: unknown) => void,
  ): Promise<void> => {
    setLoading(true);
    try {
      await fn();
    } catch (error) {
      onError?.(error);
    } finally {
      setLoading(false);
    }
  },
);
