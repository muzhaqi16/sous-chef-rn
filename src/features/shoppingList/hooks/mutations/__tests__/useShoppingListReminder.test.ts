import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UseShoppingListReminder_ListFragmentDoc } from '../useShoppingListReminder.generated';
import { useShoppingListReminder } from '../useShoppingListReminder';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  reminderEnabled: false,
  reminderDate: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readReminder = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ reminderEnabled: boolean; reminderDate: string | null }>(
    {
      id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
      fragment: UseShoppingListReminder_ListFragmentDoc,
      fragmentName: 'useShoppingListReminder_list',
    },
  );

describe('useShoppingListReminder', () => {
  it('setReminder writes the date optimistically; a queued (null) result keeps it and returns true', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListReminder(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateShoppingListReminderDocument,
            variables: () => true,
          },
          result: { data: { updateShoppingListReminder: null } },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.setReminder(
        'list-1',
        '2026-02-01T09:00:00.000Z',
      );
      expect(readReminder(cache)?.reminderEnabled).toBe(true);
      expect(readReminder(cache)?.reminderDate).toBe(
        '2026-02-01T09:00:00.000Z',
      );
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readReminder(cache)?.reminderEnabled).toBe(true);
  });

  it('clearReminder flips the flag off and nulls the date, returning true on success', async () => {
    const cache = seedCache([
      {
        ...LIST,
        reminderEnabled: true,
        reminderDate: '2026-02-01T09:00:00.000Z',
      },
    ]);
    const { result } = renderHookWithApollo(() => useShoppingListReminder(), {
      cache,
      operationMocks: [
        {
          request: {
            query: DeleteShoppingListReminderDocument,
            variables: () => true,
          },
          result: {
            data: {
              deleteShoppingListReminder: {
                __typename: 'DeleteShoppingListReminderPayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-1',
                  reminderEnabled: false,
                  reminderDate: null,
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
      const promise = result.current.clearReminder('list-1');
      expect(readReminder(cache)?.reminderEnabled).toBe(false);
      expect(readReminder(cache)?.reminderDate).toBeNull();
      resolved = await promise;
    });

    expect(resolved).toBe(true);
  });

  it('setReminder reverts and returns false on a rejection', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListReminder(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateShoppingListReminderDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateShoppingListReminder: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'bad date',
                field: 'reminderDate',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setReminder(
        'list-1',
        '2026-02-01T09:00:00.000Z',
      );
    });

    expect(resolved).toBe(false);
    await waitFor(() => {
      expect(readReminder(cache)?.reminderEnabled).toBe(false);
      expect(readReminder(cache)?.reminderDate).toBeNull();
    });
  });
});
