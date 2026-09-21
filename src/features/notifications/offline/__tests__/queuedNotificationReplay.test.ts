import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import type { DocumentNode } from 'graphql';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { completeMockedResponse } from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import { DeleteMultipleNotificationsDocument } from '#features/notifications/graphql/bulkNotificationMutations.generated';
import { ErrorCode, NotificationStatus } from '#/graphql/generated/schemaTypes';
import { QueueManager } from '#/apollo/offlineQueue/queueManager';
import { isRecord } from '#/utils/isRecord';

/**
 * A notification action queued offline replays its own document through a real
 * client, so what the server answers is what lands in the cache.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const NOTIFICATION = gql`
  fragment _ReplayNotification on Notification {
    id
    status
  }
`;

// The document's selection is completed from the SDL, as the server answers it.
const replayClient = (
  query: DocumentNode,
  data: Record<string, unknown>,
): ApolloClient => {
  const response: MockLink.MockedResponse = {
    request: { query, variables: () => true },
    result: { data },
  };
  return new ApolloClient({
    cache: makeCache(),
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new MockLink([completeMockedResponse(response)]),
  });
};

const cachedNotifications = (client: ApolloClient): string[] => {
  const snapshot: unknown = client.cache.extract();
  return Object.keys(isRecord(snapshot) ? snapshot : {}).filter(key =>
    key.startsWith('Notification:'),
  );
};

describe('a queued notification delete', () => {
  it('leaves no record of the notification once replayed', async () => {
    mockClient = replayClient(DeleteNotificationDocument, {
      deleteNotification: {
        __typename: 'DeleteNotificationPayload',
      },
    });

    await new QueueManager()['executeMutation'](
      makeQueuedMutation({
        ...queuedMutationFor(DeleteNotificationDocument),
        variables: { input: { id: 'n1' } },
      }),
    );

    expect(cachedNotifications(mockClient)).toEqual([]);
  });

  it('leaves no record of a cleared batch once replayed', async () => {
    mockClient = replayClient(DeleteMultipleNotificationsDocument, {
      deleteMultipleNotifications: {
        __typename: 'DeleteMultipleNotificationsPayload',
        summary: { __typename: 'BulkSummary', total: 2 },
      },
    });

    await new QueueManager()['executeMutation'](
      makeQueuedMutation({
        ...queuedMutationFor(DeleteMultipleNotificationsDocument),
        variables: { input: { ids: ['n1', 'n2'] } },
      }),
    );

    expect(cachedNotifications(mockClient)).toEqual([]);
  });
});

describe('a queued mark-read of a notification deleted elsewhere', () => {
  it('removes the row and reports nothing', async () => {
    mockClient = replayClient(MarkNotificationAsReadDocument, {
      markNotificationAsRead: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'gone',
        resource: 'Notification',
        resourceId: 'n1',
      },
    });
    mockClient.cache.writeFragment({
      id: 'Notification:n1',
      fragment: NOTIFICATION,
      data: {
        __typename: 'Notification',
        id: 'n1',
        status: NotificationStatus.Read,
      },
    });
    const manager = new QueueManager();
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);
    const entry = makeQueuedMutation({
      ...queuedMutationFor(MarkNotificationAsReadDocument),
      variables: { input: { id: 'n1' } },
    });

    const result = await manager['processMutation'](entry);

    expect(result.success).toBe(true);
    expect(failureHandler).not.toHaveBeenCalled();
    expect(cachedNotifications(mockClient)).toEqual([]);
  });
});
