import {useCallback} from 'react';
import {ToastAndroid} from 'react-native';
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
        duration: ToastAndroid.SHORT,
      });
    },
    [showToast],
  );

  const handleAuthSuccess = useCallback(
    (message: string) => {
      showToast({
        type: 'success',
        message,
        duration: ToastAndroid.SHORT,
      });
    },
    [showToast],
  );

  return {handleAuthError, handleAuthSuccess};
};
