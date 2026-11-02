import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { Telemetry } from '#/services/telemetry';
import { toastService } from '#/services/toastService';
import { storage } from '#/store/deviceStorage';
import {
  completeMockedResponse,
  recordMock,
  seedFragment,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { useStore } from '#store';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  PantryItemConflict_PantryItemFragmentDoc,
  PantryItemForConflictDocument,
  type PantryItemConflict_PantryItemFragment,
} from '#features/pantry/offline/pantryItemConflict.generated';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { registerQueueFailureHandler } from '../queueFailureHandler';
import { createQueueLink } from '../queueLink';
import { queueManager } from '../queueManager';
import { queueStore } from '../queueStore';

/**
 * A local-first write is on the device before it goes out, so losing the app
 * while it is on its way loses nothing. On a real client, cache, link and queue:
 * a "restart" is a new client over what storage holds.
 */

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const USER = {
  id: 'user-1',
  email: 'test@souschef.dev',
  emailVerified: true,
  onBoarded: true,
};
const ITEM_ID = 'item-1';
const ROW = {
  __typename: 'PantryItem',
  id: ITEM_ID,
  version: 3,
  itemName: 'Milk',
  storageNotes: 'top shelf',
} as const;

/** A link no request gets past, as a connection the app dies on. */
function lostConnection() {
  let arrive = () => {};
  const reached = new Promise<void>(resolve => {
    arrive = resolve;
  });
  const link = new ApolloLink(
    () =>
      new Observable(() => {
        arrive();
      }),
  );
  return { link, reached };
}

function clientOver(link: ApolloLink): ApolloClient {
  const cache = makeCache();
  seedFragment(cache, {
    id: cache.identify({ __typename: 'PantryItem', id: ITEM_ID }),
    fragment: PantryItemConflict_PantryItemFragmentDoc,
    data: ROW,
  });
  const client = new ApolloClient({
    cache,
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([createQueueLink(), link]),
  });
  mockClient = client;
  return client;
}

const answering = (...answers: RecordedMock[]) =>
  new MockLink(answers.map(({ mock }) => completeMockedResponse(mock)));

function editNotes(client: ApolloClient) {
  return pendingWritesOf(client.cache).send(
    UpdatePantryItemDocument,
    {
      input: { id: ITEM_ID, version: 3, storageNotes: 'my notes' },
      today: '2026-11-01',
    },
    write =>
      settleMutation(
        () => client.mutate({ mutation: UpdatePantryItemDocument, ...write }),
        { document: UpdatePantryItemDocument, fallback: 'failed' },
      ),
    {
      entity: { __typename: 'PantryItem', id: ITEM_ID },
      fields: { storageNotes: 'my notes' },
    },
  );
}

/** The app is gone: only storage is left, and the next launch reads it. */
function restart(link: ApolloLink): ApolloClient {
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  const client = clientOver(link);
  pendingWritesOf(client.cache).restore(queueStore.getPendingWrites());
  return client;
}

const shownRow = (client: ApolloClient) =>
  client.cache.readFragment<PantryItemConflict_PantryItemFragment>({
    id: client.cache.identify({ __typename: 'PantryItem', id: ITEM_ID }),
    fragment: PantryItemConflict_PantryItemFragmentDoc,
    optimistic: true,
  });

let toastError: jest.SpyInstance;

beforeEach(() => {
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  useStore.setState({
    user: USER,
    accessToken: 'token',
    isOnline: true,
    apiReachable: true,
  });
  registerQueueFailureHandler();
  toastError = jest.spyOn(toastService, 'error').mockImplementation();
  toastError.mockClear();
  jest.mocked(Telemetry.increment).mockClear();
});

afterEach(async () => {
  storage.clearAll();
  queueStore.invalidateCache();
  await queueManager.whenIdle();
  jest.restoreAllMocks();
});

describe('the app killed while a write is on its way', () => {
  const killedMidSend = async () => {
    const lost = lostConnection();
    void editNotes(clientOver(lost.link));
    await lost.reached;
  };

  it('shows the change on the first read after the restart', async () => {
    await killedMidSend();

    const client = restart(answering());

    expect(shownRow(client)).toMatchObject({ storageNotes: 'my notes' });
  });

  it('sends it, and it ends once', async () => {
    await killedMidSend();
    const update = recordMock(UpdatePantryItemDocument, {
      data: {
        updatePantryItem: {
          __typename: 'UpdatePantryItemPayload',
          pantryItem: { ...ROW, version: 4, storageNotes: 'my notes' },
        },
      },
    });
    restart(answering(update));

    await queueManager.processQueue();

    expect(update.fired).toHaveLength(1);
    expect(queueStore.getRefusedCount()).toBe(0);
    expect(queueStore.getPendingMutationsForUser('user-1')).toEqual([]);
  });

  it('reports nothing when the server had already taken an update', async () => {
    await killedMidSend();
    const stale = recordMock(UpdatePantryItemDocument, {
      data: {
        updatePantryItem: {
          __typename: 'ConflictError',
          code: ErrorCode.VersionConflict,
          message: 'stale',
        },
      },
      maxUsageCount: 1,
    });
    const row = recordMock(PantryItemForConflictDocument, {
      data: {
        pantryItem: { ...ROW, version: 4, storageNotes: 'my notes' },
      },
      maxUsageCount: 1,
    });
    const client = restart(answering(stale, row));

    await queueManager.processQueue();

    expect(stale.fired).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(queueStore.getRefusedCount()).toBe(0);
    expect(shownRow(client)).toMatchObject({
      version: 4,
      storageNotes: 'my notes',
    });
  });

  it('ends a create once when the server had already taken it', async () => {
    const lost = lostConnection();
    const variables = { input: { id: 'list-new', name: 'Weekly' } };
    const client = clientOver(lost.link);
    void pendingWritesOf(client.cache).send(
      CreateShoppingListDocument,
      variables,
      write =>
        settleMutation(
          () =>
            client.mutate({ mutation: CreateShoppingListDocument, ...write }),
          { document: CreateShoppingListDocument, fallback: 'failed' },
        ),
      { list: { id: 'list-new', name: 'Weekly' }, rows: [] },
    );
    await lost.reached;
    const create = recordMock(CreateShoppingListDocument, {
      data: {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-new',
            version: 1,
            name: 'Weekly',
          },
        },
      },
    });
    restart(answering(create));

    await queueManager.processQueue();

    expect(create.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ id: 'list-new' }),
      }),
    ]);
    expect(queueStore.getPendingMutationsForUser('user-1')).toEqual([]);
  });
});

describe('a drain while a write is on its way', () => {
  it('leaves that write to its send', async () => {
    const lost = lostConnection();
    void editNotes(clientOver(lost.link));
    await lost.reached;

    await queueManager.processQueue();

    expect(queueStore.getPendingMutationsForUser('user-1')).toEqual([]);
    expect(queueStore.getPendingWrites()).toHaveLength(1);
  });

  it('holds a queued write on the same row behind it', async () => {
    const lost = lostConnection();
    void editNotes(clientOver(lost.link));
    await lost.reached;
    const behind = recordMock(UpdatePantryItemDocument, { maxUsageCount: 1 });
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'queued behind',
        ...queuedMutationFor(UpdatePantryItemDocument),
        variables: { input: { id: ITEM_ID, version: 3 } },
      }),
    );

    await queueManager.processQueue();

    expect(behind.fired).toEqual([]);
    expect(queueStore.getMutation('queued behind')?.status).toBe('pending');
  });
});

describe('a write the device cannot store', () => {
  const answered = () =>
    recordMock(UpdatePantryItemDocument, {
      data: {
        updatePantryItem: {
          __typename: 'UpdatePantryItemPayload',
          pantryItem: { ...ROW, version: 4, storageNotes: 'my notes' },
        },
      },
    });

  it('still reaches the server with the queue full', async () => {
    const update = answered();
    const client = clientOver(answering(update));
    for (let i = 0; i < 500; i++) {
      queueStore.addMutation(
        makeQueuedMutation({
          id: `held-${i}`,
          ...queuedMutationFor(UpdatePantryItemDocument),
          variables: { input: { id: `other-${i}`, version: 1 } },
        }),
      );
    }

    await editNotes(client);

    expect(update.fired).toHaveLength(1);
    expect(Telemetry.increment).toHaveBeenCalledWith(
      'offline_queue_journal_failed_total',
      1,
      expect.anything(),
    );
    queueStore.clearQueueForUser('user-1');
  });

  it('still reaches the server with storage full', async () => {
    const update = answered();
    const client = clientOver(answering(update));
    jest.spyOn(storage, 'set').mockImplementation(() => {
      throw new Error('no space left on device');
    });

    await editNotes(client);

    expect(update.fired).toHaveLength(1);
  });
});
