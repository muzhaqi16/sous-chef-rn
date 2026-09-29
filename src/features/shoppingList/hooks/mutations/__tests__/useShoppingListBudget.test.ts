import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseShoppingListBudget_ListFragmentDoc } from '../useShoppingListBudget.generated';
import { useShoppingListBudget } from '../useShoppingListBudget';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  budgetAmount: null,
  currency: 'USD',
  priceTracking: false,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readBudget = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ priceTracking: boolean }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseShoppingListBudget_ListFragmentDoc,
    fragmentName: 'useShoppingListBudget_list',
  });

const okMock = () => ({
  request: { query: UpdateShoppingListDocument, variables: () => true },
  result: { data: { updateShoppingList: null } }, // queued signature
});

describe('useShoppingListBudget', () => {
  it('setPriceTracking flips the flag optimistically and returns true', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [okMock()],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setPriceTracking('list-1', true);
      expect(readBudget(cache)?.priceTracking).toBe(true);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
  });

  it('reverts price tracking and returns false on a rejection', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListBudget(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateShoppingListDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateShoppingList: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'price tracking refused',
                field: 'priceTracking',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setPriceTracking('list-1', true);
    });

    expect(resolved).toBe(false);
    await waitFor(() => {
      expect(readBudget(cache)?.priceTracking).toBe(false);
    });
  });
});
