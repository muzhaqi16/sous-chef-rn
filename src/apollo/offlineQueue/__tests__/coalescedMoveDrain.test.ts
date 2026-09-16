/**
 * A drag queued offline as [move A after Y, create X], then moved again after
 * X, drains the create before the move. In the first move's slot, "after X"
 * reaches the server before X exists and is refused.
 */
import { useApolloClient } from '@apollo/client/react';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { queuedMutationFor } from '#/test-utils/queuedMutation';
import {
  clearApolloClient,
  registerApolloClient,
} from '#/apollo/clientRegistry';
import { useStore } from '#store';
import { ErrorCode, SyncOperation } from '#/graphql/generated/schemaTypes';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { QueueStatus, type QueuedMutation } from '../types';

jest.mock('#store', () => ({
  useStore: { getState: jest.fn() },
}));

interface SyncArgs {
  input: { clientId: string; afterId?: string | null };
}

/** The server: rows it holds, and each sync in the order it arrived. */
function serverResolvers(existingIds: string[]) {
  const rows = new Set(existingIds);
  const arrivals: string[] = [];
  const payload = (clientId: string, operation: SyncOperation) => ({
    __typename: 'SyncShoppingListItemPayload',
    clientId,
    serverId: clientId,
    operation,
    converged: false,
    conflict: null,
    item: { __typename: 'ShoppingListItem', id: clientId },
  });
  const resolvers = () => ({
    Mutation: {
      syncShoppingListItem: (_: unknown, { input }: SyncArgs) => {
        arrivals.push(`create ${input.clientId}`);
        rows.add(input.clientId);
        return payload(input.clientId, SyncOperation.Create);
      },
      syncMoveShoppingListItem: (_: unknown, { input }: SyncArgs) => {
        arrivals.push(`move ${input.clientId} after ${input.afterId}`);
        if (input.afterId && !rows.has(input.afterId)) {
          return {
            __typename: 'NotFoundError',
            code: ErrorCode.NotFound,
            message: 'Anchor item not found',
            resource: 'ShoppingListItem',
            resourceId: input.afterId,
          };
        }
        return payload(input.clientId, SyncOperation.Move);
      },
    },
  });
  return { resolvers, arrivals };
}

const entry = (
  id: string,
  fields: Pick<QueuedMutation, 'operationName' | 'mutation' | 'variables'>,
): QueuedMutation => ({
  id,
  userId: 'user-1',
  status: QueueStatus.PENDING,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  retryCount: 0,
  maxRetries: 3,
  requiresAuth: true,
  ...fields,
});

const moveAfter = (id: string, afterItemId: string) =>
  entry(id, {
    ...queuedMutationFor(MoveShoppingListItemDocument),
    variables: { input: { itemId: 'item-A', afterItemId } },
  });

describe('a coalesced move drained against the schema', () => {
  beforeEach(() => {
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
    queueStore.clearAllQueues();
    queueStore.clearCurrentUserId();
    clearApolloClient();
  });

  it('creates the anchor before the move that names it, and the move lands', async () => {
    const server = serverResolvers(['item-A', 'item-Y']);
    const { result } = renderHookWithApollo(() => useApolloClient(), {
      resolvers: server.resolvers,
    });
    registerApolloClient(result.current);

    queueStore.addMutation(moveAfter('move-1', 'item-Y'));
    queueStore.addMutation(
      entry('create-x', {
        ...queuedMutationFor(AddItemToShoppingListDocument),
        variables: {
          input: {
            shoppingListId: 'list-1',
            items: [{ id: 'item-X', item: { itemName: 'Eggs' } }],
          },
        },
      }),
    );
    queueStore.addMutation(moveAfter('move-2', 'item-X'));

    await new QueueManager({ retryDelayMs: 10 }).processQueue();

    expect(server.arrivals).toEqual([
      'create item-X',
      'move item-A after item-X',
    ]);
    const statuses = queueStore
      .getMutationsForUser('user-1')
      .map(m => [m.id, m.status]);
    expect(statuses).toEqual([
      ['create-x', QueueStatus.SUCCESS],
      ['move-2', QueueStatus.SUCCESS],
    ]);
  });
});
