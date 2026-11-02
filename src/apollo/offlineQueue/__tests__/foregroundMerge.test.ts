import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
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
import { useStore } from '#store';
import {
  AddItemToShoppingListDocument,
  RemoveItemFromShoppingListDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { createQueueLink } from '../queueLink';
import { queueStore } from '../queueStore';

/**
 * An add answered online that the server merged into a row it held: what waits
 * on the row the device minted goes to the row that survives.
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
const LIST_ID = 'list-1';
const MINTED = 'line-minted';
const SURVIVOR = 'line-survivor';

const mergedAdd = () =>
  recordMock(AddItemToShoppingListDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [
          {
            __typename: 'BatchAddShoppingListItemResult',
            index: 0,
            success: true,
            item: {
              __typename: 'ShoppingListItem',
              id: SURVIVOR,
              version: 7,
            },
          },
        ],
      },
    },
  });

const clientAnswering = (
  before: readonly ApolloLink[],
  ...answers: RecordedMock[]
) => {
  const client = new ApolloClient({
    cache: makeCache(),
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([
      createQueueLink(),
      ...before,
      new MockLink(answers.map(({ mock }) => completeMockedResponse(mock))),
    ]),
  });
  mockClient = client;
  return client;
};

/** A request held on its way to the server until `answer` lets it through. */
function heldRequests() {
  let arrive = () => {};
  const reached = new Promise<void>(resolve => {
    arrive = resolve;
  });
  let answer = () => {};
  const answered = new Promise<void>(resolve => {
    answer = resolve;
  });
  const link = new ApolloLink(
    (operation, forward) =>
      new Observable(observer => {
        arrive();
        void answered.then(() => forward(operation).subscribe(observer));
      }),
  );
  return { link, reached, answer };
}

const addLine = (client: ApolloClient) =>
  pendingWritesOf(client.cache).send(
    AddItemToShoppingListDocument,
    {
      input: {
        shoppingListId: LIST_ID,
        items: [{ id: MINTED, item: { itemId: 'item-1' } }],
      },
    },
    write =>
      settleMutation(
        () =>
          client.mutate({ mutation: AddItemToShoppingListDocument, ...write }),
        { document: AddItemToShoppingListDocument, fallback: 'failed' },
      ),
    { listId: LIST_ID, rows: [], now: '2026-11-01T10:00:00.000Z' },
  );

const editLine = (client: ApolloClient) =>
  pendingWritesOf(client.cache).send(
    UpdateShoppingListItemDocument,
    { input: { id: MINTED, version: 1, notes: 'oat' } },
    write =>
      settleMutation(
        () =>
          client.mutate({ mutation: UpdateShoppingListItemDocument, ...write }),
        { document: UpdateShoppingListItemDocument, fallback: 'failed' },
      ),
    { fields: { notes: 'oat' } },
  );

beforeEach(() => {
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  useStore.setState({ user: USER, isOnline: true, apiReachable: true });
});

it('sends an edit made before the answer against the surviving row', async () => {
  const add = mergedAdd();
  const edit = recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem: {
        __typename: 'UpdateShoppingListItemPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: SURVIVOR,
          version: 8,
        },
      },
    },
  });
  const client = clientAnswering([], add, edit);

  await Promise.all([addLine(client), editLine(client)]);

  expect(edit.fired).toEqual([
    expect.objectContaining({
      input: {
        id: SURVIVOR,
        version: 7,
        notes: 'oat',
        idempotencyKey: expect.any(String),
      },
    }),
  ]);
});

it('leaves a removal on the minted row, which never reaches the surviving one', async () => {
  const add = mergedAdd();
  const removal = recordMock(RemoveItemFromShoppingListDocument, {
    data: {
      removeItemFromShoppingList: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'gone',
      },
    },
  });
  const client = clientAnswering([], add, removal);

  const added = addLine(client);
  const removed = pendingWritesOf(client.cache).send(
    RemoveItemFromShoppingListDocument,
    { input: { id: MINTED, listId: LIST_ID } },
    write =>
      settleMutation(
        () =>
          client.mutate({
            mutation: RemoveItemFromShoppingListDocument,
            ...write,
          }),
        { document: RemoveItemFromShoppingListDocument, fallback: 'failed' },
      ),
    { listId: LIST_ID },
  );
  await Promise.all([added, removed]);

  expect(removal.fired).toEqual([
    expect.objectContaining({
      input: expect.objectContaining({ id: MINTED }),
    }),
  ]);
});

it('moves a write queued behind the add onto the surviving row', async () => {
  const add = mergedAdd();
  const held = heldRequests();
  const client = clientAnswering([held.link], add);
  const added = addLine(client);
  await held.reached;
  queueStore.addMutation(
    makeQueuedMutation({
      id: 'queued edit',
      ...queuedMutationFor(UpdateShoppingListItemDocument),
      variables: { input: { id: MINTED, version: 1, notes: 'oat' } },
    }),
  );

  held.answer();
  await added;

  expect(queueStore.getMutation('queued edit')?.variables).toEqual({
    input: { id: SURVIVOR, version: 7, notes: 'oat' },
  });
});
