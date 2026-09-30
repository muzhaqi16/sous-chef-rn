import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseUpdateShoppingList_ListFragmentDoc } from '../useUpdateShoppingList.generated';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useUpdateShoppingList } from '../useUpdateShoppingList';
import { useShoppingListBudget } from '../useShoppingListBudget';

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  name: 'Groceries',
  isDefault: false,
  status: 'ACTIVE',
  isCompleted: false,
  completedShopDate: null,
  budgetAmount: null,
  currency: 'USD',
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

  it('restores the snapshot and throws localized copy on a rejection', async () => {
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
                  code: ErrorCode.ValidationFailed,
                  message: 'Name too long',
                  field: 'name',
                },
              },
            },
          },
        ],
      },
    );

    let thrown: unknown;
    await act(async () => {
      await result.current
        .updateShoppingList('list-1', { name: 'x'.repeat(500) })
        .catch((error: unknown) => {
          thrown = error;
        });
    });
    // The caller's copy, never the server's English message.
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Failed to save');

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

  it('saves the budget on the same write as the rename, and writes it before the mutation settles', async () => {
    const cache = seedList();
    const update = recordMock(UpdateShoppingListDocument, {
      data: { updateShoppingList: null }, // queued signature
    });
    const { result } = renderHookWithApollo(
      () => useUpdateShoppingList('Failed to save'),
      { cache, operationMocks: [update.mock] },
    );

    await act(async () => {
      const promise = result.current.updateShoppingList('list-1', {
        name: 'Groceries',
        planning: { budgetAmount: 150, currency: 'USD' },
      });
      expect(
        cache.readFragment<{ budgetAmount: number | null }>({
          id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
          fragment: UseUpdateShoppingList_ListFragmentDoc,
          fragmentName: 'useUpdateShoppingList_list',
        })?.budgetAmount,
      ).toBe(150);
      await promise;
    });

    expect(update.fired).toEqual([
      {
        input: {
          id: 'list-1',
          name: 'Groceries',
          planning: { budgetAmount: 150, currency: 'USD' },
          version: 1,
        },
      },
    ]);
  });

  it("sends the server's bumped version on the next versioned write", async () => {
    const cache = seedCache([{ ...LIST, priceTracking: false }]);
    const update = recordMock(UpdateShoppingListDocument, {
      dataFor: (vars): MockDataFor<typeof UpdateShoppingListDocument> => ({
        updateShoppingList: {
          __typename: 'UpdateShoppingListPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            version: (vars.input as { version: number }).version + 1,
          },
        },
      }),
    });
    const { result } = renderHookWithApollo(
      () => ({
        ...useUpdateShoppingList('Failed to save'),
        ...useShoppingListBudget(),
      }),
      { cache, operationMocks: [update.mock] },
    );

    await act(async () => {
      await result.current.updateShoppingList('list-1', { name: 'Weekly Run' });
      await result.current.setPriceTracking('list-1', true);
    });

    expect(
      update.fired.map(vars => (vars.input as { version: number }).version),
    ).toEqual([1, 2]);
  });
});
