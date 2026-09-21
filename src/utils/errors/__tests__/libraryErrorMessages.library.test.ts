/**
 * Pins each message contract to what the INSTALLED library produces, by driving
 * the library rather than restating its wording.
 */
jest.unmock('graphql-ws');

import { ApolloClient, ApolloLink, InMemoryCache, gql } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import type { Client } from 'graphql-ws';
import { buildSchema, parse, subscribe } from 'graphql';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import {
  isNonIterableSubscriptionResolver,
  socketCloseOf,
} from '../libraryErrorMessages';

/** The error `GraphQLWsLink` emits when its client's sink receives `event`. */
const linkErrorFor = (event: unknown) =>
  new Promise<Error>(resolve => {
    const client: Client = {
      on: () => () => {},
      subscribe: (_payload, sink) => {
        sink.error(event);
        return () => {};
      },
      iterate: () => {
        throw new Error('iterate is not used by GraphQLWsLink');
      },
      terminate: () => {},
      dispose: () => {},
    };
    const apolloClient = new ApolloClient({
      cache: new InMemoryCache(),
      link: ApolloLink.empty(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    ApolloLink.execute(
      new GraphQLWsLink(client),
      {
        query: gql`
          subscription Probe {
            probe
          }
        `,
      },
      { client: apolloClient },
    ).subscribe({ error: resolve });
  });

describe('GraphQLWsLink socket-close message', () => {
  it('carries the close code', async () => {
    const error = await linkErrorFor({
      code: 4403,
      reason: 'Forbidden',
      type: 'close',
    });

    expect(socketCloseOf(error)).toEqual({ code: 4403 });
  });

  it('is bare when the failure had no CloseEvent', async () => {
    // An ErrorEvent: the socket reports CLOSED with no close frame.
    const error = await linkErrorFor({
      target: { readyState: WebSocket.CLOSED },
    });

    expect(socketCloseOf(error)).toEqual({});
  });
});

describe('graphql-js subscribe with a non-iterable resolver', () => {
  it('is recognised', async () => {
    const schema = buildSchema(
      'type Query { ok: Boolean } type Subscription { probe: Boolean }',
    );
    const error = await Promise.resolve()
      .then(() =>
        subscribe({
          schema,
          document: parse('subscription { probe }'),
          rootValue: { probe: () => true },
        }),
      )
      .then(
        () => undefined,
        (rejection: unknown) => rejection,
      );

    expect(error).toBeInstanceOf(Error);
    expect(
      isNonIterableSubscriptionResolver(
        error instanceof Error ? error : undefined,
      ),
    ).toBe(true);
  });
});
