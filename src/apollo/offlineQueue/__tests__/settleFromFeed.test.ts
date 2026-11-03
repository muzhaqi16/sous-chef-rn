import { ApolloClient, ApolloLink } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import {
  AddItemToShoppingListDocument,
  MoveShoppingListItemDocument,
  UpdateShoppingListItemDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { storage } from '#/store/deviceStorage';
import { QueueManager } from '../queueManager';
import { queueStore } from '../queueStore';
import { QueueStatus } from '../types';

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const USER = 'user-1';
const applied = (operationId: string, entityId: string, version = 4) => ({
  operationId,
  entityType: 'ShoppingListItem',
  entityId,
  version,
});

const edit = (id: string, rowId = 'row-1', version = 3) =>
  makeQueuedMutation({
    id,
    userId: USER,
    ...queuedMutationFor(UpdateShoppingListItemDocument),
    variables: { input: { id: rowId, version, notes: 'Two' } },
    pendingWrite: { id: `write-${id}`, inputs: {} },
  });

beforeEach(() => {
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId(USER);
  mockClient = new ApolloClient({
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.empty(),
  });
});

const settled = (entryId: string) => !queueStore.getMutation(entryId);

describe('a pull confirming a queued write', () => {
  it('settles an edit whose reply was lost', () => {
    queueStore.addMutation(edit('lost-reply'));

    new QueueManager().settleFromFeed([applied('write-lost-reply', 'row-1')]);

    expect(settled('lost-reply')).toBe(true);
  });

  it('moves a write built on it to the version the row reached', () => {
    queueStore.addMutation(edit('first'));
    queueStore.addMutation(edit('second'));

    new QueueManager().settleFromFeed([applied('write-first', 'row-1', 7)]);

    expect(queueStore.getMutation('second')?.variables.input).toMatchObject({
      version: 7,
    });
  });

  it('moves an edit built on a reorder, which sends no version', () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'reorder',
        userId: USER,
        ...queuedMutationFor(MoveShoppingListItemDocument),
        variables: { input: { id: 'row-1', afterItemId: 'row-2' } },
        pendingWrite: { id: 'write-reorder', inputs: {} },
      }),
    );
    queueStore.addMutation(edit('after-reorder'));

    new QueueManager().settleFromFeed([applied('write-reorder', 'row-1', 4)]);

    expect(settled('reorder')).toBe(true);
    expect(
      queueStore.getMutation('after-reorder')?.variables.input,
    ).toMatchObject({ version: 4 });
  });

  it('reports the queue drained when it settles the last write', () => {
    queueStore.addMutation(edit('last'));
    const manager = new QueueManager();
    const drained = jest.fn();
    manager.setDrainedHandler(drained);

    manager.settleFromFeed([applied('write-last', 'row-1')]);

    expect(drained).toHaveBeenCalledWith('pull');
  });

  it('reports nothing while a write is still waiting', () => {
    queueStore.addMutation(edit('confirmed'));
    queueStore.addMutation(edit('waiting', 'row-2'));
    const manager = new QueueManager();
    const drained = jest.fn();
    manager.setDrainedHandler(drained);

    manager.settleFromFeed([applied('write-confirmed', 'row-1')]);

    expect(drained).not.toHaveBeenCalled();
  });

  it('leaves a write naming another row', () => {
    queueStore.addMutation(edit('other', 'row-2'));

    new QueueManager().settleFromFeed([applied('write-other', 'row-1')]);

    expect(settled('other')).toBe(false);
  });

  it('leaves another device’s write, which names no operation of ours', () => {
    queueStore.addMutation(edit('mine'));

    new QueueManager().settleFromFeed([applied('someone-else', 'row-1')]);

    expect(settled('mine')).toBe(false);
  });

  it('leaves a write on its way to its answer', () => {
    queueStore.addMutation({
      ...edit('sending'),
      status: QueueStatus.PROCESSING,
    });

    new QueueManager().settleFromFeed([applied('write-sending', 'row-1')]);

    expect(settled('sending')).toBe(false);
  });

  it('leaves a batch to replay, however many rows are confirmed', () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'batch',
        userId: USER,
        ...queuedMutationFor(AddItemToShoppingListDocument),
        variables: {
          input: {
            shoppingListId: 'list-1',
            items: [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }],
          },
        },
        pendingWrite: { id: 'write-batch', inputs: {} },
      }),
    );

    new QueueManager().settleFromFeed([
      applied('write-batch', 'row-1'),
      applied('write-batch', 'row-2'),
    ]);

    expect(settled('batch')).toBe(false);
  });

  it('leaves a write that needs its reply', () => {
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'create',
        userId: USER,
        ...queuedMutationFor(CreateShoppingListDocument),
        variables: { input: { id: 'list-1', name: 'Week' } },
        pendingWrite: { id: 'write-create', inputs: {} },
      }),
    );

    new QueueManager().settleFromFeed([applied('write-create', 'list-1')]);

    expect(settled('create')).toBe(false);
  });

  it('drops the write’s layer with it', () => {
    queueStore.addMutation(edit('layered'));
    const drop = jest.spyOn(
      pendingWritesOf((mockClient as ApolloClient).cache),
      'drop',
    );

    new QueueManager().settleFromFeed([applied('write-layered', 'row-1')]);

    expect(drop).toHaveBeenCalledWith('write-layered');
  });
});
