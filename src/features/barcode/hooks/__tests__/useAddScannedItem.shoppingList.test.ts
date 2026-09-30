import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  renderHookWithApollo,
  type MockDataFor,
  type MockFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import type { ScannedItem } from '#features/barcode/store/barcodeScannerStore';
import { useAddScannedItem } from '../useAddScannedItem';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const LIST_ID = 'list-1';

const COUNTS = gql`
  fragment _ScannedListCountsProbe on ShoppingList {
    id
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

const STATED = {
  totalItems: 10,
  completedItems: 4,
  remainingItems: 6,
  completionRate: 0.4,
};

const SCANNED: ScannedItem = { id: 'item-oats', name: 'Oats', upc: '0001' };

function cacheWithList() {
  const cache = makeCache();
  cache.writeFragment({
    fragment: COUNTS,
    data: { __typename: 'ShoppingList', id: LIST_ID, ...STATED },
  });
  return cache;
}

const readCounts = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<typeof STATED>({
    id: cache.identify({ __typename: 'ShoppingList', id: LIST_ID }),
    fragment: COUNTS,
  });

const rowKeys = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract()).filter(key =>
    key.startsWith('ShoppingListItem:'),
  );

const addAnswer = (
  data: MockDataFor<typeof BarcodeAddItemToShoppingListDocument>,
): MockFor<typeof BarcodeAddItemToShoppingListDocument> => ({
  request: {
    query: BarcodeAddItemToShoppingListDocument,
    variables: () => true,
  },
  result: { data },
});

describe('adding a scanned item to a shopping list', () => {
  it('withdraws a refused line and keeps the totals the answer stated', async () => {
    const cache = cacheWithList();
    const { result } = renderHookWithApollo(
      () => useAddScannedItem({ pantryId: undefined, shoppingListId: LIST_ID }),
      {
        cache,
        operationMocks: [
          addAnswer({
            addItemsToShoppingList: {
              __typename: 'AddItemsToShoppingListPayload',
              shoppingList: {
                __typename: 'ShoppingList',
                id: LIST_ID,
                ...STATED,
              },
              results: [
                {
                  __typename: 'BatchAddShoppingListItemResult',
                  index: 0,
                  success: false,
                  item: null,
                  failure: {
                    __typename: 'BatchElementFailure',
                    code: ErrorCode.Forbidden,
                    reason: 'no',
                  },
                },
              ],
            },
          }),
        ],
      },
    );

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.addToShoppingList(SCANNED);
    });

    expect(outcome).toBe('reverted');
    expect(readCounts(cache)).toMatchObject(STATED);
    expect(rowKeys(cache)).toEqual([]);
  });
});
