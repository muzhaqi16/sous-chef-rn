/** Passthrough auto-mock — wraps every export in jest.fn() while preserving real behavior. */

export const executeMutation = jest.fn(
  async <T>(
    mutationFn: () => Promise<T>,
    errorMsgOrOnError: string | ((error: unknown) => void),
  ): Promise<T | false> => {
    try {
      return await mutationFn();
    } catch (error) {
      if (typeof errorMsgOrOnError === 'function') {
        errorMsgOrOnError(error);
      }
      return false;
    }
  },
);

export const executeCacheUpdate = jest.fn(
  (updateFn: () => void, _errorMsg: string, refetch?: () => void): void => {
    try {
      updateFn();
    } catch {
      refetch?.();
    }
  },
);

export const executeQuery = jest.fn(
  async <T>(
    queryFn: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      return await queryFn();
    } catch {
      return null;
    }
  },
);

export const executeRefetch = jest.fn(
  async (
    refetchFn: () => Promise<unknown>,
  ): Promise<void> => {
    try {
      await refetchFn();
    } catch {
      // swallow
    }
  },
);

export const executeRefreshWithFinally = jest.fn(
  async (
    refreshFn: () => Promise<unknown>,
    setRefreshing: (v: boolean) => void,
  ): Promise<void> => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
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
