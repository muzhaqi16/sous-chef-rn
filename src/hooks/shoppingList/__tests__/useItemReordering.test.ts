import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useItemReordering } from '../useItemReordering';

// Mock generatePosition
const mockGeneratePosition = jest.fn<string, [string | null, string | null]>(
  () => 'bbb',
);
jest.mock('#/utils/fractionalIndexing', () => ({
  generatePosition: (a: string | null, b: string | null) =>
    mockGeneratePosition(a, b),
}));

// Mock version conflict utils
jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Item was updated'),
}));

// Mock compilerSafeWrappers
jest.mock('#/utils/compilerSafeWrappers');

// Mock SubscriptionService
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  SubscriptionService: {
    getInstance: () => ({
      markItemReordered: jest.fn(),
    }),
  },
}));

// Mock Apollo
const mockMoveItem = jest.fn();
const mockCacheBatch = jest.fn();
const mockCacheModify = jest.fn();
const mockCacheIdentify = jest.fn((obj: any) => `ShoppingListItem:${obj.id}`);

jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({
    cache: {
      batch: mockCacheBatch,
      modify: mockCacheModify,
      identify: mockCacheIdentify,
    },
  }),
}));

jest.mock('#generated', () => ({
  useMoveShoppingListItemMutation: () => [mockMoveItem],
}));

// Suppress console.log/warn/error in tests
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation();
  jest.spyOn(console, 'warn').mockImplementation();
  jest.spyOn(console, 'error').mockImplementation();

  mockMoveItem.mockResolvedValue({
    data: {
      moveShoppingListItem: {
        shoppingListItem: {
          id: 'item-2',
          sortOrder: 'bbb',
          version: 2,
        },
      },
    },
  });

  // Execute the batch update callback immediately
  mockCacheBatch.mockImplementation(({ update }: any) => {
    update({
      modify: mockCacheModify,
      identify: mockCacheIdentify,
    });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const items = [
  { id: 'item-1', sortOrder: 'aaa', version: 1 },
  { id: 'item-2', sortOrder: 'ccc', version: 1 },
  { id: 'item-3', sortOrder: 'eee', version: 1 },
];

describe('useItemReordering', () => {
  it('returns handleSortOrderUpdate function', () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    expect(typeof result.current.handleSortOrderUpdate).toBe('function');
  });

  it('does nothing when listId is undefined', async () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: undefined, items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-1', 'item-3', 'aaa', 'eee',
      );
    });

    expect(mockMoveItem).not.toHaveBeenCalled();
  });

  it('does nothing when item not found in items array', async () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'non-existent', 'item-1', 'item-3', 'aaa', 'eee',
      );
    });

    expect(mockMoveItem).not.toHaveBeenCalled();
  });

  it('generates new sort order and calls mutation', async () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-1', 'item-3', 'aaa', 'eee',
      );
    });

    expect(mockGeneratePosition).toHaveBeenCalledWith('aaa', 'eee');
    expect(mockMoveItem).toHaveBeenCalledWith({
      variables: {
        input: {
          itemId: 'item-2',
          afterItemId: 'item-1',
          beforeItemId: 'item-3',
        },
      },
    });
  });

  it('updates cache before calling mutation (optimistic)', async () => {
    const callOrder: string[] = [];

    mockCacheBatch.mockImplementation(({ update }: any) => {
      callOrder.push('cache.batch');
      update({
        modify: mockCacheModify,
        identify: mockCacheIdentify,
      });
    });

    mockMoveItem.mockImplementation(() => {
      callOrder.push('mutation');
      return Promise.resolve({
        data: {
          moveShoppingListItem: {
            shoppingListItem: { id: 'item-2', sortOrder: 'bbb', version: 2 },
          },
        },
      });
    });

    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-1', 'item-3', 'aaa', 'eee',
      );
    });

    expect(callOrder).toEqual(['cache.batch', 'mutation']);
  });

  it('handles null afterItemId (moving to first position)', async () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', null, 'item-1', null, 'aaa',
      );
    });

    expect(mockGeneratePosition).toHaveBeenCalledWith(null, 'aaa');
    expect(mockMoveItem).toHaveBeenCalledWith({
      variables: {
        input: {
          itemId: 'item-2',
          afterItemId: undefined,
          beforeItemId: 'item-1',
        },
      },
    });
  });

  it('handles null beforeItemId (moving to last position)', async () => {
    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-3', null, 'eee', null,
      );
    });

    expect(mockGeneratePosition).toHaveBeenCalledWith('eee', null);
  });

  it('refetches when sortOrder ordering is invalid (after > before)', async () => {
    const refetch = jest.fn();
    const badItems = [
      { id: 'item-1', sortOrder: 'zzz', version: 1 },
      { id: 'item-2', sortOrder: 'ccc', version: 1 },
      { id: 'item-3', sortOrder: 'aaa', version: 1 },
    ];

    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items: badItems, refetch }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-1', 'item-3', 'zzz', 'aaa',
      );
    });

    expect(refetch).toHaveBeenCalled();
    expect(mockMoveItem).not.toHaveBeenCalled();
  });

  it('handles GraphQL errors from mutation', async () => {
    const refetch = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');

    mockMoveItem.mockResolvedValue({
      error: { message: 'Server error' },
    });

    const { result } = renderHook(() =>
      useItemReordering({ listId: 'list-1', items, refetch }),
    );

    await act(async () => {
      await result.current.handleSortOrderUpdate(
        'item-2', 'item-1', 'item-3', 'aaa', 'eee',
      );
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('Server error'),
    );
    expect(refetch).toHaveBeenCalled();
  });
});
