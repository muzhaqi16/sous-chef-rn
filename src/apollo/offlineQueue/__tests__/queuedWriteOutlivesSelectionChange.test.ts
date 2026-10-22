import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { print } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { storage } from '#/store/deviceStorage';
import {
  completeMockedResponse,
  recordMock,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { hasReplayPreparation } from '../prepareReplay';
import { QueueManager } from '../queueManager';
import { QueueStore } from '../queueStore';

/**
 * A change queued by one build replays after an update that widened the
 * mutation's selection (a readers fragment gaining a field): the queue sends
 * this build's document for the operation, and the server's answer to it
 * lands in the cache.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

// What an earlier build sent for the same operation: a narrower selection.
const PREVIOUS_BUILD_UPDATE_HOME = gql`
  mutation UpdateHome($input: UpdateHomeInput!) {
    updateHome(input: $input) {
      __typename
      ... on UpdateHomePayload {
        home {
          id
          name
        }
      }
      ... on Error {
        code
        message
      }
    }
  }
`;

const HOME_NAME = gql`
  fragment QueuedHomeName on Home {
    id
    name
  }
`;

const homeId = (client: ApolloClient) =>
  client.cache.identify({ __typename: 'Home', id: 'home-1' });

let update: RecordedMock;

beforeEach(() => {
  storage.clearAll();
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'Home', id: 'home-1' }),
    fragment: HOME_NAME,
    data: { __typename: 'Home', id: 'home-1', name: 'Before' },
  });
  update = recordMock(UpdateHomeDocument, {
    data: {
      updateHome: {
        __typename: 'UpdateHomePayload',
        home: { __typename: 'Home', id: 'home-1', name: 'After' },
      },
    },
  });
  mockClient = new ApolloClient({
    cache,
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new MockLink([completeMockedResponse(update.mock)]),
  });
});

it('the fixture is an older selection of an operation with no replay preparation', () => {
  expect(print(PREVIOUS_BUILD_UPDATE_HOME)).not.toBe(print(UpdateHomeDocument));
  expect(hasReplayPreparation(operationNameOf(UpdateHomeDocument))).toBe(false);
});

it('replays this build’s document after a restart and applies the answer', async () => {
  const store = new QueueStore();
  store.setCurrentUserId('user-1');
  store.addMutation(
    makeQueuedMutation({
      id: 'queued-before-update',
      ...queuedMutationFor(PREVIOUS_BUILD_UPDATE_HOME),
      variables: { input: { id: 'home-1', name: 'After' } },
    }),
  );
  // The next launch reads the queue back from storage, not from memory.
  store.invalidateCache();
  const reloaded = store.getMutation('queued-before-update');
  if (!reloaded || !mockClient)
    throw new Error('queued entry was not persisted');
  expect(reloaded.mutation).toBe(UpdateHomeDocument);

  await new QueueManager()['executeMutation'](reloaded);

  expect(update.fired).toEqual([{ input: { id: 'home-1', name: 'After' } }]);
  expect(
    mockClient.cache.readFragment<{ name: string }>({
      id: homeId(mockClient),
      fragment: HOME_NAME,
    })?.name,
  ).toBe('After');
});
