import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseUpdateShoppingList_ListFragmentDoc } from '../useUpdateShoppingList.generated';
import { useUpdateShoppingList } from '../useUpdateShoppingList';

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  name: 'Groceries',
  isDefault: false,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const seedList = () => seedCache([LIST]);

const readName = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ name: string }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseUpdateShoppingList_ListFragmentDoc,
    fragmentName: 'useUpdateShoppingList_list',
  })?.name;

describe('useUpdateShoppingList', () => {
  it('writes the rename PERMANENTLY before the mutation settles; a queued (null) result keeps it and resolves null', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingList('Failed to save'),
      {
        cache,
        operationMocks: [
          {
            request: {
              query: UpdateShoppingListDocument,
              variables: () => true,
            },
            // Offline-queued signature: top-level field null, no error.
            result: { data: { updateShoppingList: null } },
          },
        ],
      },
    );

    let resolved: unknown = 'unset';
    await act(async () => {
      const promise = result.current.updateShoppingList('list-1', {
        name: 'Weekly Run',
      });
      // Synchronous permanent write — visible before the mutation settles.
      expect(readName(cache)).toBe('Weekly Run');
      resolved = await promise;
    });

    expect(resolved).toBeNull();
    expect(readName(cache)).toBe('Weekly Run');
  });

  it('restores the snapshot and throws the domain error on a rejection', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingList('Failed to save'),
      {
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
                  code: 'VALIDATION_ERROR',
                  message: 'Name too long',
                  field: 'name',
                },
              },
            },
          },
        ],
      },
    );

    await act(async () => {
      await expect(
        result.current.updateShoppingList('list-1', { name: 'x'.repeat(500) }),
      ).rejects.toThrow('Name too long');
    });

    await waitFor(() => {
      expect(readName(cache)).toBe('Groceries');
    });
  });

  it('returns the server entity on online success', async () => {
    const cache = seedList();
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingList('Failed to save'),
      {
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
                  __typename: 'UpdateShoppingListPayload',
                  shoppingList: {
                    __typename: 'ShoppingList',
                    id: 'list-1',
                    name: 'Weekly Run',
                    isDefault: true,
                    totalItems: 0,
                    completedItems: 0,
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-02T00:00:00Z',
                    ownerships: [],
                  },
                },
              },
            },
          },
        ],
      },
    );

    let updated:
      | Awaited<ReturnType<typeof result.current.updateShoppingList>>
      | undefined;
    await act(async () => {
      updated = await result.current.updateShoppingList('list-1', {
        name: 'Weekly Run',
        isDefault: true,
      });
    });

    expect(updated).toMatchObject({ id: 'list-1', name: 'Weekly Run' });
  });
});
