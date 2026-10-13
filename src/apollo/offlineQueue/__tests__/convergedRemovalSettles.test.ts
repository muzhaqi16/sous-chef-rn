/**
 * A removal replayed after the server already applied it answers a SUCCESS
 * payload — `converged: true` and no entity — never a not-found. Drained
 * against the schema through the real queue store and failure handler, so a
 * withdrawal would show as the toast it raises.
 */
import type { InMemoryCache } from '@apollo/client';
import { useApolloClient } from '@apollo/client/react';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  clearApolloClient,
  registerApolloClient,
} from '#/apollo/clientRegistry';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { useStore } from '#store';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import { handleQueueFailure } from '../queueFailureHandler';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { QueueStatus } from '../types';

jest.mock('#store', () => ({
  useStore: { getState: jest.fn() },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
// The failure handler reads the app's client; it shares the queue's cache here.
jest.mock('#/apollo/client', () => {
  const { makeCache } = jest.requireActual('#/apollo/cache');
  return {
    client: {
      cache: makeCache(),
      refetchQueries: jest.fn(() => Promise.resolve([])),
    },
  };
});

const appClient = jest.requireMock<{
  client: { cache: InMemoryCache; refetchQueries: jest.Mock };
}>('#/apollo/client').client;

interface DeleteArgs {
  input: { id: string };
}

/** The server answering every `deleteShoppingList` with `payload`. */
function serverAnswering(payload: Record<string, unknown>) {
  const asked: string[] = [];
  const resolvers = () => ({
    Mutation: {
      deleteShoppingList: (_: unknown, { input }: DeleteArgs) => {
        asked.push(input.id);
        return payload;
      },
    },
  });
  return { resolvers, asked };
}

/** Drains a queue holding one `DeleteShoppingList` of `list-1`. */
async function drainQueuedDelete(payload: Record<string, unknown>) {
  const server = serverAnswering(payload);
  const { result } = renderHookWithApollo(() => useApolloClient(), {
    cache: appClient.cache,
    resolvers: server.resolvers,
  });
  registerApolloClient(result.current);
  queueStore.addMutation(
    makeQueuedMutation({
      id: 'delete-list-1',
      ...queuedMutationFor(DeleteShoppingListDocument),
      variables: { input: { id: 'list-1' } },
    }),
  );

  const withdraw = jest.fn(handleQueueFailure);
  const manager = new QueueManager({ retryDelayMs: 10 });
  manager.setFailureHandler(withdraw);
  jest.useFakeTimers();
  await manager.processQueue();

  return { asked: server.asked, withdraw };
}

const queued = () =>
  queueStore.getMutationsForUser('user-1').map(m => [m.id, m.status]);

describe('a queued shopping-list delete, replayed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useStore.getState as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      accessToken: 'token',
      isOnline: true,
      apiReachable: true,
      needsTokenRefresh: false,
    });
    queueStore.clearAllQueues();
    queueStore.setCurrentUserId('user-1');
  });

  afterEach(() => {
    jest.useRealTimers();
    queueStore.clearAllQueues();
    queueStore.clearCurrentUserId();
    clearApolloClient();
  });

  it('settles as applied when the server had already removed the list', async () => {
    const { asked, withdraw } = await drainQueuedDelete({
      __typename: 'DeleteShoppingListPayload',
      converged: true,
      shoppingList: null,
    });

    expect(asked).toEqual(['list-1']);
    expect(queued()).toEqual([['delete-list-1', QueueStatus.SUCCESS]]);
    expect(queueStore.getPendingMutationsForUser('user-1')).toEqual([]);
    expect(withdraw).not.toHaveBeenCalled();
    expect(toastService.error).not.toHaveBeenCalled();

    // Landed entries leave the queue once their reconciliation window passes.
    jest.advanceTimersByTime(5000);
    expect(queued()).toEqual([]);
  });

  it('is withdrawn and reported when the server refuses it', async () => {
    const { asked, withdraw } = await drainQueuedDelete({
      __typename: 'ForbiddenError',
      code: ErrorCode.Forbidden,
      message: 'Not the owner',
    });

    expect(asked).toEqual(['list-1']);
    expect(withdraw).toHaveBeenCalledTimes(1);
    expect(withdraw).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationId: 'delete-list-1',
        operationName: operationNameOf(DeleteShoppingListDocument),
        entityId: 'list-1',
      }),
    );
    expect(toastService.error).toHaveBeenCalledWith(
      "A change couldn't be saved and has been undone.",
    );
    expect(queued()).toEqual([]);
  });
});
