import { ApolloClient } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
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
  CreateShoppingListDocument,
  UpdateShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  PantryItemConflict_PantryItemFragmentDoc,
  PantryItemForConflictDocument,
  type PantryItemConflict_PantryItemFragment,
} from '#features/pantry/offline/pantryItemConflict.generated';
import {
  registerQueueFailureHandler,
  setChangesNotSavedOpener,
} from '../queueFailureHandler';
import { queueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import {
  discardRefusedChange,
  namesNoRow,
  retryRefusedChange,
} from '../refusedChanges';
import { noteCleanAnswer } from '../serverAnswers';
import { QUEUE_FULL_CODE, QueueStatus } from '../types';

/**
 * What becomes of a stale write and a refused one, on a real client, cache,
 * queue and failure handler. Only the server is scripted.
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
  minQuantity: 1,
} as const;

const stale = () =>
  recordMock(UpdatePantryItemDocument, {
    data: {
      updatePantryItem: {
        __typename: 'ConflictError',
        code: ErrorCode.VersionConflict,
        message: 'stale',
      },
    },
    maxUsageCount: 1,
  });

const accepted = (version: number, fields: Record<string, unknown>) =>
  recordMock(UpdatePantryItemDocument, {
    data: {
      updatePantryItem: {
        __typename: 'UpdatePantryItemPayload',
        pantryItem: { ...ROW, ...fields, version },
      },
    },
    maxUsageCount: 1,
  });

const notFound = () =>
  recordMock(UpdatePantryItemDocument, {
    data: {
      updatePantryItem: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'gone',
        resource: 'PantryItem',
      },
    },
    maxUsageCount: 1,
  });

const serverRow = (fields: Record<string, unknown>) =>
  recordMock(PantryItemForConflictDocument, {
    data: { pantryItem: { ...ROW, ...fields } },
    maxUsageCount: 1,
  });

/** The server, answering in this order. */
function serverAnswers(...answers: RecordedMock[]): ApolloClient {
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
    link: new MockLink(answers.map(({ mock }) => completeMockedResponse(mock))),
  });
  mockClient = client;
  return client;
}

/** An edit of the notes, made offline at version 3 and queued. */
function queueEdit(
  client: ApolloClient,
  id: string,
  storageNotes = 'my notes',
): void {
  const writes = pendingWritesOf(client.cache);
  const variables = {
    input: { id: ITEM_ID, version: 3, storageNotes },
  };
  const write = writes.begin(UpdatePantryItemDocument, variables, {
    entity: { __typename: 'PantryItem', id: ITEM_ID },
    fields: { storageNotes, updatedAt: '2026-11-01T10:00:00.000Z' },
  });
  writes.markQueued(write.id);
  queueStore.addMutation(
    makeQueuedMutation({
      id,
      ...queuedMutationFor(UpdatePantryItemDocument),
      variables,
      pendingWrite: { id: write.id, inputs: write.inputs },
    }),
  );
}

const shownRow = (client: ApolloClient) =>
  client.cache.readFragment<PantryItemConflict_PantryItemFragment>({
    id: client.cache.identify({ __typename: 'PantryItem', id: ITEM_ID }),
    fragment: PantryItemConflict_PantryItemFragmentDoc,
    optimistic: true,
  });

const drain = () => queueManager.processQueue();

let toastError: jest.SpyInstance;

// A sent entry leaves the queue on a timer, which must find nothing of a later test's.
let entries = 0;
let EDIT = '';
let ADD = '';
let EDIT_OF_ADD = '';

beforeEach(() => {
  entries += 1;
  EDIT = `edit-${entries}`;
  ADD = `add-${entries}`;
  EDIT_OF_ADD = `edit-of-add-${entries}`;
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
});

afterEach(async () => {
  // `whenIdle` runs a pass, which must find nothing left to send.
  storage.clearAll();
  queueStore.invalidateCache();
  await queueManager.whenIdle();
  jest.restoreAllMocks();
});

describe('a version conflict', () => {
  it('sends the edit again when another member changed a different field', async () => {
    const first = stale();
    const row = serverRow({ version: 4, itemName: 'Oat milk' });
    const second = accepted(5, {
      itemName: 'Oat milk',
      storageNotes: 'my notes',
    });
    const client = serverAnswers(first, row, second);
    queueEdit(client, EDIT);

    await drain();

    expect(first.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ version: 3 }),
      }),
    ]);
    expect(second.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ version: 4 }),
      }),
    ]);
    expect(toastError).not.toHaveBeenCalled();
    expect(queueStore.getRefused()).toEqual([]);
    // The answer schedules this rebuild, which gives the server's row back.
    pendingWritesOf(client.cache).rebuild();
    expect(shownRow(client)).toMatchObject({
      itemName: 'Oat milk',
      storageNotes: 'my notes',
    });
  });

  it('settles a lost reply without sending or reporting anything more', async () => {
    const first = stale();
    const row = serverRow({ version: 4, storageNotes: 'my notes' });
    const client = serverAnswers(first, row);
    queueEdit(client, EDIT);

    await drain();

    expect(first.fired).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(queueStore.getMutation(EDIT)).toBeNull();
    expect(queueStore.getRefused()).toEqual([]);
    expect(shownRow(client)).toMatchObject({
      version: 4,
      storageNotes: 'my notes',
    });
  });

  it('treats both sides choosing the same value as landed, and moves later writes on', async () => {
    const first = stale();
    const row = serverRow({ version: 4, storageNotes: 'my notes' });
    const later = accepted(5, { storageNotes: 'later notes' });
    const client = serverAnswers(first, row, later);
    queueEdit(client, EDIT);
    queueEdit(client, `${EDIT}-later`, 'later notes');

    await drain();

    expect(toastError).not.toHaveBeenCalled();
    expect(later.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ version: 4 }),
      }),
    ]);
  });

  it('keeps the change for the person when both changed the same field', async () => {
    const onOpen = jest.fn();
    setChangesNotSavedOpener(onOpen);
    const first = stale();
    const row = serverRow({ version: 4, storageNotes: 'their notes' });
    const client = serverAnswers(first, row);
    queueEdit(client, EDIT);

    await drain();

    expect(first.fired).toHaveLength(1);
    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([EDIT]);
    expect(shownRow(client)).toMatchObject({ storageNotes: 'their notes' });
    const [[, options]] = toastError.mock.calls as [
      [string, { action: { onPress(): void } }],
    ];
    options.action.onPress();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('leaves the write queued and on screen when the row cannot be read', async () => {
    const first = stale();
    const row = recordMock(PantryItemForConflictDocument, {
      error: new Error('no route to host'),
      maxUsageCount: 1,
    });
    const client = serverAnswers(first, row);
    queueEdit(client, EDIT);

    await drain();

    expect(queueStore.getMutation(EDIT)?.status).toBe(QueueStatus.PENDING);
    expect(queueStore.getRefused()).toEqual([]);
    expect(toastError).not.toHaveBeenCalled();
    expect(shownRow(client)).toMatchObject({ storageNotes: 'my notes' });
  });

  it('keeps an entry from an older build, which saved no baseline, unless it landed', async () => {
    const first = stale();
    const row = serverRow({ version: 4, itemName: 'Oat milk' });
    const client = serverAnswers(first, row);
    queueEdit(client, EDIT);
    const entry = queueStore.getMutation(EDIT);
    if (!entry?.pendingWrite) throw new Error('not queued');
    queueStore.updateMutation(EDIT, {
      pendingWrite: {
        ...entry.pendingWrite,
        inputs: { fields: { storageNotes: 'my notes' } },
      },
    });

    await drain();

    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([EDIT]);
  });

  it('stops resending a row that keeps moving, and keeps the change', async () => {
    const client = serverAnswers(
      stale(),
      serverRow({ version: 4 }),
      stale(),
      serverRow({ version: 5 }),
      stale(),
    );
    queueEdit(client, EDIT);

    await drain();

    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([EDIT]);
  });
});

describe('a refused add', () => {
  const NEW_LIST = 'list-new';
  const refused = () =>
    recordMock(CreateShoppingListDocument, {
      data: {
        createShoppingList: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'refused',
        },
      },
      maxUsageCount: 1,
    });

  const renamed = () =>
    recordMock(UpdateShoppingListDocument, {
      data: {
        updateShoppingList: {
          __typename: 'UpdateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: NEW_LIST,
            version: 2,
            name: 'Weekly shop',
          },
        },
      },
      maxUsageCount: 1,
    });

  const queueAddThenEdit = () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: ADD,
        createdAt: Date.now(),
        ...queuedMutationFor(CreateShoppingListDocument),
        variables: { input: { id: NEW_LIST, name: 'Weekly' } },
      }),
    );
    queueStore.addMutation(
      makeQueuedMutation({
        id: EDIT_OF_ADD,
        createdAt: Date.now() + 1,
        ...queuedMutationFor(UpdateShoppingListDocument),
        variables: { input: { id: NEW_LIST, version: 1, name: 'Weekly shop' } },
      }),
    );
  };

  it('takes the writes on its row with it, unsent and listed once', async () => {
    const create = refused();
    const edit = renamed();
    serverAnswers(create, edit);
    queueAddThenEdit();

    await drain();

    expect(create.fired).toHaveLength(1);
    expect(edit.fired).toEqual([]);
    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([ADD]);
    expect(queueStore.getRefusedCount()).toBe(2);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('sends them again in order on a retry', async () => {
    const edit = renamed();
    const create = recordMock(CreateShoppingListDocument, {
      data: {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: NEW_LIST,
            version: 1,
            name: 'Weekly',
          },
        },
      },
      maxUsageCount: 1,
    });
    serverAnswers(refused(), create, edit);
    queueAddThenEdit();
    await drain();

    await retryRefusedChange(ADD);

    expect(edit.fired).toHaveLength(1);
    expect(create.fired).toHaveLength(1);
    expect(queueStore.getRefusedCount()).toBe(0);
  });

  it('discards them together', async () => {
    serverAnswers(refused());
    queueAddThenEdit();
    await drain();

    discardRefusedChange(ADD);

    expect(queueStore.getRefusedCount()).toBe(0);
    expect(queueStore.getMutation(EDIT_OF_ADD)).toBeNull();
  });
});

describe('a write past the age limit', () => {
  it('moves to the list rather than being deleted', async () => {
    const client = serverAnswers();
    queueEdit(client, EDIT);
    queueStore.updateMutation(EDIT, {
      createdAt: Date.now() - 91 * 24 * 60 * 60 * 1000,
    });

    await drain();

    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([EDIT]);
    expect(shownRow(client)).toMatchObject({ storageNotes: 'top shelf' });
  });
});

describe('a write the queue has no room for', () => {
  it('is kept for the person, who is told plainly why', () => {
    const client = serverAnswers();
    const { id } = pendingWritesOf(client.cache).begin(
      UpdatePantryItemDocument,
      { input: { id: ITEM_ID, version: 3, storageNotes: 'my notes' } },
      {
        entity: { __typename: 'PantryItem', id: ITEM_ID },
        fields: { storageNotes: 'my notes' },
      },
    );

    queueManager.withdrawUnqueueableWrite(
      makeQueuedMutation({
        id: 'no room',
        ...queuedMutationFor(UpdatePantryItemDocument),
        pendingWrite: { id, inputs: {} },
      }),
      {
        type: 'unknown',
        message: 'full',
        code: QUEUE_FULL_CODE,
        timestamp: 0,
        retryable: false,
      },
    );

    expect(queueStore.getRefused().map(entry => entry.id)).toEqual(['no room']);
    expect(toastError).toHaveBeenCalledWith(
      t('errors.queueFull'),
      expect.anything(),
    );
    expect(shownRow(client)).toMatchObject({ storageNotes: 'top shelf' });
  });
});

describe('a write that always crashes', () => {
  it('moves to the list once the server has answered others past it', async () => {
    const HOUR = 60 * 60 * 1000;
    const crash = recordMock(UpdatePantryItemDocument, {
      error: new CombinedGraphQLErrors({
        data: null,
        errors: [
          {
            message: 'Internal server error',
            extensions: { code: TopLevelErrorCode.InternalServerError },
          },
        ],
      }),
    });
    const client = serverAnswers(crash);
    queueEdit(client, EDIT);
    const entry = queueStore.getMutation(EDIT);
    if (!entry) throw new Error('not queued');
    queueStore.updateMutation(EDIT, {
      retryCount: entry.maxRetries,
      faults: { count: 5, firstAt: 1, lastAt: 1 + HOUR },
    });
    noteCleanAnswer();

    await queueManager['processMutation']({
      ...entry,
      retryCount: entry.maxRetries,
      faults: { count: 5, firstAt: 1, lastAt: 1 + HOUR },
    });

    expect(queueStore.getRefused().map(({ id }) => id)).toEqual([EDIT]);
  });
});

describe('a kept change', () => {
  const refuse = async (...more: RecordedMock[]) => {
    const client = serverAnswers(
      stale(),
      serverRow({ version: 4, storageNotes: 'their notes' }),
      ...more,
    );
    queueEdit(client, EDIT);
    await drain();
    return client;
  };

  it('shows again at once on a retry, and goes out at the row’s version', async () => {
    const again = stale();
    const row = serverRow({ version: 5, storageNotes: 'their notes' });
    const last = accepted(6, { storageNotes: 'my notes' });
    const client = await refuse(again, row, last);

    const retried = retryRefusedChange(EDIT);

    expect(shownRow(client)).toMatchObject({ storageNotes: 'my notes' });
    expect(queueStore.getRefused()).toEqual([]);

    await retried;

    expect(last.fired).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ version: 5 }),
      }),
    ]);
    expect(queueStore.getRefused()).toEqual([]);
  });

  it('sends nothing once discarded', async () => {
    const never = accepted(6, {});
    const client = await refuse(never);

    discardRefusedChange(EDIT);
    await drain();

    expect(never.fired).toEqual([]);
    expect(queueStore.getRefused()).toEqual([]);
    expect(queueStore.getMutation(EDIT)).toBeNull();
    expect(shownRow(client)).toMatchObject({ storageNotes: 'their notes' });
  });

  it('says the row is gone when a retry finds it deleted', async () => {
    await refuse(notFound());

    await retryRefusedChange(EDIT);

    expect(namesNoRow(queueStore.getRefused()[0]?.lastError)).toBe(true);
  });
});
