import { ApolloClient } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { act, renderHook } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  completeMockedResponse,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useLazyHomeData } from '../useLazyHomeData';

const homesMock = () =>
  recordMock(GetHomesDocument, {
    data: {
      homes: {
        __typename: 'HomeConnection',
        edges: [
          {
            __typename: 'HomeEdge',
            node: { __typename: 'Home', id: 'home-1', name: 'Flat' },
          },
        ],
      },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLazyHomeData', () => {
  it('asks for nothing until the homes are requested', async () => {
    const homes = homesMock();
    const { result } = renderHookWithApollo(() => useLazyHomeData(), {
      operationMocks: [homes.mock],
    });

    await drainTimers();
    expect(homes.fired).toHaveLength(0);
    expect(result.current.isLoaded).toBe(false);
  });

  it('loads the homes once requested and keeps watching them', async () => {
    const homes = homesMock();
    const { result } = renderHookWithApollo(() => useLazyHomeData(), {
      operationMocks: [homes.mock],
    });

    act(() => result.current.fetchHomeData());

    await drainTimers();
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.homes.map(home => home.id)).toEqual(['home-1']);
    expect(homes.fired).toHaveLength(1);
  });

  it('asks again after a failed read', async () => {
    jest.useRealTimers();
    const failed = recordMock(GetHomesDocument, {
      error: new Error('no route to host'),
      maxUsageCount: 1,
    });
    const homes = homesMock();
    const client = new ApolloClient({
      cache: makeCache(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      link: new MockLink(
        [failed, homes].map(({ mock }) => completeMockedResponse(mock)),
      ),
    });
    const { result } = renderHook(() => useLazyHomeData(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(ApolloProvider, { client, children }),
    });
    const answered = () => client.query({ query: GetHomesDocument });

    act(() => result.current.fetchHomeData());
    await act(answered);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.state).toBe('error');

    act(() => result.current.fetchHomeData());
    await act(answered);

    expect(homes.fired).toHaveLength(1);
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.state).toBe('ready');
  });
});
