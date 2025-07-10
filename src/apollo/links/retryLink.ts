import {RetryLink} from '@apollo/client/link/retry';
import NetInfo from '@react-native-community/netinfo';

// 1) A RetryLink that only retries on network errors—and only when NetInfo says we're online
export const retryLink = new RetryLink({
  attempts: {
    // allow infinite retries
    max: Infinity,
    // only retry if:
    //  • there's a network error
    //  • AND the device is currently online
    retryIf: (error, _operation) => {
      const isNetworkError = !!error && !!error.networkError;
      if (!isNetworkError) return false;
      // NetInfo.fetch() returns a Promise<boolean>
      return NetInfo.fetch().then(state => state.isConnected ?? false);
    },
  },
  delay: {
    initial: 300, // wait 300ms before first retry
    max: Infinity, // keep retrying forever
    jitter: true,
  },
});
