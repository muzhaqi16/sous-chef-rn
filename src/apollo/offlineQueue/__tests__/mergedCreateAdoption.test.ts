/**
 * Writes still queued behind a replay are moved onto what the server answered:
 * the version an edit returned, and the row a merged create survives as. Both
 * are written to the queue itself, so a restart mid-drain keeps them.
 */
import { makeCache } from '#/apollo/cache';
import { storage } from '#storage/mmkv';
import { useStore } from '#store';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  CreatePantryItemDocument,
  UpdatePantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn(),
  },
}));

const mockClient = { mutate: jest.fn(), query: jest.fn(), cache: makeCache() };
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

// Within the queue's 90-day horizon, in the order the writes were made.
const NOW = Date.now();

const pantryItemPayload = (id: string, version: number) => ({
  __typename: 'UpdatePantryItemPayload',
  pantryItem: { __typename: 'PantryItem', id, version },
});

const sentInputs = () =>
  mockClient.mutate.mock.calls.map(
    ([options]: [{ variables: { input: unknown } }]) => options.variables.input,
  );

beforeEach(() => {
  jest.clearAllMocks();
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  mockClient.cache = makeCache();
  (useStore.getState as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    isOnline: true,
    apiReachable: true,
    accessToken: 'token',
  });
});

describe('writes queued behind a replay', () => {
  it('are sent at the version the replay returned, and keep it in the queue', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'rename',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'row-1', itemName: 'Oat milk', version: 2 } },
        createdAt: NOW,
      }),
    );
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'note',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: 'row-1', storageNotes: 'Top', version: 2 } },
        createdAt: NOW + 1,
      }),
    );
    mockClient.mutate
      .mockResolvedValueOnce({
        data: { updatePantryItem: pantryItemPayload('row-1', 3) },
      })
      .mockImplementationOnce(() => {
        // Read back as a restart would: the move is in the queue itself.
        queueStore.invalidateCache();
        expect(queueStore.getMutation('note')?.variables.input).toMatchObject({
          version: 3,
        });
        return Promise.resolve({
          data: { updatePantryItem: pantryItemPayload('row-1', 4) },
        });
      });

    await new QueueManager().processQueue();

    expect(sentInputs()).toEqual([
      expect.objectContaining({ itemName: 'Oat milk', version: 2 }),
      expect.objectContaining({ storageNotes: 'Top', version: 3 }),
    ]);
  });

  it('move to the row a merged create survives as, at its version', async () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'create',
        ...queuedMutationFor(CreatePantryItemDocument),
        variables: {
          input: {
            id: 'minted-1',
            pantryId: 'pantry-1',
            item: { inline: { name: 'Milk' } },
            quantity: 1,
          },
        },
        createdAt: NOW,
      }),
    );
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'rename',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: {
          input: { id: 'minted-1', itemName: 'Oat milk', version: 1 },
        },
        createdAt: NOW + 1,
      }),
    );
    mockClient.mutate
      .mockResolvedValueOnce({
        data: {
          createPantryItem: {
            __typename: 'CreatePantryItemPayload',
            outcome: 'MERGED',
            pantryItem: {
              __typename: 'PantryItem',
              id: 'surviving-1',
              version: 5,
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { updatePantryItem: pantryItemPayload('surviving-1', 6) },
      });

    await new QueueManager().processQueue();

    expect(sentInputs()).toEqual([
      expect.objectContaining({ id: 'minted-1', forceAdd: true }),
      { id: 'surviving-1', itemName: 'Oat milk', version: 5 },
    ]);
  });
});
