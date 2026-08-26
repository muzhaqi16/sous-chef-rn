/** Passthrough auto-mock — wraps every export in jest.fn() while preserving real behavior. */

import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '../errors/graphqlErrors';

export const executeRefreshWithFinally = jest.fn(
  async (
    refreshFn: () => Promise<unknown>,
    setRefreshing: (v: boolean) => void,
    onError?: (error: unknown) => void,
  ): Promise<void> => {
    setRefreshing(true);
    try {
      await refreshFn();
    } catch (error) {
      onError?.(error);
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

export const unwrapPayload = jest.fn(
  <TUnion extends { __typename: string }, TName extends TUnion['__typename']>(
    payload: TUnion | null | undefined,
    successTypename: TName,
    fallbackMessage: string,
  ): Extract<TUnion, { __typename: TName }> => {
    if (payload == null) {
      throw new GraphQLNetworkError(fallbackMessage);
    }
    if (payload.__typename === successTypename) {
      return payload as Extract<TUnion, { __typename: TName }>;
    }
    const { __typename, code, message, ...extra } = payload as Record<
      string,
      unknown
    > & { __typename: string };
    throw new GraphQLDomainError({
      __typename,
      code: String(code ?? 'UNKNOWN'),
      message: String(message || fallbackMessage),
      ...extra,
    });
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

export const isSuccessPayload = jest.fn(
  <TUnion extends { __typename: string }, TName extends TUnion['__typename']>(
    payload: TUnion | null | undefined,
    successTypename: TName,
  ): payload is Extract<TUnion, { __typename: TName }> => {
    return payload != null && payload.__typename === successTypename;
  },
);
