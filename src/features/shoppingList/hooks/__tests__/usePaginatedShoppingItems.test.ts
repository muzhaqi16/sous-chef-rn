'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  GetShoppingListItemsFilteredDocument,
  type GetShoppingListItemsFilteredQueryVariables,
} from '#features/shoppingList/graphql/shoppingList.generated';
import type { PaginationConfig } from '#hooks/utils/usePagination';
import { usePaginatedShoppingItems } from '../usePaginatedShoppingItems';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#/constants/shoppingList', () => ({
  PAGINATION: { ITEMS_PAGE_SIZE: 25 },
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeRefetch: jest.fn((fn: () => unknown) => fn()),
  executeMutation: jest.fn((fn: () => unknown) => fn()),
}));

jest.mock('#hooks/utils/usePagination', () => ({
  usePagination: jest.fn((config: PaginationConfig) => ({
    hasMore: config.pageInfo?.hasNextPage ?? false,
    endCursor: config.pageInfo?.endCursor ?? null,
    loadMore: jest.fn(),
    isLoadingMore: false,
    loadMoreError: false,
  })),
}));

globalThis.requestIdleCallback = jest.fn((cb: IdleRequestCallback) => {
  cb({ didTimeout: false, timeRemaining: () => 0 });
  return 1;
});
globalThis.cancelIdleCallback = jest.fn();

function buildConnectionData(
  edges: Array<{ id: string; itemName: string; sortOrder: string }>,
  pageInfo = { hasNextPage: false, endCursor: null as string | null },
  totalCount?: number,
  isPurchased = false,
) {
  return {
    shoppingList: {
      __typename: 'ShoppingList',
      id: 'list-1',
      itemsConnection: {
        __typename: 'ShoppingListItemConnection',
        edges: edges.map(node => ({
          __typename: 'ShoppingListItemEdge',
          cursor: `cursor-${node.id}`,
          node: {
            __typename: 'ShoppingListItem',
            ...node,
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased,
            },
          },
        })),
        pageInfo: { __typename: 'PageInfo', ...pageInfo },
        totalCount: totalCount ?? edges.length,
      },
    },
  };
}

function buildListMock(
  isPurchased: boolean,
  data: ReturnType<typeof buildConnectionData>,
): MockedResponse {
  return {
    request: {
      query: GetShoppingListItemsFilteredDocument,
      variables: vars =>
        (vars as GetShoppingListItemsFilteredQueryVariables).isPurchased ===
        isPurchased,
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: { data },
  };
}

function emptyMock(isPurchased: boolean): MockedResponse {
  return buildListMock(
    isPurchased,
    buildConnectionData([], undefined, undefined, isPurchased),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePaginatedShoppingItems', () => {
  it('returns empty items when no data', async () => {
    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      { operationMocks: [emptyMock(false), emptyMock(true)] },
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.unpurchased.items).toEqual([]);
    expect(result.current.state.purchased.items).toEqual([]);
  });

  it('returns no error and no items when listId is null', () => {
    const { result } = renderHookWithApollo(() =>
      usePaginatedShoppingItems({ listId: null }),
    );

    expect(result.current.state.unpurchased.items).toEqual([]);
    expect(result.current.state.purchased.items).toEqual([]);
  });

  it('returns no items when skip option is true', () => {
    const { result } = renderHookWithApollo(() =>
      usePaginatedShoppingItems({ listId: 'list-1', skip: true }),
    );

    expect(result.current.state.unpurchased.items).toEqual([]);
    expect(result.current.state.purchased.items).toEqual([]);
  });

  it('separates purchased and unpurchased data into independent buckets', async () => {
    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      {
        operationMocks: [
          buildListMock(
            false,
            buildConnectionData([
              { id: '2', itemName: 'Bread', sortOrder: 'b' },
              { id: '1', itemName: 'Milk', sortOrder: 'a' },
            ]),
          ),
          buildListMock(
            true,
            buildConnectionData(
              [
                { id: '10', itemName: 'Eggs', sortOrder: 'a' },
                { id: '11', itemName: 'Butter', sortOrder: 'b' },
              ],
              undefined,
              undefined,
              true,
            ),
          ),
        ],
      },
    );

    await waitFor(() =>
      expect(result.current.state.unpurchased.items).toHaveLength(2),
    );
    await waitFor(() =>
      expect(result.current.state.purchased.items).toHaveLength(2),
    );
    expect(result.current.state.unpurchased.items[0].id).toBe('2');
    expect(result.current.state.unpurchased.items[1].id).toBe('1');
  });

  it('exposes hasMore and totalCount for unpurchased', async () => {
    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      {
        operationMocks: [
          buildListMock(
            false,
            buildConnectionData(
              [{ id: '1', itemName: 'Milk', sortOrder: 'a' }],
              { hasNextPage: true, endCursor: 'cursor-1' },
              50,
            ),
          ),
          emptyMock(true),
        ],
      },
    );

    await waitFor(() =>
      expect(result.current.state.unpurchased.totalCount).toBe(50),
    );
    expect(result.current.state.unpurchased.hasMore).toBe(true);
  });

  it('delegates loadMore to usePagination', async () => {
    const mockLoadMore = jest.fn();
    const { usePagination } = require('#hooks/utils/usePagination');
    usePagination.mockImplementation((config: PaginationConfig) => ({
      hasMore: config.pageInfo?.hasNextPage ?? false,
      endCursor: config.pageInfo?.endCursor ?? null,
      loadMore: mockLoadMore,
      isLoadingMore: false,
      loadMoreError: false,
    }));

    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      {
        operationMocks: [
          buildListMock(
            false,
            buildConnectionData(
              [{ id: '1', itemName: 'Milk', sortOrder: 'a' }],
              { hasNextPage: true, endCursor: 'cursor-1' },
              50,
            ),
          ),
          emptyMock(true),
        ],
      },
    );

    await waitFor(() =>
      expect(result.current.state.unpurchased.items).toHaveLength(1),
    );
    result.current.state.unpurchased.loadMore();
    expect(mockLoadMore).toHaveBeenCalled();
  });

  it('refetch returns a function', async () => {
    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      { operationMocks: [emptyMock(false), emptyMock(true)] },
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    await act(async () => {
      await result.current.actions.refetch();
    });

    expect(typeof result.current.actions.refetch).toBe('function');
  });

  it('returns isTransitioning false when listId is stable', () => {
    const { result } = renderHookWithApollo(
      ({ listId }: { listId: string }) => usePaginatedShoppingItems({ listId }),
      {
        operationMocks: [emptyMock(false), emptyMock(true)],
        initialProps: { listId: 'list-1' },
      },
    );

    expect(result.current.state.isTransitioning).toBe(false);
  });

  it('combines errors from both queries', async () => {
    const { result } = renderHookWithApollo(
      () => usePaginatedShoppingItems({ listId: 'list-1' }),
      {
        operationMocks: [
          {
            request: {
              query: GetShoppingListItemsFilteredDocument,
              variables: vars =>
                (vars as GetShoppingListItemsFilteredQueryVariables)
                  .isPurchased === false,
            },
            maxUsageCount: Number.POSITIVE_INFINITY,
            error: new Error('Network error'),
          },
          emptyMock(true),
        ],
      },
    );

    await waitFor(() =>
      expect(result.current.state.error?.message).toContain('Network error'),
    );
  });
});
