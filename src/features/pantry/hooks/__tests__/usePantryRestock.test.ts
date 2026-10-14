import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreatePantryItemDocument,
  GetPantryItemBatchesDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { usePantryRestock } from '../usePantryRestock';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const ROW_ID = 'pi-oats';

const ROW = gql`
  fragment _PantryRestockRow on PantryItem {
    id
    quantity
    heldQuantity
    activeBatchCount
    unit {
      id
      symbol
    }
  }
`;

type Row = {
  quantity: number;
  heldQuantity: number;
  activeBatchCount: number;
};

function cacheWithRow(held = 3) {
  const cache = makeCache();
  cache.writeFragment({
    fragment: ROW,
    data: {
      __typename: 'PantryItem',
      id: ROW_ID,
      quantity: held,
      heldQuantity: held,
      activeBatchCount: 1,
      unit: { __typename: 'Unit', id: 'unit-bag', symbol: 'bag' },
    },
  });
  return cache;
}

const readRow = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<Row>({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: ROW,
  });

/** A queued local-first write: `queueLink` resolves with a null payload. */
const queuedRestock = () => {
  const data: MockDataFor<typeof RestockPantryItemDocument> = {
    restockPantryItem: null,
  };
  return recordMock(RestockPantryItemDocument, { data });
};

const refusedRestock = (code: ErrorCode = ErrorCode.ValidationFailed) =>
  recordMock(RestockPantryItemDocument, {
    data: {
      restockPantryItem: {
        __typename: 'ValidationError',
        code,
        message: 'nope',
        field: 'amount',
      },
    },
  });

const appliedRestock = () =>
  recordMock(RestockPantryItemDocument, {
    data: {
      restockPantryItem: {
        __typename: 'RestockPantryItemPayload',
        pantryItemUsage: {
          __typename: 'PantryItemUsage',
          pantryItem: { __typename: 'PantryItem', id: ROW_ID },
        },
      },
    },
  });

describe('usePantryRestock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('moves the row at once for a measured amount, offline included', async () => {
    const cache = cacheWithRow(3);
    const restock = queuedRestock();
    const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
      cache,
      operationMocks: [restock.mock],
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.restock(ROW_ID, {
        amount: { measured: { quantity: 2 } },
        present: 'none',
      });
    });

    expect(outcome).toEqual({ status: 'restocked' });
    expect(readRow(cache)).toMatchObject({
      quantity: 5,
      heldQuantity: 5,
      activeBatchCount: 2,
    });
    const [fired] = restock.fired;
    expect(fired?.input).toMatchObject({
      id: ROW_ID,
      amount: { measured: { quantity: 2 } },
      today: fired?.today,
      idempotencyKey: expect.any(String),
    });
  });

  it('leaves the amount to the server for packages', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
      cache,
      operationMocks: [queuedRestock().mock],
    });

    await act(async () => {
      await result.current.restock(ROW_ID, {
        amount: { packages: { count: 1 } },
        present: 'none',
      });
    });

    expect(readRow(cache)).toMatchObject({ quantity: 3, heldQuantity: 3 });
  });

  it('puts the amount and the batch count back when the restock is refused', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
      cache,
      operationMocks: [refusedRestock().mock],
    });

    let outcome;
    await act(async () => {
      outcome = await result.current.restock(ROW_ID, {
        amount: { measured: { quantity: 2 } },
        present: 'none',
      });
    });

    expect(outcome).toEqual({ status: 'rejected' });
    expect(readRow(cache)).toMatchObject({
      quantity: 3,
      heldQuantity: 3,
      activeBatchCount: 1,
    });
  });

  it('runs the handler the caller gave for a refusal code', async () => {
    const onUnitInvalid = jest.fn();
    const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
      cache: cacheWithRow(),
      operationMocks: [refusedRestock(ErrorCode.UnitInvalid).mock],
    });

    await act(async () => {
      await result.current.restock(ROW_ID, {
        amount: { measured: { quantity: 1, unitId: 'unit-slice' } },
        present: 'none',
        on: { [TopLevelErrorCode.UnitInvalid]: onUnitInvalid },
      });
    });

    expect(onUnitInvalid).toHaveBeenCalledTimes(1);
  });

  describe('a count bought with no unit', () => {
    const OATS = { source: { id: 'item-oats' }, name: 'Oats' };

    it('restocks a counted stack by the count, in its unit', async () => {
      // The row's unit (bag) is counted.
      const cache = cacheWithRow(3);
      cache.writeFragment({
        id: cache.identify({ __typename: 'Unit', id: 'unit-bag' }),
        fragment: gql`
          fragment _CountedBag on Unit {
            id
            type
          }
        `,
        data: { __typename: 'Unit', id: 'unit-bag', type: 'COUNT' },
      });
      const restock = queuedRestock();
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache,
        operationMocks: [restock.mock],
      });

      await act(async () => {
        await result.current.restock(ROW_ID, {
          bought: { count: 1, item: OATS },
          present: 'none',
        });
      });

      expect(restock.fired[0]?.input).toMatchObject({
        amount: { measured: { quantity: 1, unitId: 'unit-bag' } },
      });
    });

    it('adds packages nothing sizes as the API counts an add, not as a restock', async () => {
      // The API refuses them on a restock.
      const create = recordMock(CreatePantryItemDocument, {
        data: { createPantryItem: null },
      });
      const restock = queuedRestock();
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache: makeCache(),
        operationMocks: [create.mock, restock.mock],
      });

      let outcome;
      await act(async () => {
        outcome = await result.current.restock(ROW_ID, {
          bought: { count: 2, item: OATS },
          present: 'none',
        });
      });

      expect(outcome).toEqual({ status: 'restocked' });
      expect(restock.fired).toHaveLength(0);
      expect(create.fired[0]?.input).toMatchObject({
        item: { id: 'item-oats' },
        amount: { packages: { count: 2 } },
        forceAdd: true,
      });
    });

    it('restocks packages of a known size, which the API sizes', async () => {
      const size = { netWeight: 500, netWeightUnitId: 'unit-ml' };
      const restock = queuedRestock();
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache: makeCache(),
        operationMocks: [restock.mock],
      });

      await act(async () => {
        await result.current.restock(ROW_ID, {
          bought: { count: 1, packageSize: size, item: OATS },
          present: 'none',
        });
      });

      expect(restock.fired[0]?.input).toMatchObject({
        amount: { packages: { count: 1, size } },
      });
    });
  });

  describe('the batches the server builds', () => {
    const cacheWithBatches = () => {
      const cache = cacheWithRow();
      cache.writeQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: ROW_ID },
        data: {
          __typename: 'Query',
          pantryItemBatchesConnection: {
            __typename: 'PantryItemBatchConnection',
            totalCount: 0,
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            edges: [],
          },
        },
      });
      return cache;
    };
    const readBatches = (cache: ReturnType<typeof makeCache>) =>
      cache.readQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: ROW_ID },
      });

    it('are dropped for a refetch once the server answered', async () => {
      const cache = cacheWithBatches();
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache,
        operationMocks: [appliedRestock().mock],
      });

      await act(async () => {
        await result.current.restock(ROW_ID, {
          amount: { measured: { quantity: 1 } },
          present: 'none',
        });
      });

      expect(readBatches(cache)).toBeNull();
    });

    it('are kept while the restock waits in the queue', async () => {
      const cache = cacheWithBatches();
      const { result } = renderHookWithApollo(() => usePantryRestock('p-1'), {
        cache,
        operationMocks: [queuedRestock().mock],
      });

      await act(async () => {
        await result.current.restock(ROW_ID, {
          amount: { measured: { quantity: 1 } },
          present: 'none',
        });
      });

      expect(readBatches(cache)).not.toBeNull();
    });
  });
});
