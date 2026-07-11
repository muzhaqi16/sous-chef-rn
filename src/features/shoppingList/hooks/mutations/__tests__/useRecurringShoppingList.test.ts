import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
  GenerateNextRecurringListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UseRecurringShoppingList_ListFragmentDoc } from '../useRecurringShoppingList.generated';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { useRecurringShoppingList } from '../useRecurringShoppingList';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  isRecurring: false,
  recurringPattern: null,
  recurringInterval: null,
  nextRecurringDate: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readRecurring = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{
    isRecurring: boolean;
    recurringPattern: string | null;
    recurringInterval: number | null;
  }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseRecurringShoppingList_ListFragmentDoc,
    fragmentName: 'useRecurringShoppingList_list',
  });

describe('useRecurringShoppingList', () => {
  it('setRecurring writes the pattern optimistically; a queued (null) result keeps it and returns true', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: CreateRecurringShoppingListDocument,
            variables: () => true,
          },
          result: { data: { createRecurringShoppingList: null } },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setRecurring(
        'list-1',
        RecurringPattern.Weekly,
        1,
      );
      expect(readRecurring(cache)?.isRecurring).toBe(true);
      expect(readRecurring(cache)?.recurringPattern).toBe('WEEKLY');
      expect(readRecurring(cache)?.recurringInterval).toBe(1);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readRecurring(cache)?.isRecurring).toBe(true);
  });

  it('cancelRecurring flips isRecurring off and returns true on success', async () => {
    const cache = seedCache([
      {
        ...LIST,
        isRecurring: true,
        recurringPattern: 'WEEKLY',
        recurringInterval: 1,
      },
    ]);
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: CancelRecurringDocument,
            variables: () => true,
          },
          result: {
            data: {
              cancelRecurring: {
                __typename: 'CancelRecurringPayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-1',
                  isRecurring: false,
                  recurringPattern: 'WEEKLY',
                  recurringInterval: 1,
                  nextRecurringDate: null,
                  updatedAt: '2026-01-02T00:00:00Z',
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
      const promise = result.current.cancelRecurring('list-1');
      expect(readRecurring(cache)?.isRecurring).toBe(false);
      resolved = await promise;
    });

    expect(resolved).toBe(true);
  });

  it('generateNext returns the created list id on success', async () => {
    const cache = seedCache([{ ...LIST, isRecurring: true }]);
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [
        {
          request: {
            query: GenerateNextRecurringListDocument,
            variables: () => true,
          },
          result: {
            data: {
              generateNextRecurringList: {
                __typename: 'GenerateNextRecurringListPayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-2',
                  name: 'Groceries',
                  isDefault: false,
                  status: 'ACTIVE',
                  totalItems: 0,
                  completedItems: 0,
                  createdAt: '2026-01-08T00:00:00Z',
                  updatedAt: '2026-01-08T00:00:00Z',
                  homeId: null,
                  home: null,
                  ownerships: [],
                },
              },
            },
          },
        },
      ],
    });

    let newId: string | null = null;
    await act(async () => {
      newId = await result.current.generateNext('list-1');
    });

    expect(newId).toBe('list-2');
  });
});
