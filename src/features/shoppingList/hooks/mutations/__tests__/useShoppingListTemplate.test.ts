import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  MarkAsTemplateDocument,
  CreateFromTemplateDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { UseShoppingListTemplate_ListFragmentDoc } from '../useShoppingListTemplate.generated';
import { useShoppingListTemplate } from '../useShoppingListTemplate';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
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

  it('createFromTemplate returns the created list id on success', async () => {
    const cache = seedCache([{ ...LIST, isTemplate: true }]);
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [
        {
          request: {
            query: CreateFromTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              createFromTemplate: {
                __typename: 'CreateFromTemplatePayload',
                shoppingList: {
                  __typename: 'ShoppingList',
                  id: 'list-2',
                  name: 'Weekly Staples',
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
      newId = await result.current.createFromTemplate('list-1');
    });

    expect(newId).toBe('list-2');
  });
});
