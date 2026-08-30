/**
 * A permanently-refused replay must withdraw the COUNT as well as the row.
 *
 * A local-first pantry write moves `Pantry.stats.totalItems` when it publishes
 * its row, because the mutation's `update` callback never runs while the write
 * is queued. Every foreground rejection path pairs that with a withdrawal; this
 * one did not, so the row disappeared and the header went on counting it — and
 * offline no response arrives to correct it. `usePantryScreen` also branches on
 * this count to choose server- against client-side sorting.
 *
 * Uses the REAL cache: the sibling suite mocks it wholesale and so can only
 * assert which helpers were called, never what the store ends up holding.
 */
import { gql, type InMemoryCache } from '@apollo/client';
import { handleQueueFailure } from '../queueFailureHandler';
import type { FailedMutationInfo } from '../types';

jest.mock('#/apollo/client', () => {
  const { makeCache } = jest.requireActual('#/apollo/cache');
  return { client: { cache: makeCache() } };
});
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));
jest.mock('../queueStore', () => ({
  queueStore: { removeMutation: jest.fn() },
}));
jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: { clearEntity: jest.fn() },
}));

const cache = (
  jest.requireMock('#/apollo/client') as { client: { cache: InMemoryCache } }
).client.cache;

const PANTRY = gql`
  query SeedPantry($id: ID!) {
    pantry(id: $id) {
      __typename
      id
      stats {
        __typename
        totalItems
      }
      itemsConnection {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
          }
        }
      }
    }
  }
`;

function seed() {
  cache.writeQuery({
    query: PANTRY,
    variables: { id: 'p-1' },
    data: {
      pantry: {
        __typename: 'Pantry',
        id: 'p-1',
        stats: { __typename: 'PantryStats', totalItems: 2 },
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: 2,
          edges: [
            {
              __typename: 'PantryItemEdge',
              cursor: 'pi-1',
              node: { __typename: 'PantryItem', id: 'pi-1' },
            },
            {
              __typename: 'PantryItemEdge',
              cursor: 'pi-local',
              node: { __typename: 'PantryItem', id: 'pi-local' },
            },
          ],
        },
      },
    },
  });
}

const totalItems = () =>
  (
    cache.extract()['Pantry:p-1'] as {
      stats?: { totalItems?: number };
    }
  )?.stats?.totalItems;

const failure = (
  overrides: Partial<FailedMutationInfo> = {},
): FailedMutationInfo => ({
  mutationId: 'q1',
  operationName: 'CreatePantryItem',
  entityType: 'PantryItem',
  entityId: 'pi-local',
  variables: { input: { id: 'pi-local', pantryId: 'p-1' } },
  error: {
    type: 'server',
    message: 'refused',
    code: 'VALIDATION_ERROR',
    timestamp: 0,
    retryable: false,
  },
  ...overrides,
});

describe('handleQueueFailure withdraws the eager pantry count', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cache.reset();
    seed();
  });

  it('uncounts a create the server permanently refused', () => {
    handleQueueFailure(failure());

    expect(totalItems()).toBe(1);
  });

  it('uncounts a move the server permanently refused', () => {
    handleQueueFailure(
      failure({
        operationName: 'MoveShoppingItemToPantry',
        variables: {
          input: {
            pantryId: 'p-1',
            pantryItemId: 'pi-local',
            shoppingListItemId: 'sli-1',
            removeFromList: false,
          },
        },
      }),
    );

    expect(totalItems()).toBe(1);
  });

  it('leaves the count alone for an operation that never counted', () => {
    handleQueueFailure(failure({ operationName: 'UpdatePantryItem' }));

    expect(totalItems()).toBe(2);
  });

  it('does not uncount twice when the row is already gone', () => {
    handleQueueFailure(failure());
    handleQueueFailure(failure());

    expect(totalItems()).toBe(1);
  });
});
