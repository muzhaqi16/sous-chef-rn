import { useStore } from '#store';
import { useCallback, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  context?: string;
  cancelable?: boolean;
}

/**
 * Global loading state management hook
 */
export const useGlobalLoading = () => {
  const loadingState = useStore(state => state.globalLoading);
  const setGlobalLoading = useStore(state => state.setGlobalLoading);
  const clearGlobalLoading = useStore(state => state.clearGlobalLoading);

  const showLoading = useCallback((
    message?: string,
    options?: {
      context?: string;
      cancelable?: boolean;
    }
  ) => {
    setGlobalLoading({
      isLoading: true,
      message,
      context: options?.context,
      cancelable: options?.cancelable ?? false,
    });
  }, [setGlobalLoading]);

  const hideLoading = useCallback(() => {
    clearGlobalLoading();
  }, [clearGlobalLoading]);

  const updateMessage = useCallback((message: string) => {
    if (loadingState.isLoading) {
      setGlobalLoading({
        ...loadingState,
        message,
      });
    }
  }, [loadingState, setGlobalLoading]);

  return {
    loadingState,
    showLoading,
    hideLoading,
    updateMessage,
    isLoading: loadingState.isLoading,
  };
};

/**
 * Specialized loading hooks for different contexts
 */

// Authentication loading
export const useAuthLoading = () => {
  const { showLoading, hideLoading, isLoading } = useGlobalLoading();

  const showAuthLoading = useCallback((message: string = 'Authenticating...') => {
    showLoading(message, { context: 'auth' });
  }, [showLoading]);

  return {
    showAuthLoading,
    hideAuthLoading: hideLoading,
    isAuthLoading: isLoading,
  };
};

// Navigation loading
export const useNavigationLoading = () => {
  const { showLoading, hideLoading, isLoading } = useGlobalLoading();

  const showNavigationLoading = useCallback((message: string = 'Loading...') => {
    showLoading(message, { context: 'navigation' });
  }, [showLoading]);

  return {
    showNavigationLoading,
    hideNavigationLoading: hideLoading,
    isNavigationLoading: isLoading,
  };
};

// Biometric loading
export const useBiometricLoading = () => {
  const { showLoading, hideLoading, isLoading } = useGlobalLoading();

  const showBiometricLoading = useCallback((message: string = 'Waiting for authentication...') => {
    showLoading(message, { context: 'biometric', cancelable: true });
  }, [showLoading]);

  return {
    showBiometricLoading,
    hideBiometricLoading: hideLoading,
    isBiometricLoading: isLoading,
  };
};

/**
 * Auto-timeout hook for loading states
 */
export const useLoadingTimeout = (timeoutMs: number = 30000) => {
  const { isLoading, hideLoading } = useGlobalLoading();

  useEffect(() => {
    if (!isLoading) return;

    const timeout = setTimeout(() => {
      console.warn('Loading timeout reached, automatically hiding loading');
      hideLoading();
    }, timeoutMs);

    return () => clearTimeout(timeout);
  }, [isLoading, hideLoading, timeoutMs]);
};

/**
 * Hook for sequential loading operations
 */
export const useSequentialLoading = () => {
  const { hideLoading, updateMessage } = useGlobalLoading();

  const runSequentialOperations = useCallback(async (
    operations: Array<{
      message: string;
      operation: () => Promise<any>;
    }>
  ) => {
    try {
      for (let i = 0; i < operations.length; i++) {
        const { message, operation } = operations[i];
        updateMessage(`${message} (${i + 1}/${operations.length})`);
        await operation();
      }
    } finally {
      hideLoading();
    }
  }, [hideLoading, updateMessage]);

  return { runSequentialOperations };
};