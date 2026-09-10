import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  AddItemToShoppingListDocument,
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
  CreateShoppingListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { CopyableShoppingListFragmentDoc } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UseRecurringShoppingList_ListFragmentDoc } from '../useRecurringShoppingList.generated';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { useRecurringShoppingList } from '../useRecurringShoppingList';
import { useStore } from '#store';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
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

  describe('generateNext rolls the occurrence on the device', () => {
    const USER = {
      id: 'user-1',
      email: 'tani@example.com',
      emailVerified: true,
      onBoarded: true,
    };

    const RECURRING = {
      ...LIST,
      isRecurring: true,
      recurringPattern: RecurringPattern.Weekly,
      recurringInterval: 1,
      nextRecurringDate: '2026-03-10T09:00:00.000Z',
    };

    const COPYABLE = {
      __typename: 'ShoppingList',
      id: 'list-1',
      name: 'Weekly Shop',
      description: null,
      budgetAmount: null,
      tags: [],
      homeId: 'home-1',
      unpurchasedLines: {
        __typename: 'ShoppingListItemConnection',
        edges: [
          {
            __typename: 'ShoppingListItemEdge',
            node: {
              __typename: 'ShoppingListItem',
              id: 'src-1',
              itemName: 'Tomatoes',
              quantity: 2,
              quantityInput: '2',
              category: 'Produce',
              notes: null,
              unitName: 'pc',
              sortOrder: 'a0',
              item: { __typename: 'Item', id: 'item-1' },
              unit: { __typename: 'Unit', id: 'unit-1' },
            },
          },
        ],
      },
      purchasedLines: {
        __typename: 'ShoppingListItemConnection',
        edges: [
          {
            __typename: 'ShoppingListItemEdge',
            node: {
              __typename: 'ShoppingListItem',
              id: 'src-2',
              itemName: 'Milk',
              quantity: 1,
              quantityInput: '1',
              category: 'Dairy',
              notes: null,
              unitName: 'l',
              sortOrder: 'a1',
              item: { __typename: 'Item', id: 'item-2' },
              unit: { __typename: 'Unit', id: 'unit-2' },
            },
          },
        ],
      },
    };

    const seedRecurring = (list: Record<string, unknown> = RECURRING) =>
      seedCache([
        list as never,
        {
          data: COPYABLE,
          fragment: CopyableShoppingListFragmentDoc,
          fragmentName: 'CopyableShoppingListFragment',
        },
      ]);

    /** Queued: the offline queue answers every write with a null payload. */
    const queuedCreate = () =>
      recordMock(CreateShoppingListDocument, {
        data: { createShoppingList: null },
      });
    const queuedAdd = () =>
      recordMock(AddItemToShoppingListDocument, {
        data: { addItemsToShoppingList: null },
      });
    const queuedSchedule = () =>
      recordMock(CreateRecurringShoppingListDocument, {
        data: { createRecurringShoppingList: null },
      });

    beforeEach(() => {
      useStore.setState({ user: USER, apiReachable: false, isOnline: false });
    });

    afterEach(() => {
      useStore.setState({ user: null, apiReachable: true, isOnline: true });
      jest.clearAllMocks();
    });

    it('copies the list and advances the schedule, with the API unreachable', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const schedule = queuedSchedule();
      const cache = seedRecurring();
      const { result } = renderHookWithApollo(
        () => useRecurringShoppingList(),
        { cache, operationMocks: [create.mock, add.mock, schedule.mock] },
      );

      let newId: string | null = null;
      await act(async () => {
        newId = await result.current.generateNext('list-1');
      });

      expect(newId).toBeTruthy();
      expect(create.fired).toHaveLength(1);
      expect(create.fired[0]).toMatchObject({
        input: { id: newId, homeId: 'home-1' },
      });

      const added = add.fired[0] as {
        input?: { items?: Array<{ item: { itemId?: string } }> };
      };
      expect(added.input?.items?.map(i => i.item.itemId)).toEqual([
        'item-1',
        'item-2',
      ]);

      // One week on from the roll, sent through the same mutation that sets a
      // schedule in the first place.
      const advanced = schedule.fired[0] as {
        input?: {
          id?: string;
          recurringPattern?: string;
          recurringInterval?: number;
          nextRecurringDate?: string;
        };
      };
      expect(advanced.input?.id).toBe('list-1');
      expect(advanced.input?.recurringPattern).toBe('WEEKLY');
      expect(advanced.input?.recurringInterval).toBe(1);
      const moved = new Date(advanced.input?.nextRecurringDate ?? 0).getTime();
      expect(moved - Date.now()).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);

      // The pointer moved in the cache too, before any server answer.
      expect(readRecurring(cache)?.recurringPattern).toBe('WEEKLY');
      const copied = cache.extract()[`ShoppingList:${newId!}`];
      expect(copied).toBeDefined();
    });

    it('refuses a list that does not repeat, without writing anything', async () => {
      const create = queuedCreate();
      const schedule = queuedSchedule();
      const { result } = renderHookWithApollo(
        () => useRecurringShoppingList(),
        {
          cache: seedRecurring({ ...RECURRING, isRecurring: false }),
          operationMocks: [create.mock, schedule.mock],
        },
      );

      let newId: string | null = 'unset';
      await act(async () => {
        newId = await result.current.generateNext('list-1');
      });

      expect(newId).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(schedule.fired).toHaveLength(0);
    });

    it('refuses when the list is not cached whole, without writing anything', async () => {
      const create = queuedCreate();
      const schedule = queuedSchedule();
      const { result } = renderHookWithApollo(
        () => useRecurringShoppingList(),
        {
          cache: seedCache([{ ...RECURRING }]),
          operationMocks: [create.mock, schedule.mock],
        },
      );

      let newId: string | null = 'unset';
      await act(async () => {
        newId = await result.current.generateNext('list-1');
      });

      expect(newId).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(schedule.fired).toHaveLength(0);
    });

    it('keeps the pointer when the list repeats without a pattern to advance by', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const schedule = queuedSchedule();
      const { result } = renderHookWithApollo(
        () => useRecurringShoppingList(),
        {
          cache: seedRecurring({
            ...RECURRING,
            recurringPattern: null,
            recurringInterval: null,
          }),
          operationMocks: [create.mock, add.mock, schedule.mock],
        },
      );

      await act(async () => {
        await result.current.generateNext('list-1');
      });

      expect(create.fired).toHaveLength(1);
      expect(schedule.fired).toHaveLength(0);
    });
  });
});
