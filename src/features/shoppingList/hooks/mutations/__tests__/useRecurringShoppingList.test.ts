jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
  GenerateNextRecurringListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { useStore } from '#store';
import { useRecurringShoppingList } from '../useRecurringShoppingList';

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
  cache.extract()['ShoppingList:list-1'] as
    | {
        isRecurring: boolean;
        recurringPattern: string | null;
        recurringInterval: number | null;
      }
    | undefined;

const setupMock = () =>
  recordMock(CreateRecurringShoppingListDocument, {
    data: {
      createRecurringShoppingList: {
        __typename: 'CreateRecurringShoppingListPayload',
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'list-1',
          isRecurring: true,
          recurringPattern: 'WEEKLY',
          recurringInterval: 1,
          nextRecurringDate: '2026-01-08T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
          version: 2,
        },
      },
    },
  });

const cancelMock = () =>
  recordMock(CancelRecurringDocument, {
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
  });

const generateMock = () =>
  recordMock(GenerateNextRecurringListDocument, {
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
  });

describe('useRecurringShoppingList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    useStore.setState({ apiReachable: true, isOnline: true });
  });

  describe('when the API is unavailable', () => {
    it('exposes isApiUnavailable, toasts, and skips every mutation', async () => {
      useStore.setState({ apiReachable: false });
      const cache = seedCache([LIST]);
      const setup = setupMock();
      const cancel = cancelMock();
      const generate = generateMock();
      const { result } = renderHookWithApollo(
        () => useRecurringShoppingList(),
        {
          cache,
          operationMocks: [setup.mock, cancel.mock, generate.mock],
        },
      );

      expect(result.current.isApiUnavailable).toBe(true);

      let setResult: boolean | undefined;
      let cancelResult: boolean | undefined;
      let generatedId: string | null = null;
      await act(async () => {
        setResult = await result.current.setRecurring(
          'list-1',
          RecurringPattern.Weekly,
          1,
        );
        cancelResult = await result.current.cancelRecurring('list-1');
        generatedId = await result.current.generateNext('list-1');
      });

      expect(setResult).toBe(false);
      expect(cancelResult).toBe(false);
      expect(generatedId).toBeNull();
      expect(toastService.error).toHaveBeenCalledTimes(3);
      expect(toastService.error).toHaveBeenCalledWith('Not available offline');
      expect(setup.fired).toHaveLength(0);
      expect(cancel.fired).toHaveLength(0);
      expect(generate.fired).toHaveLength(0);
      // No optimistic write: the cache is untouched while offline.
      expect(readRecurring(cache)?.isRecurring).toBe(false);
    });
  });

  it('setRecurring fires the mutation and the server response lands in the cache', async () => {
    const cache = seedCache([LIST]);
    const setup = setupMock();
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [setup.mock],
    });

    expect(result.current.isApiUnavailable).toBe(false);

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.setRecurring(
        'list-1',
        RecurringPattern.Weekly,
        1,
      );
    });

    expect(resolved).toBe(true);
    expect(setup.fired).toHaveLength(1);
    expect(readRecurring(cache)?.isRecurring).toBe(true);
    expect(readRecurring(cache)?.recurringPattern).toBe('WEEKLY');
    expect(readRecurring(cache)?.recurringInterval).toBe(1);
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
    const cancel = cancelMock();
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [cancel.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.cancelRecurring('list-1');
    });

    expect(resolved).toBe(true);
    expect(cancel.fired).toHaveLength(1);
    expect(readRecurring(cache)?.isRecurring).toBe(false);
  });

  it('generateNext returns the created list id on success', async () => {
    const cache = seedCache([{ ...LIST, isRecurring: true }]);
    const { result } = renderHookWithApollo(() => useRecurringShoppingList(), {
      cache,
      operationMocks: [generateMock().mock],
    });

    let newId: string | null = null;
    await act(async () => {
      newId = await result.current.generateNext('list-1');
    });

    expect(newId).toBe('list-2');
  });
});
