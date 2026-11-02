/**
 * The app has one client for its whole life, so what a session end leaves of it
 * is what the next session runs on. Run on a real client and manager: a mock of
 * either cannot show what `stop()` disconnects.
 */
import {
  ApolloClient,
  ApolloLink,
  Observable,
  RefetchEventManager,
  gql,
} from '@apollo/client';
import { ApolloProvider, skipToken, useQuery } from '@apollo/client/react';
import { act, renderHook } from '@testing-library/react-native';
import { createElement } from 'react';
import { Subject } from 'rxjs';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  clearApolloClient,
  registerApolloClient,
} from '#/apollo/clientRegistry';
import { seedQuery } from '#/test-utils/apolloMockProvider';
import { LogoutCleanup } from '../logoutCleanup';

const QUERY = gql`
  query Held {
    me {
      id
    }
  }
`;

const answering = (id: string) => ({ me: { __typename: 'User', id } });

type Answer = (data: ReturnType<typeof answering>) => void;

function setup() {
  const foreground = new Subject<void>();
  const handled = jest.fn();
  const manager = new RefetchEventManager({ defaultHandler: handled });
  const held: Answer[] = [];
  let holding = false;
  let arrive = () => {};
  const reached = new Promise<void>(resolve => {
    arrive = resolve;
  });
  const link = new ApolloLink(
    () =>
      new Observable(observer => {
        const answer: Answer = data => {
          observer.next({ data });
          observer.complete();
        };
        if (holding) {
          held.push(answer);
          arrive();
        } else {
          answer(answering('answer'));
        }
      }),
  );
  const cache = makeCache();
  const client = new ApolloClient({
    cache,
    link,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    refetchEventManager: manager,
  });
  manager.setEventSource('appForeground', () => foreground);
  registerApolloClient(client);
  return {
    client,
    cache,
    handled,
    foreground,
    held,
    reached,
    hold: () => {
      holding = true;
    },
  };
}

afterEach(() => clearApolloClient());

describe('a session end', () => {
  it('leaves resync connected for the next session', async () => {
    const { foreground, handled } = setup();

    await LogoutCleanup.performLogoutCleanup();
    foreground.next();

    expect(handled).toHaveBeenCalledTimes(1);
  });

  // Reads above navigation stand down on `skipToken` with no user. `clearStore`
  // drops a read still watching, so this is the path that has to come back.
  it('leaves a read held above the screens answering the next session', async () => {
    const { client } = setup();
    let onRender: (data: unknown) => void = () => {};
    const { result, rerender } = renderHook(
      ({ signedIn }: { signedIn: boolean }) => {
        const read = useQuery(QUERY, signedIn ? {} : skipToken);
        onRender(read.data);
        return read;
      },
      {
        initialProps: { signedIn: true },
        wrapper: ({ children }) =>
          createElement(ApolloProvider, { client, children }),
      },
    );
    await act(() => client.query({ query: QUERY }));

    rerender({ signedIn: false });
    await act(() => LogoutCleanup.performLogoutCleanup());
    rerender({ signedIn: true });
    await act(() => client.query({ query: QUERY }));
    expect(result.current.data).toEqual(answering('answer'));

    const next = answering('next');
    await act(
      () =>
        new Promise<void>(resolve => {
          onRender = data => {
            if (JSON.stringify(data) === JSON.stringify(next)) resolve();
          };
          seedQuery(client.cache, { query: QUERY, data: next });
        }),
    );

    expect(result.current.data).toEqual(next);
  });

  it('lets no answer in flight reach the next session', async () => {
    const { client, held, hold, reached } = setup();
    hold();
    const asked = client
      .query({ query: QUERY, fetchPolicy: 'network-only' })
      .catch(() => undefined);
    await reached;

    await LogoutCleanup.performLogoutCleanup();
    held.forEach(answer => answer(answering('the last session')));
    await asked;

    expect(client.readQuery({ query: QUERY })).toBeNull();
  });
});
