import type { ApolloClient } from '@apollo/client';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { SyncPageStatus, SyncPokeKind } from '#/graphql/generated/schemaTypes';
import { getDeviceId } from '#/services/auth/deviceId';
import {
  clientOver,
  fault,
  itemsOf,
  KIND,
  line,
  LIST,
  listed,
  page,
  pulled,
  pulls,
  snapshots,
  wholeList,
  type Server,
} from '#/test-utils/feedServer';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { listFeedAdapter } from '#features/shoppingList/offline/listFeed';
import { useStore } from '#store';
import type { FeedPokesSubscription } from '../feed.generated';
import { FeedEngine } from '../feedEngine';
import {
  clearPositions,
  heldScopes,
  holdPosition,
  positionOf,
} from '../feedPositions';

jest.mock('#/services/auth/deviceId');

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const hold = (id: string, cursor: string) =>
  holdPosition(id, { kind: KIND, cursor, snapshotAt: 0 });

let engine: FeedEngine;

/** Starts the engine and waits for every pass it leads to. */
async function run(start: () => void = () => engine.start()): Promise<void> {
  start();
  await engine.whenSettled();
}

beforeEach(() => {
  pulls.length = 0;
  snapshots.length = 0;
  clearPositions();
  useStore.setState({ isOnline: true, apiReachable: true });
  jest.mocked(getDeviceId).mockReturnValue('this-device');
  engine = new FeedEngine();
});

afterEach(() => {
  engine.stop();
  jest.restoreAllMocks();
});

describe('catching up', () => {
  it('pulls nothing when every list stands at its position', async () => {
    hold(LIST, 'same');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'same' }]),
    });

    await run();

    expect(pulls).toEqual([]);
  });

  it('pulls only the list that moved', async () => {
    hold('list-a', 'a-1');
    hold('list-b', 'b-1');
    hold('list-c', 'c-1');
    mockClient = clientOver({
      scopes: () =>
        listed([
          { id: 'list-a', cursor: 'a-1' },
          { id: 'list-b', cursor: 'b-2' },
          { id: 'list-c', cursor: 'c-1' },
        ]),
      pull: ({ scopes }) => pulled(scopes.map(({ id }) => page(id))),
    });

    await run();

    expect(pulls).toHaveLength(1);
    expect(pulls[0]?.scopes.map(({ id }) => id)).toEqual(['list-b']);
    expect(positionOf('list-b')?.cursor).toBe('list-b-next');
  });

  it('names at most 25 lists in one pull', async () => {
    const lists = Array.from({ length: 30 }, (_, index) => `list-${index}`);
    lists.forEach(id => hold(id, 'old'));
    mockClient = clientOver({
      scopes: () => listed(lists.map(id => ({ id, cursor: 'new' }))),
      pull: ({ scopes }) => pulled(scopes.map(({ id }) => page(id))),
    });

    await run();

    expect(pulls.map(({ scopes }) => scopes.length)).toEqual([25, 5]);
  });

  it('follows hasMore from the cursor each page gives', async () => {
    hold(LIST, 'start');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'end' }]),
      pull: ({ scopes }) =>
        pulled([
          scopes[0]?.cursor === 'start'
            ? page(LIST, { cursor: 'middle', hasMore: true })
            : page(LIST, { cursor: 'end' }),
        ]),
    });

    await run();

    expect(pulls.map(({ scopes }) => scopes[0]?.cursor)).toEqual([
      'start',
      'middle',
    ]);
    expect(positionOf(LIST)?.cursor).toBe('end');
  });

  it('skips a scope kind it has no adapter for', async () => {
    mockClient = clientOver({
      scopes: () => ({
        data: {
          syncScopes: {
            edges: [{ node: { kind: 'PANTRY', id: 'pantry-1', cursor: 'c' } }],
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      }),
    });
    mockClient = {
      ...mockClient,
      query: () =>
        Promise.resolve({
          data: {
            syncScopes: {
              edges: [
                { node: { kind: 'PANTRY', id: 'pantry-1', cursor: 'c' } },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
    } as unknown as ApolloClient;

    await run();

    expect(pulls).toEqual([]);
    expect(heldScopes().size).toBe(0);
  });
});

describe('a list with no position', () => {
  it('reads the whole list, keeps the first page cursor, then pulls from it', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'c-1' }]),
      pull: ({ scopes }) =>
        pulled(
          scopes[0]?.cursor === null
            ? [
                page(LIST, {
                  status: SyncPageStatus.ResyncRequired,
                  cursor: null,
                }),
              ]
            : [page(LIST, { cursor: 'c-1' })],
        ),
      snapshot: ({ after }) =>
        after
          ? wholeList([line('row-2', true)], { cursor: null })
          : wholeList([line('row-1')], {
              cursor: 'kept',
              endCursor: 'page-2',
              hasMore: true,
            }),
    });

    await run();

    expect(snapshots).toHaveLength(2);
    expect(pulls.map(({ scopes }) => scopes[0]?.cursor)).toEqual([
      null,
      'kept',
    ]);
    expect(positionOf(LIST)?.cursor).toBe('c-1');
    expect(itemsOf(mockClient, false)).toEqual(['row-1']);
    expect(itemsOf(mockClient, true)).toEqual(['row-2']);
  });

  it('leaves no feed answer in the cache', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'c-1' }]),
      pull: () =>
        pulled([
          page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]),
      snapshot: () => wholeList([line('row-1')], { cursor: 'c-1' }),
    });

    await run();

    const { ROOT_QUERY: root } = mockClient.cache.extract() as Record<
      string,
      Record<string, unknown>
    >;
    expect(
      Object.keys(root ?? {}).filter(field => field.startsWith('sync')),
    ).toEqual([]);
  });
});

describe('a server that keeps asking for a full read', () => {
  it('reads the list once a pass, however often it asks', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'c-1' }]),
      pull: () =>
        pulled([
          page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]),
      snapshot: () => wholeList([line('row-1')], { cursor: 'kept' }),
    });

    await run();

    expect(snapshots).toHaveLength(1);
  });
});

describe('a list the person no longer reaches', () => {
  const seeded = async (extra: Partial<Server> = {}) => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'c-1' }]),
      pull: () =>
        pulled([
          page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]),
      snapshot: () => wholeList([line('row-1')], { cursor: 'c-1' }),
    });
    await run();
    engine.stop();
    const { cache } = mockClient;
    mockClient = Object.assign(clientOver(extra), {});
    (mockClient as { cache: unknown }).cache = cache;
  };

  it('leaves when a pull says it is unavailable', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'moved' }]),
      pull: () =>
        pulled([
          page(LIST, { status: SyncPageStatus.Unavailable, cursor: null }),
        ]),
    });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)).toBeUndefined();
  });

  it('leaves when a complete answer does not list it', async () => {
    mockClient = clientOver({ scopes: () => listed([]) });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)).toBeUndefined();
  });

  it('stays through a fault reading what is reached', async () => {
    mockClient = clientOver({ scopes: () => fault() });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });

  it('stays when the answer could not be read to its end', async () => {
    mockClient = clientOver({
      scopes: after =>
        after ? fault() : listed([{ id: 'other', cursor: 'c' }], true),
    });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });

  it('stays through a fault during a pull', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'moved' }]),
      pull: () => fault(),
    });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });

  it('stays while the server has not taken its create', async () => {
    jest.spyOn(queueStore, 'holdsCreateFor').mockReturnValue(true);
    mockClient = clientOver({ scopes: () => listed([]) });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });

  it('takes nothing that is only cached, not held', async () => {
    await seeded({ scopes: () => listed([]) });
    clearPositions();

    await run();

    expect(itemsOf(mockClient as ApolloClient, false)).toEqual(['row-1']);
  });
});

describe('what holds a pull back', () => {
  it('does not pull a list waiting on its own create', async () => {
    jest.spyOn(queueStore, 'holdsCreateFor').mockReturnValue(true);
    hold(LIST, 'old');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'new' }]),
    });

    await run();

    expect(pulls).toEqual([]);
  });

  it('sends nothing while the API is unavailable', async () => {
    useStore.setState({ apiReachable: false });
    hold(LIST, 'old');
    const scopes = jest.fn(() => listed([]));
    mockClient = clientOver({ scopes });

    await run();

    expect(scopes).not.toHaveBeenCalled();
  });

  it('waits as a refusal says', async () => {
    const scopes = jest.fn(() =>
      fault('RATE_LIMIT_EXCEEDED', { retryAfter: 30 }),
    );
    mockClient = clientOver({ scopes });

    await run();
    const asked = scopes.mock.calls.length;
    await run(() => engine.catchUp());

    expect(scopes).toHaveBeenCalledTimes(asked);
  });
});

describe('a signal', () => {
  const poke = (
    kind: SyncPokeKind,
    cursor: string | null,
    originDeviceId: string | null = null,
  ): FeedPokesSubscription['mySyncPokes'] => ({
    __typename: 'SyncPoke',
    kind,
    scope: cursor
      ? { __typename: 'SyncScope', kind: KIND, id: LIST, cursor }
      : null,
    originDeviceId,
    originOperationId: null,
  });

  const started = async (server: Partial<Server>) => {
    mockClient = clientOver(server);
    await run();
  };

  it('pulls a list that moved', async () => {
    hold(LIST, 'old');
    await started({
      scopes: () => listed([{ id: LIST, cursor: 'old' }]),
      pull: () => pulled([page(LIST, { cursor: 'new' })]),
    });

    await run(() => engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'new')));

    expect(pulls).toHaveLength(1);
    expect(positionOf(LIST)?.cursor).toBe('new');
  });

  it('pulls nothing for the position it holds', async () => {
    hold(LIST, 'same');
    await started({ scopes: () => listed([{ id: LIST, cursor: 'same' }]) });

    await run(() =>
      engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'same')),
    );

    expect(pulls).toEqual([]);
  });

  it('pulls nothing for this device’s own write', async () => {
    hold(LIST, 'old');
    await started({ scopes: () => listed([{ id: LIST, cursor: 'old' }]) });

    await run(() =>
      engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'new', 'this-device')),
    );

    expect(pulls).toEqual([]);
  });

  it('pulls for another device', async () => {
    hold(LIST, 'old');
    await started({
      scopes: () => listed([{ id: LIST, cursor: 'old' }]),
      pull: () => pulled([page(LIST, { cursor: 'new' })]),
    });

    await run(() =>
      engine.receivePoke(
        poke(SyncPokeKind.ScopeChanged, 'new', 'other-device'),
      ),
    );

    expect(pulls).toHaveLength(1);
  });

  it('reads a list it does not hold as one gained', async () => {
    await started({
      pull: () =>
        pulled([
          page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]),
      snapshot: () => wholeList([line('row-1')], { cursor: 'kept' }),
    });

    await run(() => engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'any')));

    expect(snapshots).toHaveLength(1);
    expect(positionOf(LIST)?.cursor).toBe('kept');
  });

  it('re-reads what is reached when reach changes', async () => {
    const scopes = jest.fn(() => listed([]));
    await started({ scopes });
    scopes.mockClear();

    await run(() => engine.receivePoke(poke(SyncPokeKind.ReachChanged, null)));

    expect(scopes).toHaveBeenCalledTimes(1);
  });

  it('pulls once more, not once per signal, after a burst', async () => {
    hold(LIST, 'old');
    await started({
      scopes: () => listed([{ id: LIST, cursor: 'old' }]),
      pull: ({ scopes }) =>
        pulled([page(LIST, { cursor: `${scopes[0]?.cursor}+` })]),
    });

    engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'a'));
    engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'b'));
    engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'c'));
    await engine.whenSettled();

    expect(pulls.map(({ scopes }) => scopes[0]?.cursor)).toEqual([
      'old',
      'old+',
    ]);
    expect(positionOf(LIST)?.cursor).toBe('old++');
  });

  it('reads again when reach changes during a read', async () => {
    const scopes = jest.fn(() => listed([]));
    await started({ scopes });
    scopes.mockClear();

    engine.catchUp();
    engine.receivePoke(poke(SyncPokeKind.ReachChanged, null));
    await engine.whenSettled();

    expect(scopes).toHaveBeenCalledTimes(2);
  });

  it('owes a failed pull to the next pass', async () => {
    hold(LIST, 'old');
    let answers = 0;
    await started({
      scopes: () => listed([{ id: LIST, cursor: 'old' }]),
      pull: () => {
        answers += 1;
        return answers === 1
          ? fault()
          : pulled([page(LIST, { cursor: 'new' })]);
      },
    });

    await run(() => engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'new')));
    expect(positionOf(LIST)?.cursor).toBe('old');

    await run(() => engine.catchUp());

    expect(positionOf(LIST)?.cursor).toBe('new');
  });

  it('reads what is reached again after a failed read', async () => {
    let answers = 0;
    const scopes = jest.fn(() => {
      answers += 1;
      return answers === 2 ? fault() : listed([]);
    });
    await started({ scopes });

    await run(() => engine.catchUp());
    await run(() => engine.receivePoke(poke(SyncPokeKind.ScopeChanged, 'any')));

    expect(scopes).toHaveBeenCalledTimes(3);
  });
});

describe('a pass outlived by its session', () => {
  it('holds no position after a stop', async () => {
    hold(LIST, 'old');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'moved' }]),
      pull: () => pulled([page(LIST, { cursor: 'next' })]),
    });

    engine.start();
    engine.stop();
    await engine.whenSettled();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });
});

describe('a page that cannot be applied', () => {
  it('keeps the position, so the next pull answers it again', async () => {
    hold(LIST, 'old');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'moved' }]),
    });
    jest.spyOn(listFeedAdapter, 'pull').mockResolvedValue({
      data: [
        {
          scopeId: LIST,
          status: SyncPageStatus.Current,
          cursor: 'next',
          hasMore: false,
          applied: [],
          apply: () => {
            throw new Error('Could not place a row');
          },
        },
      ],
    });

    await run();

    expect(positionOf(LIST)?.cursor).toBe('old');
  });
});

describe('a queued write on a list that leaves', () => {
  it('stays queued, for its replay to reach the changes not saved', async () => {
    queueStore.setCurrentUserId('user-1');
    queueStore.addMutation(
      makeQueuedMutation({
        id: 'queued-edit',
        userId: 'user-1',
        ...queuedMutationFor(UpdateShoppingListItemDocument),
        variables: { input: { id: 'row-1', version: 3, notes: 'Two' } },
      }),
    );
    mockClient = clientOver({ scopes: () => listed([]) });
    hold(LIST, 'old');

    await run();

    expect(positionOf(LIST)).toBeUndefined();
    expect(queueStore.getMutation('queued-edit')).toBeTruthy();
    queueStore.removeMutation('queued-edit');
  });
});

describe('a pending write', () => {
  it('rebuilds over what a page wrote', async () => {
    hold(LIST, 'old');
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'moved' }]),
      pull: () => pulled([page(LIST, { cursor: 'next' })]),
    });
    const rebuild = jest.spyOn(
      pendingWritesOf(mockClient.cache),
      'scheduleRebuild',
    );

    await run();

    expect(rebuild).toHaveBeenCalled();
  });
});
