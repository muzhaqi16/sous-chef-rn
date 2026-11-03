import { gql, type ApolloClient } from '@apollo/client';
import { FeedEngine } from '#/apollo/feed/feedEngine';
import { clearPositions, positionOf } from '#/apollo/feed/feedPositions';
import { scopesNamedBy } from '#/apollo/feed/feedRegistry';
import {
  SyncPageStatus,
  SyncPokeKind,
  SyncScopeKind,
} from '#/graphql/generated/schemaTypes';
import { seedQuery } from '#/test-utils/apolloMockProvider';
import {
  clientOver,
  itemsOf,
  line,
  LIST,
  listed,
  page,
  pulled,
  pulls,
  snapshots,
  wholeList,
} from '#/test-utils/feedServer';
import {
  GetShoppingListDetailsDocument,
  GetShoppingListsLiteDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useStore } from '#store';
import { ListFeed_CollaboratorsFragmentDoc } from '../listFeed.generated';

jest.mock('#/services/auth/deviceId');

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const LIST_TOTALS = gql`
  fragment FeedListTotals on ShoppingList {
    id
    totalItems
  }
`;

const list = (totalItems: number) => ({
  __typename: 'ShoppingList',
  id: LIST,
  version: 2,
  homeId: 'home-1',
  isTemplate: false,
  totalItems,
});

const collaborator = (id: string) => ({
  __typename: 'ShoppingListCollaborator',
  id,
  shoppingList: { id: LIST },
});

const membersOf = (client: ApolloClient) =>
  client.cache
    .readFragment({
      id: client.cache.identify({ __typename: 'ShoppingList', id: LIST }),
      fragment: ListFeed_CollaboratorsFragmentDoc,
      fragmentName: 'listFeed_collaborators',
    })
    ?.collaboratorsConnection.edges.map(edge => edge.node.id);

let engine: FeedEngine;

/** The same device, its cache kept, answered by another server. */
function answeredBy(client: ApolloClient, next: ApolloClient): ApolloClient {
  Object.defineProperty(next, 'cache', { value: client.cache });
  mockClient = next;
  return next;
}

/** A list held at `kept`, from a full read of `rows`, then one pull's `changed`. */
async function pullAfter(
  rows: unknown[],
  changes: Record<string, unknown>,
): Promise<ApolloClient> {
  mockClient = clientOver({
    scopes: () => listed([{ id: LIST, cursor: 'latest' }]),
    pull: ({ scopes }) => {
      const [{ cursor } = { cursor: null }] = scopes;
      if (cursor === null) {
        return pulled([
          page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]);
      }
      return pulled([page(LIST, { cursor: 'latest', ...changes })]);
    },
    snapshot: () => wholeList(rows, { cursor: 'kept' }),
  });
  engine.start();
  await engine.whenSettled();
  return mockClient;
}

beforeEach(() => {
  pulls.length = 0;
  snapshots.length = 0;
  clearPositions();
  useStore.setState({ isOnline: true, apiReachable: true });
  engine = new FeedEngine();
});

afterEach(() => engine.stop());

describe('a page on a held list', () => {
  it('shows a line another member added, in the list screen’s own read', async () => {
    const client = await pullAfter([list(1), line('row-1')], {
      changed: [list(2), line('row-2')],
    });

    expect(itemsOf(client, false)).toEqual(
      expect.arrayContaining(['row-1', 'row-2']),
    );
  });

  it('moves a line another member ticked', async () => {
    const client = await pullAfter([list(1), line('row-1')], {
      changed: [list(1), line('row-1', true)],
    });

    expect(itemsOf(client, false)).toEqual([]);
    expect(itemsOf(client, true)).toEqual(['row-1']);
  });

  it('takes out a line another member removed', async () => {
    const client = await pullAfter([list(2), line('row-1'), line('row-2')], {
      changed: [list(1)],
      removed: [{ entityType: 'ShoppingListItem', id: 'row-1' }],
    });

    expect(itemsOf(client, false)).toEqual(['row-2']);
  });

  it('states the totals the page gives, adjusting nothing on top', async () => {
    const client = await pullAfter([list(2), line('row-1'), line('row-2')], {
      changed: [list(1)],
      removed: [{ entityType: 'ShoppingListItem', id: 'row-1' }],
    });

    const totals = client.cache.readFragment<{ totalItems: number }>({
      id: client.cache.identify({ __typename: 'ShoppingList', id: LIST }),
      fragment: LIST_TOTALS,
    });
    expect(totals?.totalItems).toBe(1);
  });

  it('ignores a removal of a type it does not know', async () => {
    const client = await pullAfter([list(1), line('row-1')], {
      removed: [{ entityType: 'ShoppingListNote', id: 'note-1' }],
    });

    expect(itemsOf(client, false)).toEqual(['row-1']);
    expect(positionOf(LIST)?.cursor).toBe('latest');
  });
});

describe('a list known only through the feed', () => {
  it('is complete for its own details, so it opens offline', async () => {
    const client = await pullAfter([list(1), line('row-1')], {});

    const { complete, missing } = client.cache.diff({
      query: GetShoppingListDetailsDocument,
      variables: { id: LIST },
      returnPartialData: true,
      optimistic: false,
    });

    expect(missing).toBeUndefined();
    expect(complete).toBe(true);
  });
});

describe('a full read of a held list', () => {
  it('takes out a row the read does not hold', async () => {
    const client = await pullAfter([list(1), line('row-1')], {});
    expect(itemsOf(client, false)).toEqual(['row-1']);

    clearPositions();
    const reread = answeredBy(
      client,
      clientOver({
        scopes: () => listed([{ id: LIST, cursor: 'latest' }]),
        pull: ({ scopes }) =>
          pulled([
            scopes[0]?.cursor === null
              ? page(LIST, {
                  status: SyncPageStatus.ResyncRequired,
                  cursor: null,
                })
              : page(LIST, { cursor: 'latest' }),
          ]),
        snapshot: () => wholeList([list(1), line('row-2')], { cursor: 'kept' }),
      }),
    );
    engine.catchUp();
    await engine.whenSettled();

    expect(itemsOf(reread, false)).toEqual(['row-2']);
    expect(client.cache.extract()).not.toHaveProperty('ShoppingListItem:row-1');
  });

  it('holds every line of a list longer than a page', async () => {
    const lines = Array.from({ length: 130 }, (_, index) =>
      line(`row-${index}`),
    );
    const client = await pullAfter([list(130), ...lines], {});

    expect(itemsOf(client, false)).toHaveLength(130);
  });

  it('is what the list’s collaborators read', async () => {
    const client = await pullAfter(
      [list(0), collaborator('person-1'), collaborator('person-2')],
      {
        removed: [{ entityType: 'ShoppingListCollaborator', id: 'person-1' }],
      },
    );

    expect(client.cache.extract()).not.toHaveProperty(
      'ShoppingListCollaborator:person-1',
    );
    expect(client.cache.extract()).toHaveProperty(
      'ShoppingListCollaborator:person-2',
    );
  });
});

describe('a collaborator', () => {
  it('leaves the members when removed, and returns when invited back', async () => {
    mockClient = clientOver({
      scopes: () => listed([{ id: LIST, cursor: 'removed' }]),
      pull: ({ scopes }) => {
        const [{ cursor } = { cursor: null }] = scopes;
        if (cursor === null) {
          return pulled([
            page(LIST, { status: SyncPageStatus.ResyncRequired, cursor: null }),
          ]);
        }
        return pulled([
          cursor === 'kept'
            ? page(LIST, {
                cursor: 'removed',
                removed: [
                  { entityType: 'ShoppingListCollaborator', id: 'person-1' },
                ],
              })
            : page(LIST, {
                cursor: 'invited',
                changed: [collaborator('person-1')],
              }),
        ]);
      },
      snapshot: () =>
        wholeList(
          [list(0), collaborator('person-1'), collaborator('person-2')],
          { cursor: 'kept' },
        ),
    });
    engine.start();
    await engine.whenSettled();
    expect(membersOf(mockClient)).toEqual(['person-2']);

    engine.receivePoke({
      __typename: 'SyncPoke',
      kind: SyncPokeKind.ScopeChanged,
      scope: {
        __typename: 'SyncScope',
        kind: SyncScopeKind.ShoppingList,
        id: LIST,
        cursor: 'invited',
      },
      originDeviceId: null,
      originOperationId: null,
    });
    await engine.whenSettled();

    expect(membersOf(mockClient)).toEqual(['person-2', 'person-1']);
  });
});

describe('a list the person no longer reaches', () => {
  it('leaves the lists the picker reads, which moves the screen to another', async () => {
    const client = await pullAfter([list(1), line('row-1')], {});
    seedQuery(client.cache, {
      query: GetShoppingListsLiteDocument,
      variables: { first: 50 },
      data: {
        shoppingLists: {
          edges: [
            { node: { __typename: 'ShoppingList', id: LIST } },
            { node: { __typename: 'ShoppingList', id: 'list-2' } },
          ],
        },
      },
    });

    answeredBy(
      client,
      clientOver({ scopes: () => listed([{ id: 'list-2', cursor: 'c' }]) }),
    );
    engine.catchUp();
    await engine.whenSettled();

    expect(positionOf(LIST)).toBeUndefined();
    expect(
      client.cache
        .readQuery({
          query: GetShoppingListsLiteDocument,
          variables: { first: 50 },
        })
        ?.shoppingLists.edges.map(edge => edge.node.id),
    ).toEqual(['list-2']);
  });
});

describe('the lists a queued write names', () => {
  it('places a line by its list, a list by itself, and ignores the rest', async () => {
    const client = await pullAfter([list(1), line('row-1')], {});

    expect(
      scopesNamedBy(client.cache, [
        { input: { id: 'row-1', itemName: 'Oat milk' } },
        { listId: LIST, now: '2026-11-03T00:00:00.000Z' },
      ]),
    ).toEqual([LIST]);
  });

  it('names no list for a write that touches none', async () => {
    const client = await pullAfter([list(1), line('row-1')], {});

    expect(
      scopesNamedBy(client.cache, [{ input: { pantryItemId: 'stack-1' } }]),
    ).toEqual([]);
  });
});
