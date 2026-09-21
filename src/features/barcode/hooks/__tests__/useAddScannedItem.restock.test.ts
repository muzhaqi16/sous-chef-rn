import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  renderHookWithApollo,
  type MockDataFor,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { BarcodeRestockPantryItemDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { useAddScannedItem } from '../useAddScannedItem';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

/**
 * Offline no payload arrives, so the row is bumped locally; online the payload
 * carries the server's count and the version the restock bumped.
 */

const QUANTITY = gql`
  fragment _RestockProbe on PantryItem {
    id
    quantity
  }
`;

const ROW_ID = 'pi-oats';

function cacheWithRow(quantity: number) {
  const cache = makeCache();
  cache.writeFragment({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: QUANTITY,
    data: { __typename: 'PantryItem', id: ROW_ID, quantity },
  });
  return cache;
}

const readQuantity = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<{ quantity: number }>({
    id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
    fragment: QUANTITY,
  })?.quantity;

const restockAnswer = (
  data: MockDataFor<typeof BarcodeRestockPantryItemDocument>,
): MockFor<typeof BarcodeRestockPantryItemDocument> => ({
  request: {
    query: BarcodeRestockPantryItemDocument,
    variables: () => true,
  },
  result: { data },
});

describe('restocking the row a scan duplicated', () => {
  it('counts the scanned unit on the row it restocked', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'RestockPantryItemPayload',
              pantryItemUsage: {
                __typename: 'PantryItemUsage',
                pantryItem: {
                  __typename: 'PantryItem',
                  id: ROW_ID,
                  quantity: 4,
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(ROW_ID);
    });

    expect(readQuantity(cache)).toBe(4);
  });

  it('puts the count back when the restock is refused', async () => {
    const cache = cacheWithRow(3);
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'NotFoundError',
              code: ErrorCode.NotFound,
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(ROW_ID);
    });

    expect(readQuantity(cache)).toBe(3);
  });

  it('takes the version the restock returns, so the next edit is not a conflict', async () => {
    const VERSION = gql`
      fragment _RestockVersionProbe on PantryItem {
        id
        version
      }
    `;
    const cache = cacheWithRow(3);
    cache.writeFragment({
      id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
      fragment: VERSION,
      data: { __typename: 'PantryItem', id: ROW_ID, version: 4 },
    });
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: 'p-1', shoppingListId: undefined }),
      {
        cache,
        operationMocks: [
          restockAnswer({
            restockPantryItem: {
              __typename: 'RestockPantryItemPayload',
              pantryItemUsage: {
                __typename: 'PantryItemUsage',
                pantryItem: {
                  __typename: 'PantryItem',
                  id: ROW_ID,
                  quantity: 4,
                  version: 5,
                },
              },
            },
          }),
        ],
      },
    );

    await act(async () => {
      await result.current.restockDuplicate(ROW_ID);
    });

    expect(
      cache.readFragment<{ version: number }>({
        id: cache.identify({ __typename: 'PantryItem', id: ROW_ID }),
        fragment: VERSION,
      })?.version,
    ).toBe(5);
  });
});
