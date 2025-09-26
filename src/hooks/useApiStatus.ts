import { useState, useEffect, useCallback } from 'react';
import { apiCircuitBreaker } from '#/apollo/links/circuitBreaker';

export interface ApiStatus {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'testing' | 'recovering';
  lastError?: string;
  failureCount: number;
  nextRetryTime?: number;
}

/**
 * Hook to monitor API connectivity status using circuit breaker
 */
export const useApiStatus = () => {
  const [status, setStatus] = useState<ApiStatus>({
    isConnected: true,
    status: 'connected',
    failureCount: 0,
  });

  const updateStatus = useCallback(() => {
    const circuitState = apiCircuitBreaker.getState();

    let newStatus: ApiStatus;

    switch (circuitState.state) {
      case 'CLOSED':
        newStatus = {
          isConnected: true,
          status: 'connected',
          failureCount: circuitState.failureCount,
        };
        break;

      case 'OPEN':
        const nextRetryTime = circuitState.lastFailureTime + 60000; // 1 minute recovery timeout
        newStatus = {
          isConnected: false,
          status: 'disconnected',
          failureCount: circuitState.failureCount,
          nextRetryTime,
          lastError: 'API endpoint unreachable',
        };
        break;

      case 'HALF_OPEN':
        newStatus = {
          isConnected: false,
          status: 'testing',
          failureCount: circuitState.failureCount,
          lastError: 'Testing API connectivity...',
        };
        break;

      default:
        newStatus = {
          isConnected: true,
          status: 'connected',
          failureCount: 0,
        };
    }

    setStatus(newStatus);
  }, []);

  // Poll circuit breaker state
  useEffect(() => {
    updateStatus();

    const interval = setInterval(updateStatus, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [updateStatus]);

  const resetConnection = useCallback(() => {
    apiCircuitBreaker.reset();
    updateStatus();
  }, [updateStatus]);

  const getStatusMessage = useCallback((): string => {
    switch (status.status) {
      case 'connected':
        return 'API connected';
      case 'disconnected':
        if (status.nextRetryTime) {
          const secondsUntilRetry = Math.max(0, Math.ceil((status.nextRetryTime - Date.now()) / 1000));
          if (secondsUntilRetry > 0) {
            return `API disconnected. Retrying in ${secondsUntilRetry}s`;
          }
        }
        return 'API disconnected';
      case 'testing':
        return 'Testing API connection...';
      case 'recovering':
        return 'API reconnecting...';
      default:
        return 'Unknown status';
    }
  }, [status]);

  return {
    ...status,
    statusMessage: getStatusMessage(),
    resetConnection,
    refresh: updateStatus,
  };
};