import { act, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  GetPantryItemBatchesDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  BatchStatus,
  ErrorCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { usePantryItemDetailData } from '../usePantryItemDetailData';

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

describe('usePantryItemDetailData: an item the server holds nothing for', () => {
  const noSuchItem = (held = false) =>
    recordMock(GetPantryItemDocument, { data: { pantryItem: null }, held });

  /** The read refused top-level, with no data. */
  const refusedWith = (
    code: string,
  ): MockFor<typeof GetPantryItemDocument> => ({
    request: { query: GetPantryItemDocument, variables: { id: 'pi-1' } },
    result: {
      data: null,
      errors: [{ message: 'refused', extensions: { code } }],
    },
  });

  const renderDetail = (item: MockedResponse) =>
    renderHookWithApollo(() => usePantryItemDetailData('pi-1'), {
      operationMocks: [
        item,
        recordMock(GetPantryItemBatchesDocument, {
          data: { pantryItemBatchesConnection: { totalCount: 0, edges: [] } },
        }).mock,
      ],
    });

  afterEach(() => {
    act(() => {
      unconfirmedCreates.confirm('pi-1');
    });
  });

  it('reads an answered null as removed', async () => {
    const { result } = renderDetail(noSuchItem().mock);

    await waitFor(() => expect(result.current.deletedOnServer).toBe(true));
    expect(result.current.item).toBeNull();
    expect(result.current.itemError).toBeUndefined();
  });

  it('reads a RESOURCE_NOT_FOUND refusal as removed', async () => {
    const { result } = renderDetail(
      refusedWith(TopLevelErrorCode.ResourceNotFound),
    );

    await waitFor(() => expect(result.current.deletedOnServer).toBe(true));
  });

  it('waits for the read to settle before calling the item removed', async () => {
    const item = noSuchItem(true);
    const { result } = renderDetail(item.mock);

    expect(result.current.itemLoading).toBe(true);
    expect(result.current.deletedOnServer).toBe(false);

    await act(async () => item.release());
    await waitFor(() => expect(result.current.deletedOnServer).toBe(true));
  });

  it.each<[string, MockedResponse]>([
    [
      'the network fails',
      recordMock(GetPantryItemDocument, { error: new Error('network down') })
        .mock,
    ],
    ['access is refused', refusedWith(ErrorCode.Forbidden)],
  ])('keeps the item when %s', async (_label, item) => {
    const { result } = renderDetail(item);

    await waitFor(() => expect(result.current.itemError).toBeDefined());
    expect(result.current.itemLoading).toBe(false);
    expect(result.current.deletedOnServer).toBe(false);
  });

  it('asks nothing about a create the server has not acknowledged, and trusts the answer once it has', async () => {
    unconfirmedCreates.mark('pi-1');
    const item = noSuchItem();
    const { result } = renderDetail(item.mock);

    expect(result.current.isUnconfirmed).toBe(true);
    expect(result.current.itemLoading).toBe(false);
    expect(result.current.deletedOnServer).toBe(false);
    expect(item.fired).toHaveLength(0);

    act(() => {
      unconfirmedCreates.confirm('pi-1');
    });

    await waitFor(() => expect(item.fired).toEqual([{ id: 'pi-1' }]));
    await waitFor(() => expect(result.current.deletedOnServer).toBe(true));
  });

  // A skipped query keeps serving its last answer, so the null is still held
  // when the id is claimed.
  it('does not read a held null as removed while the create is unconfirmed', async () => {
    const { result } = renderDetail(noSuchItem().mock);
    await waitFor(() => expect(result.current.deletedOnServer).toBe(true));

    act(() => {
      unconfirmedCreates.mark('pi-1');
    });

    await waitFor(() => expect(result.current.isUnconfirmed).toBe(true));
    expect(result.current.deletedOnServer).toBe(false);
  });
});
