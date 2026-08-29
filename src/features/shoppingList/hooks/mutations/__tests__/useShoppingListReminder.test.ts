import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// The hook is online-only, so the offline gate is the first branch of both
// actions — mocked here rather than through the store so a test can flip it
// without dragging the banner-dwell timers in.
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));

import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useShoppingListReminder } from '../useShoppingListReminder';

const mockIsApiUnavailable = useIsApiUnavailable as jest.MockedFunction<
  typeof useIsApiUnavailable
>;

const REMINDER = gql`
  fragment testReminder on ShoppingList {
    id
    reminderEnabled
    reminderDate
  }
`;

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
      fragment: REMINDER,
    },
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockIsApiUnavailable.mockReturnValue(false);
});

describe('useShoppingListReminder', () => {
  it('setReminder sends the mutation and the response lands in the cache', async () => {
    const cache = seedCache([LIST]);
    const setMock = recordMock(UpdateShoppingListReminderDocument, {
      data: {
        updateShoppingListReminder: {
          __typename: 'UpdateShoppingListReminderPayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            reminderEnabled: true,
            reminderDate: '2026-02-01T09:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00Z',
            version: 2,
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useShoppingListReminder(), {
      cache,
      operationMocks: [setMock.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setReminder(
        'list-1',
        '2026-02-01T09:00:00.000Z',
      );
    });

    expect(resolved).toBe(true);
    expect(setMock.fired).toEqual([
      {
        input: {
          id: 'list-1',
          reminderDate: '2026-02-01T09:00:00.000Z',
          reminderEnabled: true,
        },
      },
    ]);
    expect(readReminder(cache)?.reminderEnabled).toBe(true);
    expect(readReminder(cache)?.reminderDate).toBe('2026-02-01T09:00:00.000Z');
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
      resolved = await result.current.clearReminder('list-1');
    });

    expect(resolved).toBe(true);
    expect(readReminder(cache)?.reminderEnabled).toBe(false);
    expect(readReminder(cache)?.reminderDate).toBeNull();
  });

  it('setReminder returns false on a rejection and leaves the cache untouched', async () => {
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
                code: 'VALIDATION_ERROR',
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
    expect(readReminder(cache)?.reminderEnabled).toBe(false);
    expect(readReminder(cache)?.reminderDate).toBeNull();
  });

  it('offline: both actions toast and return false without firing a mutation', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const cache = seedCache([LIST]);
    const setMock = recordMock(UpdateShoppingListReminderDocument, {
      data: { updateShoppingListReminder: null },
    });
    const clearMock = recordMock(DeleteShoppingListReminderDocument, {
      data: { deleteShoppingListReminder: null },
    });
    const { result } = renderHookWithApollo(() => useShoppingListReminder(), {
      cache,
      operationMocks: [setMock.mock, clearMock.mock],
    });

    expect(result.current.isApiUnavailable).toBe(true);

    let setResolved: boolean | undefined;
    let clearResolved: boolean | undefined;
    await act(async () => {
      setResolved = await result.current.setReminder(
        'list-1',
        '2026-02-01T09:00:00.000Z',
      );
      clearResolved = await result.current.clearReminder('list-1');
    });

    expect(setResolved).toBe(false);
    expect(clearResolved).toBe(false);
    expect(setMock.fired).toEqual([]);
    expect(clearMock.fired).toEqual([]);
    expect(toastService.error).toHaveBeenCalledTimes(2);
    expect(readReminder(cache)?.reminderEnabled).toBe(false);
  });
});
