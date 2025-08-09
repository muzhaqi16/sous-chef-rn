import {useCallback} from 'react';
import {useStore} from '#store';
import {useAuthErrorHandler, usePostAuthNavigation} from '../';

interface UseAuthMutationConfig<TData, TVariables> {
  mutation: any; // The actual hook from generated types
  onSuccess?: (data: TData) => void;
  onError?: (error: any) => void;
  successMessage?: string;
  errorMessage?: string;
}

export const useAuthMutation = <TData, TVariables>({
  mutation,
  onSuccess,
  onError,
  successMessage,
  errorMessage = 'Operation failed. Please try again.',
}: UseAuthMutationConfig<TData, TVariables>) => {
  const {setAuthFromResponse} = useStore();
  const {handleAuthError, handleAuthSuccess} = useAuthErrorHandler();
  const {navigateAfterAuth} = usePostAuthNavigation();

  const [mutationFn, {loading, error, data}] = mutation();

  const executeMutation = useCallback(
    async (variables: TVariables) => {
      try {
        const response = await mutationFn({
          variables,
          errorPolicy: 'all',
        });

        if (response.data) {
          onSuccess?.(response.data);
          if (successMessage) {
            handleAuthSuccess(successMessage);
          }
          return response.data;
        } else {
          throw new Error(errorMessage);
        }
      } catch (err: any) {
        onError?.(err);
        handleAuthError(err, errorMessage);
        throw err;
      }
    },
    [
      mutationFn,
      onSuccess,
      onError,
      handleAuthError,
      handleAuthSuccess,
      successMessage,
      errorMessage,
    ],
  );

  return {
    execute: executeMutation,
    loading,
    error,
    data,
  };
};
