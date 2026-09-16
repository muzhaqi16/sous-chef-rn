'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  DeletePantryItemDocument,
  GetPantryDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  AcquisitionMethod,
  ErrorCode,
  ItemCondition,
  StorageState,
} from '#/graphql/generated/schemaTypes';
import { usePantryItemSelection } from '../usePantryItemSelection';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerPendingDelete: jest.fn(),
    unregisterPendingDelete: jest.fn(),
  },
}));

const PANTRY_VARS = { id: 'p1', itemsFirst: 100 };
// Completed from the SDL; only what the assertions read is stated.
const PANTRY = {
  pantry: {
    __typename: 'Pantry' as const,
    id: 'p1',
    stats: { totalItems: 1 },
    itemsConnection: {
      totalCount: 1,
      pageInfo: { hasNextPage: false, endCursor: null },
      edges: [{ node: { id: 'pi-1', item: { id: 'cat-eggs' } } }],
    },
  },
};

const ONBOARDING_INPUT = {
  itemId: 'cat-milk',
  quantity: null,
  storage: {
    storageState: StorageState.Ambient,
    condition: ItemCondition.Good,
  },
  purchase: { acquisitionMethod: AcquisitionMethod.Purchased },
};

beforeEach(() => {
  jest.clearAllMocks();
});

function readPantry(cache: ReturnType<typeof makeCache>) {
  const pantry = cache.readQuery<Unmasked<GetPantryQuery>>({
    query: GetPantryDocument,
    variables: PANTRY_VARS,
  })?.pantry;
  return {
    rows: pantry?.itemsConnection.edges.map(e => e.node) ?? [],
    totalItems: pantry?.stats.totalItems,
  };
}

const catalogIds = (cache: ReturnType<typeof makeCache>) =>
  readPantry(cache).rows.map(row => row.item.id);

const rowIds = (cache: ReturnType<typeof makeCache>) =>
  readPantry(cache).rows.map(row => row.id);

async function setup(
  cache: ReturnType<typeof makeCache>,
  mutationMock: ReturnType<typeof recordMock>,
) {
  const getPantry = recordMock(GetPantryDocument, { data: PANTRY });
  const rendered = renderHookWithApollo(() => usePantryItemSelection('p1'), {
    cache,
    operationMocks: [getPantry.mock, mutationMock.mock],
  });
  // The pantry read lands before any write, so it cannot race one.
  await waitFor(() => expect(rendered.result.current.hasLoaded).toBe(true));
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  expect(rowIds(cache)).toEqual(['pi-1']);
  return { ...rendered, getPantry };
}

describe('usePantryItemSelection.addItem', () => {
  it('shows an offline (queued) create in the pantry list and keeps it', async () => {
    const cache = makeCache();
    const queued = recordMock(CreatePantryItemDocument, {
      data: { createPantryItem: null },
      partial: true,
    });
    const { result } = await setup(cache, queued);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.addItem('Milk', ONBOARDING_INPUT);
    });

    expect(outcome).toEqual({ status: 'added' });
    expect(catalogIds(cache)).toContain('cat-milk');
    const added = readPantry(cache).rows.find(r => r.item.id === 'cat-milk');
    expect(added?.itemName).toBe('Milk');
    expect(added?.storageState).toBe(StorageState.Ambient);
    expect(readPantry(cache).totalItems).toBe(2);
    expect(queued.fired).toEqual([
      {
        input: expect.objectContaining({
          ...ONBOARDING_INPUT,
          id: added?.id,
          pantryId: 'p1',
        }),
      },
    ]);
  });

  it('withdraws the row, count included, when the server refuses the create', async () => {
    const cache = makeCache();
    const refused = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'itemId',
        },
      },
    });
    const { result } = await setup(cache, refused);

    let outcome: unknown;
    await act(async () => {
      const pending = result.current.addItem('Milk', ONBOARDING_INPUT);
      expect(catalogIds(cache)).toContain('cat-milk');
      outcome = await pending;
    });

    expect(outcome).toEqual({ status: 'rejected' });
    expect(catalogIds(cache)).not.toContain('cat-milk');
    expect(readPantry(cache).totalItems).toBe(1);
  });

  it('withdraws the row and reports a duplicate as a skip, not a failure', async () => {
    const cache = makeCache();
    const duplicate = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'DuplicatePantryItemError',
          code: ErrorCode.PantryItemAlreadyExists,
          existingPantryItemIds: ['pi-1'],
        },
      },
    });
    const { result } = await setup(cache, duplicate);

    let outcome: unknown;
    await act(async () => {
      const pending = result.current.addItem('Milk', ONBOARDING_INPUT);
      expect(catalogIds(cache)).toContain('cat-milk');
      outcome = await pending;
    });

    expect(outcome).toEqual({
      status: 'duplicate',
      existingPantryItemId: 'pi-1',
    });
    expect(catalogIds(cache)).not.toContain('cat-milk');
    expect(readPantry(cache).totalItems).toBe(1);
    const { alertService } = jest.requireMock('#/services/alertService');
    expect(alertService.alert).not.toHaveBeenCalled();
  });
});

describe('usePantryItemSelection.removeItem', () => {
  it('removes the row before the delete settles and keeps the removal when it is queued', async () => {
    const cache = makeCache();
    const queued = recordMock(DeletePantryItemDocument, {
      data: { deletePantryItem: null },
      partial: true,
    });
    const { result } = await setup(cache, queued);

    await act(async () => {
      const pending = result.current.removeItem('pi-1');
      expect(rowIds(cache)).not.toContain('pi-1');
      await pending;
    });

    expect(queued.fired).toEqual([{ input: { id: 'pi-1' } }]);
    expect(rowIds(cache)).not.toContain('pi-1');
    expect(readPantry(cache).totalItems).toBe(0);
  });

  it('restores the row through a refetch when the server refuses the delete', async () => {
    const cache = makeCache();
    const refused = recordMock(DeletePantryItemDocument, {
      data: {
        deletePantryItem: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        },
      },
    });
    const { result, getPantry } = await setup(cache, refused);

    await act(async () => {
      await result.current.removeItem('pi-1');
    });

    await waitFor(() => expect(getPantry.fired).toHaveLength(2));
    await waitFor(() => expect(rowIds(cache)).toContain('pi-1'));
    expect(readPantry(cache).totalItems).toBe(1);
  });
});
