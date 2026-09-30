import React, { type ReactNode } from 'react';
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { ApolloProvider, useLazyQuery } from '@apollo/client/react';
import { act, renderHook } from '@testing-library/react-native';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';

/**
 * A lazy re-execute reuses the observable's CURRENT fetch policy, which the
 * client-wide `nextFetchPolicy: 'cache-first'` has already set after the first
 * result. `execute` takes no fetch policy (4.2), so a lookup that must reach
 * the server every time states `nextFetchPolicy: 'network-only'` on the hook.
 */
const Lookup = gql`
  query LazyLookup($code: String!) {
    lookup(code: $code)
  }
`;

function setup() {
  const requests: string[] = [];
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new ApolloLink(
      operation =>
        new Observable(observer => {
          requests.push(String(operation.variables.code));
          observer.next({ data: { lookup: 'value' } });
          observer.complete();
        }),
    ),
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
  return { requests, wrapper };
}

describe('a lazy query executed twice with the same variables', () => {
  it('answers the second from the cache under the client default', async () => {
    const { requests, wrapper } = setup();
    const { result } = renderHook(
      () => useLazyQuery(Lookup, { fetchPolicy: 'network-only' }),
      { wrapper },
    );

    await act(() => result.current[0]({ variables: { code: 'A' } }));
    await act(() => result.current[0]({ variables: { code: 'A' } }));

    expect(requests).toEqual(['A']);
  });

  it("reaches the network again with nextFetchPolicy: 'network-only'", async () => {
    const { requests, wrapper } = setup();
    const { result } = renderHook(
      () =>
        useLazyQuery(Lookup, {
          fetchPolicy: 'network-only',
          nextFetchPolicy: 'network-only',
        }),
      { wrapper },
    );

    await act(() => result.current[0]({ variables: { code: 'A' } }));
    await act(() => result.current[0]({ variables: { code: 'A' } }));

    expect(requests).toEqual(['A', 'A']);
  });
});
