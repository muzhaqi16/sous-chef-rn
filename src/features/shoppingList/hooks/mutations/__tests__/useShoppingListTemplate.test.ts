import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  MarkAsTemplateDocument,
  CreateFromTemplateDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useShoppingListTemplate } from '../useShoppingListTemplate';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// Both operations are online-only, so the guard's input is the only network
// state these tests need.
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: jest.fn(() => false),
}));
const mockIsApiUnavailable = useIsApiUnavailable as jest.MockedFunction<
  typeof useIsApiUnavailable
>;

beforeEach(() => {
  mockIsApiUnavailable.mockReturnValue(false);
  mockToastError.mockClear();
});

const LIST = {
  __typename: 'ShoppingList',
  id: 'list-1',
  isTemplate: false,
  templateName: null,
  version: 1,
  updatedAt: '2026-01-01T00:00:00Z',
};

const readList = (cache: InMemoryCache) =>
  cache.extract()['ShoppingList:list-1'] as
    | { isTemplate: boolean; templateName: string | null }
    | undefined;

describe('useShoppingListTemplate', () => {
  it('markAsTemplate writes the flags the server returns and resolves true', async () => {
    const cache = seedCache([LIST]);
    const marked = recordMock(MarkAsTemplateDocument, {
      data: {
        markAsTemplate: {
          __typename: 'MarkAsTemplatePayload',
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            isTemplate: true,
            templateName: 'Weekly Staples',
            status: 'TEMPLATE',
            updatedAt: '2026-01-02T00:00:00Z',
            version: 2,
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [marked.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.markAsTemplate(
        'list-1',
        'Weekly Staples',
      );
    });

    expect(resolved).toBe(true);
    expect(marked.fired).toHaveLength(1);
    expect(readList(cache)?.isTemplate).toBe(true);
    expect(readList(cache)?.templateName).toBe('Weekly Staples');
  });

  it('markAsTemplate returns false on a rejection and leaves the cache alone', async () => {
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
                code: 'VALIDATION_ERROR',
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
    expect(readList(cache)?.isTemplate).toBe(false);
  });

  it('markAsTemplate refuses offline: no mutation, a localized toast, false', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const cache = seedCache([LIST]);
    const marked = recordMock(MarkAsTemplateDocument);
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [marked.mock],
    });

    let resolved: boolean | undefined;
    await act(async () => {
      resolved = await result.current.markAsTemplate(
        'list-1',
        'Weekly Staples',
      );
    });

    expect(resolved).toBe(false);
    expect(marked.fired).toHaveLength(0);
    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
    expect(readList(cache)?.isTemplate).toBe(false);
    expect(result.current.isApiUnavailable).toBe(true);
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

  it('createFromTemplate refuses offline: no mutation, a localized toast, null', async () => {
    mockIsApiUnavailable.mockReturnValue(true);
    const cache = seedCache([{ ...LIST, isTemplate: true }]);
    const created = recordMock(CreateFromTemplateDocument);
    const { result } = renderHookWithApollo(() => useShoppingListTemplate(), {
      cache,
      operationMocks: [created.mock],
    });

    let newId: string | null = 'unset';
    await act(async () => {
      newId = await result.current.createFromTemplate('list-1');
    });

    expect(newId).toBeNull();
    expect(created.fired).toHaveLength(0);
    expect(mockToastError).toHaveBeenCalledWith('Not available offline');
  });
});
