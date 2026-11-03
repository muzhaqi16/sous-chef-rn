import { gql, type ApolloClient } from '@apollo/client';
import { FeedEngine } from '#/apollo/feed/feedEngine';
import { clearPositions, positionOf } from '#/apollo/feed/feedPositions';
import { SyncPageStatus, SyncScopeKind } from '#/graphql/generated/schemaTypes';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';
import {
  clientOver,
  page,
  pantryPulls,
  pulled,
  summaries,
  wholeList,
} from '#/test-utils/feedServer';
import {
  GetPantryDocument,
  GetPantryItemBatchesDocument,
} from '#features/pantry/graphql/pantry.generated';
import { useStore } from '#store';
import { replacePantryStacks } from '#features/pantry/cache/feedRows';

jest.mock('#/services/auth/deviceId');

let mockClient: ApolloClient | null = null;
jest.mock('#/apollo/clientRegistry', () => ({
  getApolloClient: () => mockClient,
  requireApolloClient: () => mockClient,
  registerApolloClient: jest.fn(),
  clearApolloClient: jest.fn(),
}));

const PANTRY = 'pantry-1';

const STACKS = gql`
  fragment TestPantryStacks on Pantry {
    id
    itemsConnection(first: 50) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const FROZEN_STACKS = gql`
  fragment TestFrozenStacks on Pantry {
    id
    itemsConnection(filters: { storageState: FROZEN }, first: 50) {
      edges {
        node {
          id
        }
      }
    }
  }
`;

const pantry = () => ({
  __typename: 'Pantry',
  id: PANTRY,
  version: 1,
  homeId: 'home-1',
});

const stack = (id: string, overrides: Record<string, unknown> = {}) => ({
  __typename: 'PantryItem',
  id,
  version: 1,
  pantryId: PANTRY,
  storageState: 'REFRIGERATED',
  ...overrides,
});

const batch = (id: string, pantryItemId: string) => ({
  __typename: 'PantryItemBatch',
  id,
  version: 1,
  pantryItemId,
});

const listedPantry = (cursor: string) => ({
  data: {
    syncScopes: {
      edges: [{ node: { kind: SyncScopeKind.Pantry, id: PANTRY, cursor } }],
      pageInfo: { hasNextPage: false, endCursor: null },
    },
  },
});

let engine: FeedEngine;

/** A pantry held at `kept` from a full read of `rows`, then one pull's changes. */
async function pullAfter(
  rows: unknown[],
  changes: Record<string, unknown>,
  before: (client: ApolloClient) => void = () => {},
): Promise<ApolloClient> {
  const client = clientOver({
    scopes: () => listedPantry('latest'),
    pantryPull: ({ scopes }) => {
      const [{ cursor } = { cursor: null }] = scopes;
      if (cursor === null) {
        return pulled([
          page(PANTRY, { status: SyncPageStatus.ResyncRequired, cursor: null }),
        ]);
      }
      before(client);
      return pulled([page(PANTRY, { cursor: 'latest', ...changes })]);
    },
    pantrySnapshot: () => wholeList(rows, { cursor: 'kept' }),
  });
  mockClient = client;
  engine.start([SyncScopeKind.Pantry]);
  await engine.whenSettled();
  return client;
}

const stacksOf = (client: ApolloClient) =>
  client.cache
    .readFragment<{ itemsConnection: { edges: { node: { id: string } }[] } }>({
      id: `Pantry:${PANTRY}`,
      fragment: STACKS,
    })
    ?.itemsConnection.edges.map(edge => edge.node.id);

beforeEach(() => {
  pantryPulls.length = 0;
  summaries.length = 0;
  clearPositions();
  useStore.setState({ isOnline: true, apiReachable: true });
  engine = new FeedEngine();
});

afterEach(() => engine.stop());

describe('a full read of a pantry', () => {
  it('holds its stacks in the unfiltered list, at the first page’s position', async () => {
    const client = await pullAfter(
      [pantry(), stack('stack-1'), stack('stack-2')],
      {},
    );

    expect(stacksOf(client)).toEqual(['stack-1', 'stack-2']);
    expect(positionOf(PANTRY)?.cursor).toBe('latest');
  });

  // The mock answers a read by its variables once, so the later read is the replace alone.
  it('takes out a stack a later read does not hold', async () => {
    const client = await pullAfter(
      [pantry(), stack('stack-1'), stack('stack-2')],
      {},
    );

    client.cache.batch({
      optimistic: false,
      update: cache => replacePantryStacks(cache, PANTRY, ['stack-2']),
    });

    expect(stacksOf(client)).toEqual(['stack-2']);
    expect(client.cache.extract()).not.toHaveProperty('PantryItem:stack-1');
  });
});

describe('a pantry known only through the feed', () => {
  it('is complete for the pantry screen, so it opens offline', async () => {
    const client = await pullAfter([pantry(), stack('stack-1')], {});

    expect(
      client.cache.readQuery({
        query: GetPantryDocument,
        variables: { id: PANTRY, today: '2026-11-03', itemsFirst: 100 },
      })?.pantry?.id,
    ).toBe(PANTRY);
  });
});

describe('a page on a held pantry', () => {
  it('shows a stack another member added', async () => {
    const client = await pullAfter([pantry(), stack('stack-1')], {
      changed: [pantry(), stack('stack-2')],
    });

    expect(stacksOf(client)).toEqual(
      expect.arrayContaining(['stack-1', 'stack-2']),
    );
  });

  it('takes out a stack another member removed', async () => {
    const client = await pullAfter([pantry(), stack('stack-1')], {
      changed: [pantry()],
      removed: [{ entityType: 'PantryItem', id: 'stack-1' }],
    });

    expect(stacksOf(client)).toEqual([]);
    expect(client.cache.extract()).not.toHaveProperty('PantryItem:stack-1');
  });

  it('reads the server’s filtered lists again, as a page cannot place a stack in them', async () => {
    const client = await pullAfter(
      [pantry(), stack('stack-1')],
      { changed: [pantry(), stack('stack-1', { storageState: 'FROZEN' })] },
      seeded =>
        seedFragment(seeded.cache, {
          id: `Pantry:${PANTRY}`,
          fragment: FROZEN_STACKS,
          data: {
            __typename: 'Pantry',
            id: PANTRY,
            itemsConnection: { edges: [] },
          },
        }),
    );

    expect(
      client.cache.readFragment({
        id: `Pantry:${PANTRY}`,
        fragment: FROZEN_STACKS,
      }),
    ).toBeNull();
    expect(stacksOf(client)).toEqual(['stack-1']);
  });

  it('reads the counts again after a page that moved a stack', async () => {
    await pullAfter([pantry(), stack('stack-1')], {
      changed: [pantry(), stack('stack-2')],
    });

    expect(summaries).toEqual([PANTRY]);
  });

  it('reads no counts for a page that only renamed the pantry', async () => {
    await pullAfter([pantry(), stack('stack-1')], { changed: [pantry()] });

    expect(summaries).toEqual([]);
  });

  it('keeps a batch page that lists the batch, and reads one again that does not', async () => {
    const pageOf = (client: ApolloClient, pantryItemId: string) =>
      client.cache.readQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId },
      });
    const client = await pullAfter(
      [pantry(), stack('stack-1'), stack('stack-2')],
      {
        changed: [
          pantry(),
          batch('batch-1', 'stack-1'),
          batch('batch-9', 'stack-2'),
        ],
      },
      seeded => {
        for (const [stackId, batchId] of [
          ['stack-1', 'batch-1'],
          ['stack-2', 'batch-2'],
        ] as const) {
          seedQuery(seeded.cache, {
            query: GetPantryItemBatchesDocument,
            variables: { pantryItemId: stackId },
            data: {
              pantryItemBatchesConnection: {
                edges: [
                  {
                    node: {
                      __typename: 'PantryItemBatch',
                      id: batchId,
                      pantryItemId: stackId,
                    },
                  },
                ],
              },
            },
          });
        }
      },
    );

    expect(pageOf(client, 'stack-1')).not.toBeNull();
    expect(pageOf(client, 'stack-2')).toBeNull();
  });
});

describe('a pantry the person no longer reaches', () => {
  it('leaves with its stacks', async () => {
    const client = await pullAfter([pantry(), stack('stack-1')], {
      status: SyncPageStatus.Unavailable,
      cursor: null,
    });

    expect(client.cache.extract()).not.toHaveProperty(`Pantry:${PANTRY}`);
    expect(client.cache.extract()).not.toHaveProperty('PantryItem:stack-1');
    expect(positionOf(PANTRY)).toBeUndefined();
  });
});
