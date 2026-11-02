import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { useFinishedCapture } from '../useFinishedCapture';
import { RecipeCaptureDocument } from '../useRecipeCapture.generated';

const VARIABLES = { id: 'capture-1' };

function failingClient() {
  const requests = jest.fn();
  const client = new ApolloClient({
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new ApolloLink(
      () =>
        new Observable(observer => {
          requests();
          observer.error(new Error('no route to host'));
        }),
    ),
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
  return { client, requests, wrapper };
}

describe('useFinishedCapture', () => {
  it('says the capture could not be read, rather than holding no draft', async () => {
    const { client, requests, wrapper } = failingClient();
    const { result } = renderHook(() => useFinishedCapture('capture-1'), {
      wrapper,
    });

    await act(() =>
      client
        .query({ query: RecipeCaptureDocument, variables: VARIABLES })
        .catch(() => undefined),
    );

    expect(result.current.capture).toBeNull();
    expect(result.current.state).toBe('error');

    const asked = requests.mock.calls.length;
    act(() => result.current.retry());

    expect(requests.mock.calls.length).toBeGreaterThan(asked);
  });

  it('reads nothing, and fails nothing, with no capture named', () => {
    const { requests, wrapper } = failingClient();

    const { result } = renderHook(() => useFinishedCapture(undefined), {
      wrapper,
    });

    expect(requests).not.toHaveBeenCalled();
    expect(result.current.state).toBe('empty');
  });
});
