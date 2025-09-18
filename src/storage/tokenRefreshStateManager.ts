/**
 * Token Refresh State Manager
 *
 * Manages UI state during token refresh to prevent cache updates
 * and provide smooth user experience during authentication renewal.
 */

import { storage } from './mmkv';

const TOKEN_REFRESH_STATE_KEY = 'token_refresh_state';

export interface TokenRefreshState {
  isRefreshing: boolean;
  refreshStartTime: number | null;
  queuedOperations: string[];
  lastRefreshSuccess: boolean;
  refreshCount: number;
}

class TokenRefreshStateManager {
  private subscribers: Set<(state: TokenRefreshState) => void> = new Set();
  private currentState: TokenRefreshState = {
    isRefreshing: false,
    refreshStartTime: null,
    queuedOperations: [],
    lastRefreshSuccess: true,
    refreshCount: 0,
  };

  constructor() {
    this.loadStateFromStorage();
  }

  /**
   * Load persisted refresh state from storage
   */
  private loadStateFromStorage(): void {
    try {
      const savedState = storage.getString(TOKEN_REFRESH_STATE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Don't restore isRefreshing state on app restart
        this.currentState = {
          ...parsed,
          isRefreshing: false,
          refreshStartTime: null,
          queuedOperations: [],
        };
      }
    } catch (error) {
      console.warn('Failed to load token refresh state:', error);
    }
  }

  /**
   * Save current state to storage
   */
  private saveStateToStorage(): void {
    try {
      storage.set(TOKEN_REFRESH_STATE_KEY, JSON.stringify(this.currentState));
    } catch (error) {
      console.warn('Failed to save token refresh state:', error);
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: TokenRefreshState) => void): () => void {
    this.subscribers.add(callback);
    // Immediately call with current state
    callback(this.currentState);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.currentState));
  }

  /**
   * Get current state
   */
  getState(): TokenRefreshState {
    return { ...this.currentState };
  }

  /**
   * Start token refresh process
   */
  startRefresh(): void {
    this.currentState = {
      ...this.currentState,
      isRefreshing: true,
      refreshStartTime: Date.now(),
      queuedOperations: [],
      refreshCount: this.currentState.refreshCount + 1,
    };
    this.saveStateToStorage();
    this.notifySubscribers();
  }

  /**
   * Add operation to queue during refresh
   */
  queueOperation(operationName: string): void {
    if (this.currentState.isRefreshing) {
      this.currentState.queuedOperations.push(operationName);
      this.notifySubscribers();
    }
  }

  /**
   * Complete token refresh process
   */
  completeRefresh(success: boolean): void {
    const refreshDuration = this.currentState.refreshStartTime
      ? Date.now() - this.currentState.refreshStartTime
      : 0;

    this.currentState = {
      ...this.currentState,
      isRefreshing: false,
      refreshStartTime: null,
      queuedOperations: [],
      lastRefreshSuccess: success,
    };
    this.saveStateToStorage();
    this.notifySubscribers();
  }

  /**
   * Check if currently refreshing
   */
  isRefreshing(): boolean {
    return this.currentState.isRefreshing;
  }

  /**
   * Check if cache updates should be blocked
   */
  shouldBlockCacheUpdates(): boolean {
    return this.currentState.isRefreshing;
  }

  /**
   * Get refresh duration if currently refreshing
   */
  getRefreshDuration(): number | null {
    if (!this.currentState.isRefreshing || !this.currentState.refreshStartTime) {
      return null;
    }
    return Date.now() - this.currentState.refreshStartTime;
  }

  /**
   * Clear all state (useful for testing or manual reset)
   */
  reset(): void {
    this.currentState = {
      isRefreshing: false,
      refreshStartTime: null,
      queuedOperations: [],
      lastRefreshSuccess: true,
      refreshCount: 0,
    };
    this.saveStateToStorage();
    this.notifySubscribers();
  }

  /**
   * Get statistics for debugging
   */
  getDebugInfo() {
    return {
      ...this.currentState,
      refreshDuration: this.getRefreshDuration(),
      subscriberCount: this.subscribers.size,
    };
  }
}

// Export singleton instance
export const tokenRefreshStateManager = new TokenRefreshStateManager();

// Export hook for React components
export const useTokenRefreshState = () => {
  const [state, setState] = React.useState<TokenRefreshState>(
    tokenRefreshStateManager.getState()
  );

  React.useEffect(() => {
    return tokenRefreshStateManager.subscribe(setState);
  }, []);

  return state;
};

// React import (will be available in RN)
import React from 'react';