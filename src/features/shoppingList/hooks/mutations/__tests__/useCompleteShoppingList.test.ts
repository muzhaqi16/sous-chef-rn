import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CompleteShoppingListDocument,
  MarkShoppingListActiveDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UseCompleteShoppingList_ListFragmentDoc } from '../useCompleteShoppingList.generated';
import { useCompleteShoppingList } from '../useCompleteShoppingList';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  status: 'ACTIVE',
  isCompleted: false,
  completedShopDate: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readState = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{
    status: string;
    isCompleted: boolean;
    completedShopDate: string | null;
  }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseCompleteShoppingList_ListFragmentDoc,
    fragmentName: 'useCompleteShoppingList_list',
  });

describe('useCompleteShoppingList', () => {
  it('writes COMPLETED optimistically before settle; a queued (null) result keeps it and returns true', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useCompleteShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: CompleteShoppingListDocument,
            variables: () => true,
          },
          // Offline-queued signature: top-level field null, no error.
          result: { data: { completeShoppingList: null } },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.completeList('list-1');
      // Synchronous permanent write — visible before the mutation settles.
      expect(readState(cache)?.status).toBe('COMPLETED');
      expect(readState(cache)?.isCompleted).toBe(true);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readState(cache)?.status).toBe('COMPLETED');
  });

  it('reverts to ACTIVE and returns false on a rejected (union-error) result', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useCompleteShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: CompleteShoppingListDocument,
            variables: () => true,
          },
          result: {
            data: {
              completeShoppingList: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'nope',
                field: 'id',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.completeList('list-1');
    });

    expect(resolved).toBe(false);
    await waitFor(() => {
      expect(readState(cache)?.status).toBe('ACTIVE');
      expect(readState(cache)?.isCompleted).toBe(false);
    });
  });

  it('reactivate writes ACTIVE optimistically and returns true on success', async () => {
    const cache = seedCache([
      {
        ...LIST,
        status: 'COMPLETED',
        isCompleted: true,
        completedShopDate: '2026-01-05T00:00:00Z',
      },
    ]);
    const { result } = renderHookWithApollo(() => useCompleteShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: MarkShoppingListActiveDocument,
            variables: () => true,
          },
          result: {
            data: {
              markShoppingListActive: {
                __typename: 'MarkShoppingListActivePayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-1',
                  status: 'ACTIVE',
                  isCompleted: false,
                  completedShopDate: null,
                  updatedAt: '2026-01-06T00:00:00Z',
                  version: 2,
                },
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.reactivateList('list-1');
      expect(readState(cache)?.status).toBe('ACTIVE');
      expect(readState(cache)?.isCompleted).toBe(false);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readState(cache)?.completedShopDate).toBeNull();
  });
});
