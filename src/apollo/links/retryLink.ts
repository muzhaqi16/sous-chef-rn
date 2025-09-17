import { RetryLink } from '@apollo/client/link/retry';
import NetInfo from '@react-native-community/netinfo';

// Optimized RetryLink with exponential backoff and retry limits
export const retryLink = new RetryLink({
  attempts: {
    // Limit retries to prevent infinite loops and resource drain
    max: 5, // Maximum 5 retry attempts
    // only retry if:
    //  • there's a network error
    //  • AND the device is currently online
    //  • Auth errors (401, 403) are allowed to retry (handled by errorLink refresh logic)
    retryIf: (error, _operation) => {
      const isNetworkError = !!error && !!(error as any).networkError;
      if (!isNetworkError) return false;

      const statusCode = ((error as any).networkError as any)?.statusCode;

      // Allow retries for auth errors (401, 403) - they'll be handled by errorLink refresh logic
      if (statusCode === 401 || statusCode === 403) return true;

      // Don't retry other client errors (4xx)
      if (statusCode >= 400 && statusCode < 500) return false;

      // Check if device is online before retrying
      return NetInfo.fetch().then(state => state.isConnected ?? false);
    },
  },
  delay: {
    initial: 300, // Start with 300ms
    max: 30000, // Cap at 30 seconds (instead of infinity)
    jitter: true, // Add randomization to prevent thundering herd
  },
});
