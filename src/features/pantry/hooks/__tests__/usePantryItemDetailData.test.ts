import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetPantryItemBatchesDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import { usePantryItemDetailData } from '../usePantryItemDetailData';

jest.mock('#/apollo/links/tokenScheduler');

async function loadItem() {
  const cache = makeCache();
  const item = recordMock(GetPantryItemDocument, {
    data: {
      pantryItem: { __typename: 'PantryItem', id: 'pi-1', itemName: 'Milk' },
    },
  });
  const batches = recordMock(GetPantryItemBatchesDocument, {
    data: {
      pantryItemBatchesConnection: {
        totalCount: 2,
        edges: [
          {
            node: {
              __typename: 'PantryItemBatch',
              id: 'b1',
              status: BatchStatus.Active,
            },
          },
          {
            node: {
              __typename: 'PantryItemBatch',
              id: 'b2',
              status: BatchStatus.Active,
            },
          },
        ],
      },
    },
  });
  const rendered = renderHookWithApollo(() => usePantryItemDetailData('pi-1'), {
    operationMocks: [item.mock, batches.mock],
    cache,
  });
  await waitFor(() => {
    expect(rendered.result.current.item?.itemName).toBe('Milk');
    expect(rendered.result.current.batches).toHaveLength(2);
  });
  return { cache, ...rendered };
}

describe('usePantryItemDetailData', () => {
  // Each edit below changes only the entity itself, so neither query's result
  // is a new object.
  it("follows a batch's own edit", async () => {
    const { cache, result } = await loadItem();

    await act(async () => {
      cache.modify({
        id: cache.identify({ __typename: 'PantryItemBatch', id: 'b1' }),
        fields: { status: () => BatchStatus.Wasted },
      });
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(result.current.batches.map(b => b.status)).toEqual([
        BatchStatus.Wasted,
        BatchStatus.Active,
      ]),
    );
  });

  it("follows the item's own edit", async () => {
    const { cache, result } = await loadItem();

    await act(async () => {
      cache.modify({
        id: cache.identify({ __typename: 'PantryItem', id: 'pi-1' }),
        fields: { itemName: () => 'Oat milk' },
      });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.item?.itemName).toBe('Oat milk'));
  });
});
