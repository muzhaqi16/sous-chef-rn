import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetPantryItemBatchHistoryDocument } from '#features/pantry/graphql/pantry.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { usePantryBatchHistory } from '../usePantryBatchHistory';

jest.mock('#/apollo/links/tokenScheduler');

async function loadHistory() {
  const cache = makeCache();
  const get = recordMock(GetPantryItemBatchHistoryDocument, {
    data: {
      pantryItemBatchesConnection: {
        totalCount: 2,
        pageInfo: { hasNextPage: false, endCursor: null },
        edges: [
          {
            node: {
              id: 'b1',
              batchNumber: 1,
              status: BatchStatus.Active,
              expiresOn: '2030-01-01',
            },
          },
          {
            node: {
              id: 'b2',
              batchNumber: 2,
              status: BatchStatus.Active,
              expiresOn: '2030-02-01',
            },
          },
        ],
      },
    },
  });
  const rendered = renderHookWithApollo(() => usePantryBatchHistory('pi-1'), {
    operationMocks: [get.mock],
    cache,
  });
  await waitFor(() => expect(rendered.result.current.batches).toHaveLength(2));
  return { cache, ...rendered };
}

describe('usePantryBatchHistory', () => {
  // Wasting a batch edits only the batch, so the history query's result stays
  // the same object; the count and the order follow the batch itself.
  it('counts and orders a wasted batch as inactive', async () => {
    const { cache, result } = await loadHistory();
    expect(result.current.activeCount).toBe(2);
    expect(result.current.batches.map(b => b.id)).toEqual(['b1', 'b2']);

    await act(async () => {
      cache.modify({
        id: cache.identify({ __typename: 'PantryItemBatch', id: 'b1' }),
        fields: { status: () => BatchStatus.Wasted },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.activeCount).toBe(1));
    expect(result.current.batches.map(b => b.id)).toEqual(['b2', 'b1']);
  });
});
