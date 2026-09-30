import { ApolloClient, gql } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import type { DocumentNode } from 'graphql';
import { QueueManager } from '#/apollo/offlineQueue/queueManager';
import { useStore } from '#store';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { completeMockedResponse } from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { ErrorCode, UnitType } from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';
import {
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';

/**
 * Offline, the edit form queues its quantity write and its field write with the
 * same captured version. On replay the first bumps the server's version, and
 * the drain moves the second onto it, so it lands rather than conflicting.
 */

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: {
    updateMutation: jest.fn(() => true),
    removeMutation: jest.fn(() => true),
    incrementRetry: jest.fn(() => true),
    markMutationFailed: jest.fn(() => true),
    getPendingMutationsForUser: jest.fn(() => []),
    getMutationsForUser: jest.fn(() => []),
    resetProcessingToPending: jest.fn(() => 0),
    expireStalePending: jest.fn(() => []),
    cleanupTerminal: jest.fn(() => []),
    getQueueStats: jest.fn(() => ({
      total: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      authErrors: 0,
    })),
    invalidateCache: jest.fn(),
  },
}));

const gqlPantryIdAndUnit = gql`
  fragment ReplaySeed on PantryItem {
    id
    pantryId
    unit {
      id
      symbol
      name
      type
    }
  }
`;

const gqlPantryName = gql`
  fragment ReplayName on PantryItem {
    id
    itemName
  }
`;

/** The fields the fake server reads off a write's input. */
function readWrite(variables: Record<string, unknown>) {
  const input = isRecord(variables.input) ? variables.input : {};
  const num = (value: unknown) =>
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : undefined;
  const str = (value: unknown) =>
    typeof value === 'string' ? value : undefined;
  return {
    version: num(input.version),
    quantity: num(input.quantity),
    storageNotes: str(input.storageNotes),
    itemName: str(input.itemName),
  };
}

/**
 * A server that bumps the version per write and refuses a stale one, answered
 * through a real client so the replay's result is normalized into the cache.
 */
function fakePantryServer() {
  const row: {
    version: number;
    quantity: number;
    storageNotes: string | null;
    itemName: string;
  } = { version: 1, quantity: 2, storageNotes: null, itemName: 'Milk' };
  const answer =
    (field: 'updatePantryItem' | 'updatePantryItemQuantity') =>
    (variables: Record<string, unknown>) => {
      const input = readWrite(variables);
      if (input.version !== undefined && input.version !== row.version) {
        return {
          data: {
            [field]: {
              __typename: 'ConflictError',
              code: ErrorCode.VersionConflict,
              message: 'Version conflict',
            },
          },
        };
      }
      if (input.quantity !== undefined) row.quantity = input.quantity;
      if (input.storageNotes !== undefined) {
        row.storageNotes = input.storageNotes;
      }
      if (input.itemName !== undefined) row.itemName = input.itemName;
      row.version += 1;
      return {
        data: {
          [field]: {
            __typename:
              field === 'updatePantryItem'
                ? 'UpdatePantryItemPayload'
                : 'UpdatePantryItemQuantityPayload',
            pantryItem: { __typename: 'PantryItem', id: 'item-1', ...row },
          },
        },
      };
    };
  const respond = (
    query: DocumentNode,
    field: 'updatePantryItem' | 'updatePantryItemQuantity',
  ) =>
    completeMockedResponse({
      request: { query, variables: () => true },
      result: answer(field),
      maxUsageCount: Number.POSITIVE_INFINITY,
    });
  const link = new MockLink([
    respond(UpdatePantryItemQuantityDocument, 'updatePantryItemQuantity'),
    respond(UpdatePantryItemDocument, 'updatePantryItem'),
  ]);
  return { row, link };
}

/** A fresh server, and a client over it whose cache holds the edited row. */
function startServer() {
  const server = fakePantryServer();
  const cache = makeCache();
  cache.writeFragment({
    id: 'PantryItem:item-1',
    fragment: gqlPantryIdAndUnit,
    data: {
      __typename: 'PantryItem',
      id: 'item-1',
      pantryId: 'pantry-1',
      unit: {
        __typename: 'Unit',
        id: 'unit-1',
        symbol: 'L',
        name: 'Liter',
        type: UnitType.Volume,
      },
    },
  });
  mockClient = new ApolloClient({
    cache,
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: server.link,
  });
  return server;
}

const cachedItemName = (): string | undefined =>
  mockClient?.cache.readFragment<{ itemName: string }>({
    id: 'PantryItem:item-1',
    fragment: gqlPantryName,
  })?.itemName;

/** Replays the entries as one drain over the queue that holds them. */
async function drain(manager: QueueManager, entries: QueuedMutation[]) {
  (queueStore.getPendingMutationsForUser as jest.Mock).mockReturnValue(entries);
  await manager.processQueue();
}

const quantityWrite = (id: string) =>
  makeQueuedMutation({
    id,
    ...queuedMutationFor(UpdatePantryItemQuantityDocument),
    variables: {
      input: {
        pantryItemId: 'item-1',
        quantity: '3',
        unitId: 'unit-1',
        version: 1,
      },
    },
  });

const fieldWrite = (id: string, fields: Record<string, unknown>) =>
  makeQueuedMutation({
    id,
    ...queuedMutationFor(UpdatePantryItemDocument),
    variables: { input: { id: 'item-1', ...fields } },
  });

describe('an offline combined edit replays without a conflict', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useStore.getState as jest.Mock).mockReturnValue({
      user: { id: 'user-1' },
      isOnline: true,
      apiReachable: true,
      accessToken: 'token',
    });
  });

  it('applies the quantity and then the notes, both from version 1', async () => {
    const server = startServer();
    const manager = new QueueManager();
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);

    await drain(manager, [
      quantityWrite('qty-1'),
      fieldWrite('notes-1', { storageNotes: 'Top shelf', version: 1 }),
    ]);

    expect(failureHandler).not.toHaveBeenCalled();
    expect(server.row).toEqual({
      version: 3,
      quantity: 3,
      storageNotes: 'Top shelf',
      itemName: 'Milk',
    });
  });

  it('applies the quantity and then a rename, both from version 1', async () => {
    const server = startServer();
    const manager = new QueueManager();
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);

    await drain(manager, [
      quantityWrite('qty-2'),
      fieldWrite('rename-1', { itemName: 'Oat milk', version: 1 }),
    ]);

    expect(failureHandler).not.toHaveBeenCalled();
    expect(server.row).toMatchObject({ quantity: 3, itemName: 'Oat milk' });
    expect(cachedItemName()).toBe('Oat milk');
  });

  it('still conflicts for a write captured at a different base version', async () => {
    const server = startServer();
    const manager = new QueueManager();
    const failureHandler = jest.fn();
    manager.setFailureHandler(failureHandler);

    await drain(manager, [
      quantityWrite('qty-3'),
      fieldWrite('rename-2', { itemName: 'Oat milk', version: 0 }),
    ]);

    expect(failureHandler).toHaveBeenCalledWith(
      expect.objectContaining({ mutationId: 'rename-2' }),
    );
    expect(server.row.itemName).toBe('Milk');
  });
});
