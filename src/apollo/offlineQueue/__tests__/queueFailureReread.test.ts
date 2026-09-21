/**
 * A refused queued update is withdrawn by evicting its row. The row still
 * exists on the server, so after the drain it has to be readable again in its
 * list, with the server's value rather than the refused local one.
 */
import { waitFor } from '@testing-library/react-native';
import type { ApolloClient } from '@apollo/client';
import { useApolloClient, useQuery } from '@apollo/client/react';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import {
  GetShoppingListItemsFilteredDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  handleQueueFailure,
  registerQueueFailureHandler,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { makeQueuedMutation } from '#/test-utils/queuedMutation';

const mockClientHolder: { client: ApolloClient | null } = { client: null };
jest.mock('#/apollo/client', () => ({
  get client() {
    return mockClientHolder.client;
  },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

const variables = { id: 'list-1', first: 25, isPurchased: false };

/** Only what the test reads; the helper completes the rest from the SDL. */
const serverList = {
  shoppingList: {
    id: 'list-1',
    itemsConnection: {
      totalCount: 1,
      edges: [{ cursor: 'c-1', node: { id: 'sli-1', itemName: 'Milk' } }],
    },
  },
};

const rowNames = (client: ApolloClient) =>
  client.cache
    .readQuery({ query: GetShoppingListItemsFilteredDocument, variables })
    ?.shoppingList?.itemsConnection.edges.map(edge => edge.node.itemName);

describe('withdrawing a refused queued update', () => {
  let whenIdle: jest.SpyInstance;

  beforeEach(() => {
    whenIdle = jest.spyOn(queueManager, 'whenIdle').mockResolvedValue();
  });
  afterEach(() => {
    whenIdle.mockRestore();
    mockClientHolder.client = null;
  });

  it('leaves the row readable in its list with the server value', async () => {
    const list = recordMock(GetShoppingListItemsFilteredDocument, {
      data: serverList,
    });
    const { result } = renderHookWithApollo(
      () => ({
        client: useApolloClient(),
        query: useQuery(GetShoppingListItemsFilteredDocument, { variables }),
      }),
      { operationMocks: [list.mock] },
    );
    await waitFor(() => expect(result.current.query.data).toBeDefined());
    const { client } = result.current;
    mockClientHolder.client = client;

    // The local edit the server went on to refuse.
    client.cache.modify({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: 'sli-1',
      }),
      fields: { itemName: () => 'Oat milk' },
    });
    expect(rowNames(client)).toEqual(['Oat milk']);
    const readsBefore = list.fired.length;

    handleQueueFailure({
      mutationId: 'q-1',
      operationName: operationNameOf(UpdateShoppingListItemDocument),
      entityType: 'ShoppingListItem',
      entityId: 'sli-1',
      variables: { input: { id: 'sli-1', itemName: 'Oat milk' } },
      error: {
        type: 'server',
        message: 'refused',
        code: 'VALIDATION_ERROR',
        timestamp: 0,
        retryable: false,
      },
    });

    await waitFor(() => expect(list.fired.length).toBeGreaterThan(readsBefore));
    await waitFor(() => expect(rowNames(client)).toEqual(['Milk']));
  });

  // The reread is network-only for every active query. Run while another write
  // is still queued, it replaces that write's local value with the server's
  // older one, and the person watches their change revert.
  describe('while other writes are still queued', () => {
    const refusal = () =>
      handleQueueFailure({
        mutationId: 'q-1',
        operationName: operationNameOf(UpdateShoppingListItemDocument),
        entityType: 'ShoppingListItem',
        entityId: 'sli-1',
        variables: { input: { id: 'sli-1', itemName: 'Oat milk' } },
        error: {
          type: 'server',
          message: 'refused',
          code: 'VALIDATION_ERROR',
          timestamp: 0,
          retryable: false,
        },
      });

    afterEach(() => {
      queueStore.clearAllQueues();
      queueStore.clearCurrentUserId();
    });

    it('waits, and rereads once a later pass drains the queue', async () => {
      const list = recordMock(GetShoppingListItemsFilteredDocument, {
        data: serverList,
      });
      const { result } = renderHookWithApollo(
        () => ({
          client: useApolloClient(),
          query: useQuery(GetShoppingListItemsFilteredDocument, { variables }),
        }),
        { operationMocks: [list.mock, list.mock] },
      );
      await waitFor(() => expect(result.current.query.data).toBeDefined());
      mockClientHolder.client = result.current.client;
      registerQueueFailureHandler();

      queueStore.setCurrentUserId('user-1');
      queueStore.addMutation(
        makeQueuedMutation({ id: 'still-queued', userId: 'user-1' }),
      );
      const readsBefore = list.fired.length;

      refusal();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(list.fired.length).toBe(readsBefore);

      queueStore.removeMutation('still-queued');
      queueManager['drainedHandler']?.('user-1');

      await waitFor(() =>
        expect(list.fired.length).toBeGreaterThan(readsBefore),
      );
    });
  });
});
