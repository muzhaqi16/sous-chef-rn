/**
 * Token Refresh UI Hook
 *
 * Provides UI state management during token refresh to create
 * smooth user experience and prevent confusing loading states.
 */

import { useEffect, useState, useRef } from 'react';
import { useTokenRefreshState, tokenRefreshStateManager } from '#storage/tokenRefreshStateManager';

export interface TokenRefreshUIState {
  isRefreshing: boolean;
  showRefreshIndicator: boolean;
  shouldPreventCacheUpdates: boolean;
  refreshDuration: number | null;
  queuedOperationsCount: number;
  refreshCount: number;
}

export const useTokenRefreshUI = () => {
  const refreshState = useTokenRefreshState();
  const [showRefreshIndicator, setShowRefreshIndicator] = useState(false);
  const refreshIndicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Show refresh indicator after a short delay to avoid flashing
  useEffect(() => {
    if (refreshState.isRefreshing) {
      // Show indicator after 300ms to avoid flashing for quick refreshes
      refreshIndicatorTimeoutRef.current = setTimeout(() => {
        setShowRefreshIndicator(true);
      }, 300);
    } else {
      // Clear timeout and hide indicator immediately when refresh completes
      if (refreshIndicatorTimeoutRef.current) {
        clearTimeout(refreshIndicatorTimeoutRef.current);
        refreshIndicatorTimeoutRef.current = null;
      }
      setShowRefreshIndicator(false);
    }

    return () => {
      if (refreshIndicatorTimeoutRef.current) {
        clearTimeout(refreshIndicatorTimeoutRef.current);
      }
    };
  }, [refreshState.isRefreshing]);

  const uiState: TokenRefreshUIState = {
    isRefreshing: refreshState.isRefreshing,
    showRefreshIndicator,
    shouldPreventCacheUpdates: refreshState.isRefreshing,
    refreshDuration: tokenRefreshStateManager.getRefreshDuration(),
    queuedOperationsCount: refreshState.queuedOperations.length,
    refreshCount: refreshState.refreshCount,
  };

  return uiState;
};

/**
 * Hook to check if cache operations should be prevented
 * Simple version for use in cache-related hooks
 */
export const useShouldPreventCacheUpdates = (): boolean => {
  const refreshState = useTokenRefreshState();
  return refreshState.isRefreshing;
};

/**
 * Hook to conditionally execute cache operations
 * Returns a function that will only execute if cache updates are allowed
 */
export const useProtectedCacheOperation = () => {
  const shouldPrevent = useShouldPreventCacheUpdates();

  return <T>(operation: () => T, operationName?: string): T | null => {
    if (shouldPrevent) {
      if (operationName) {
        console.log(`🚫 Cache operation blocked during token refresh: ${operationName}`);
      }
      return null;
    }
    return operation();
  };
};

/**
 * Hook for components that want to show different UI during token refresh
 */
export const useTokenRefreshAwareUI = () => {
  const uiState = useTokenRefreshUI();

  return {
    ...uiState,
    // Helper methods for common UI patterns
    shouldShowLoadingSpinner: uiState.showRefreshIndicator,
    shouldDisableUserActions: uiState.isRefreshing,
    shouldShowStaleDataWarning: uiState.isRefreshing && uiState.refreshDuration && uiState.refreshDuration > 2000,
    getRefreshStatusMessage: () => {
      if (!uiState.isRefreshing) return null;

      if (uiState.queuedOperationsCount > 0) {
        return `Refreshing authentication... (${uiState.queuedOperationsCount} requests queued)`;
      }

      return 'Refreshing authentication...';
    },
  };
};