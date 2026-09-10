import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  AddItemToShoppingListDocument,
  CreateShoppingListDocument,
  MarkAsTemplateDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { CopyableShoppingListFragmentDoc } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UseShoppingListTemplate_ListFragmentDoc } from '../useShoppingListTemplate.generated';
import { useShoppingListTemplate } from '../useShoppingListTemplate';
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
  isTemplate: false,
  templateName: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readTemplate = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ isTemplate: boolean; templateName: string | null }>({
    id: cache.identify({ __typename: 'ShoppingList', id: 'list-1' }),
    fragment: UseShoppingListTemplate_ListFragmentDoc,
    fragmentName: 'useShoppingListTemplate_list',
  });

describe('useShoppingListTemplate', () => {
  it('markAsTemplate writes the flags optimistically; a queued (null) result keeps them and returns true', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [
        {
          request: { query: MarkAsTemplateDocument, variables: () => true },
          result: { data: { markAsTemplate: null } },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      const promise = result.current.markAsTemplate('list-1', 'Weekly Staples');
      expect(readTemplate(cache)?.isTemplate).toBe(true);
      expect(readTemplate(cache)?.templateName).toBe('Weekly Staples');
      resolved = await promise;
    });

    expect(resolved).toBe(true);
    expect(readTemplate(cache)?.isTemplate).toBe(true);
  });

  it('markAsTemplate reverts and returns false on a rejection', async () => {
    const cache = seedCache([LIST]);
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [
        {
          request: { query: MarkAsTemplateDocument, variables: () => true },
          result: {
            data: {
              markAsTemplate: {
                __typename: 'ValidationError',
                code: 'VALIDATION_FAILED',
                message: 'bad',
                field: 'templateName',
              },
            },
          },
        },
      ],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.markAsTemplate('list-1', '');
    });

    expect(resolved).toBe(false);
    await waitFor(() => {
      expect(readTemplate(cache)?.isTemplate).toBe(false);
    });
  });

  describe('createFromTemplate copies the template on the device', () => {
    const USER = {
      id: 'user-1',
      email: 'tani@example.com',
      emailVerified: true,
      onBoarded: true,
    };

    const TEMPLATE = {
      __typename: 'ShoppingList',
      id: 'template-1',
      name: 'Weekly Staples',
      description: 'Every week',
      budgetAmount: 40,
      tags: ['staples'],
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

    const seedTemplate = () =>
      seedCache([
        {
          data: TEMPLATE,
          fragment: CopyableShoppingListFragmentDoc,
          fragmentName: 'CopyableShoppingListFragment',
        },
      ]);

    /** Queued: the offline queue answers a create with a null payload. */
    const queuedCreate = () =>
      recordMock(CreateShoppingListDocument, {
        data: { createShoppingList: null },
      });

    const queuedAdd = () =>
      recordMock(AddItemToShoppingListDocument, {
        data: { addItemsToShoppingList: null },
      });

    beforeEach(() => {
      useStore.setState({ user: USER, apiReachable: false, isOnline: false });
    });

    afterEach(() => {
      useStore.setState({ user: null, apiReachable: true, isOnline: true });
      jest.clearAllMocks();
    });

    it('creates the list and adds every line under client-minted ids, with the API unreachable', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const cache = seedTemplate();
      const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
        cache,
        operationMocks: [create.mock, add.mock],
      });

      let newId: string | null = null;
      await act(async () => {
        newId = await result.current.createFromTemplate(
          'template-1',
          'Groceries',
        );
      });

      expect(newId).toBeTruthy();
      expect(create.fired).toHaveLength(1);
      expect(create.fired[0]).toMatchObject({
        input: {
          id: newId,
          name: 'Groceries',
          description: 'Every week',
          budgetAmount: 40,
          homeId: 'home-1',
        },
      });

      // Both purchase states are copied, and the fresh rows carry the ids the
      // device minted — that is what makes the replay converge.
      const fired = add.fired[0] as {
        input?: {
          shoppingListId?: string;
          items?: Array<{ id?: string; item: { itemId?: string } }>;
        };
      };
      expect(fired.input?.shoppingListId).toBe(newId);
      expect(fired.input?.items?.map(i => i.item.itemId)).toEqual([
        'item-1',
        'item-2',
      ]);

      // The copy is in the cache, under the minted id, before any server answer.
      const copied = cache.readFragment<{ name: string }>({
        id: cache.identify({ __typename: 'ShoppingList', id: newId! }),
        fragment: UseShoppingListTemplate_ListFragmentDoc,
        fragmentName: 'useShoppingListTemplate_list',
      });
      expect(copied).not.toBeNull();
      const lineIds = fired.input?.items?.map(i => i.id) ?? [];
      expect(lineIds).toHaveLength(2);
      for (const lineId of lineIds) {
        expect(cache.extract()[`ShoppingListItem:${lineId}`]).toBeDefined();
      }
    });

    it('overrides the template home with the one the caller picked', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
        cache: seedTemplate(),
        operationMocks: [create.mock, add.mock],
      });

      await act(async () => {
        await result.current.createFromTemplate('template-1', 'G', 'home-2');
      });

      expect(create.fired[0]).toMatchObject({ input: { homeId: 'home-2' } });
    });

    it('refuses when the template is not cached, without firing anything', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
        operationMocks: [create.mock, add.mock],
      });

      let newId: string | null = 'unset';
      await act(async () => {
        newId = await result.current.createFromTemplate('template-1');
      });

      expect(newId).toBeNull();
      expect(create.fired).toHaveLength(0);
      expect(add.fired).toHaveLength(0);
    });

    it('names the copy after the template when the caller gives no name', async () => {
      const create = queuedCreate();
      const add = queuedAdd();
      const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
        cache: seedTemplate(),
        operationMocks: [create.mock, add.mock],
      });

      await act(async () => {
        await result.current.createFromTemplate('template-1');
      });

      expect(create.fired[0]).toMatchObject({
        input: { name: 'Weekly Staples (Copy)' },
      });
    });
  });
});
