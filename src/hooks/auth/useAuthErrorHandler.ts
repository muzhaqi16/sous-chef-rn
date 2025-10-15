// ============================================
// hooks/auth/useAuthErrorHandler.ts
// Keep existing error handler with minor updates
// ============================================

import {useCallback} from 'react';
import {ToastAndroid, Platform} from 'react-native';
import {useToast} from '../useToast';

export const useAuthErrorHandler = () => {
  const showToast = useToast();

  const handleAuthError = useCallback(
    (error: any, defaultMessage: string) => {
      const errorMessage =
        error?.message ||
        error?.graphQLErrors?.[0]?.message ||
        error?.networkError?.message ||
        defaultMessage;

      showToast({
        type: 'error',
        message: errorMessage,
        duration: Platform.OS === 'android' ? ToastAndroid.SHORT : 3000,
      });
    },
    [showToast],
  );

  const handleAuthSuccess = useCallback(
    (message: string) => {
      showToast({
        type: 'success',
        message,
        duration: Platform.OS === 'android' ? ToastAndroid.SHORT : 3000,
      });
    },
    [showToast],
  );

  return {handleAuthError, handleAuthSuccess};
};
