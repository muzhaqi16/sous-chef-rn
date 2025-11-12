import { renderHook, act } from '@testing-library/react-native';
import { usePantryPagination } from '../../../src/hooks/pantry/usePantryPagination';

// Mock the generic pagination utility
jest.mock('../../../src/hooks/utils/usePagination', () => ({
  usePagination: jest.fn(),
}));

import { usePagination } from '../../../src/hooks/utils/usePagination';

const mockUsePagination = usePagination as jest.Mock;

describe('usePantryPagination', () => {
  const mockPantryId = 'pantry-123';
  const mockFetchMore = jest.fn();
  const mockLoadMore = jest.fn();

  const defaultProps = {
    pantryId: mockPantryId,
    pageInfo: {
      hasNextPage: true,
      endCursor: 'cursor-123',
    },
    loading: false,
    itemCount: 10,
    fetchMore: mockFetchMore,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock return value
    mockUsePagination.mockReturnValue({
      hasMore: true,
      endCursor: 'cursor-123',
      loadMore: mockLoadMore,
      isLoadingMore: false,
    });
  });

  describe('basic functionality', () => {
    it('calls usePagination with correct configuration', () => {
      renderHook(() => usePantryPagination(defaultProps));

      expect(mockUsePagination).toHaveBeenCalledWith({
        pageInfo: defaultProps.pageInfo,
        loading: defaultProps.loading,
        itemCount: defaultProps.itemCount,
        fetchMore: defaultProps.fetchMore,
        fetchMoreVariables: { id: mockPantryId },
        cursorVariableName: 'itemsCursor',
      });
    });

    it('returns pagination results from usePagination', () => {
      const { result } = renderHook(() => usePantryPagination(defaultProps));

      expect(result.current).toEqual({
        hasMore: true,
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });
    });

    it('passes pantryId in fetchMoreVariables', () => {
      renderHook(() => usePantryPagination(defaultProps));

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchMoreVariables: { id: mockPantryId },
        }),
      );
    });

    it('uses pantry-specific cursor variable name', () => {
      renderHook(() => usePantryPagination(defaultProps));

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          cursorVariableName: 'itemsCursor',
        }),
      );
    });
  });

  describe('pagination states', () => {
    it('indicates no more items when hasMore is false', () => {
      mockUsePagination.mockReturnValue({
        hasMore: false,
        endCursor: null,
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });

      const { result } = renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      );

      expect(result.current.hasMore).toBe(false);
    });

    it('indicates loading more when isLoadingMore is true', () => {
      mockUsePagination.mockReturnValue({
        hasMore: true,
        endCursor: 'cursor-123',
        loadMore: mockLoadMore,
        isLoadingMore: true,
      });

      const { result } = renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          loading: true,
          itemCount: 10, // Has items, so isLoadingMore = true
        }),
      );

      expect(result.current.isLoadingMore).toBe(true);
    });

    it('does not indicate loading more during initial load', () => {
      mockUsePagination.mockReturnValue({
        hasMore: true,
        endCursor: 'cursor-123',
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });

      const { result } = renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          loading: true,
          itemCount: 0, // No items yet, so isLoadingMore = false
        }),
      );

      expect(result.current.isLoadingMore).toBe(false);
    });
  });

  describe('loadMore functionality', () => {
    it('exposes loadMore function', () => {
      const { result } = renderHook(() => usePantryPagination(defaultProps));

      expect(typeof result.current.loadMore).toBe('function');
      expect(result.current.loadMore).toBe(mockLoadMore);
    });

    it('loadMore is callable', async () => {
      const { result } = renderHook(() => usePantryPagination(defaultProps));

      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockLoadMore).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles undefined pantryId', () => {
      renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          pantryId: undefined,
        }),
      );

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchMoreVariables: { id: undefined },
        }),
      );
    });

    it('handles undefined pageInfo', () => {
      renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          pageInfo: undefined as any,
        }),
      );

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          pageInfo: undefined,
        }),
      );
    });

    it('handles null endCursor in pageInfo', () => {
      renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          pageInfo: { hasNextPage: true, endCursor: null },
        }),
      );

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          pageInfo: { hasNextPage: true, endCursor: null },
        }),
      );
    });

    it('handles zero itemCount', () => {
      renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          itemCount: 0,
        }),
      );

      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          itemCount: 0,
        }),
      );
    });
  });

  describe('prop changes', () => {
    it('updates when pantryId changes', () => {
      const { rerender } = renderHook(
        ({ pantryId }) => usePantryPagination({ ...defaultProps, pantryId }),
        { initialProps: { pantryId: 'pantry-1' } },
      );

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fetchMoreVariables: { id: 'pantry-1' },
        }),
      );

      rerender({ pantryId: 'pantry-2' });

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          fetchMoreVariables: { id: 'pantry-2' },
        }),
      );
    });

    it('updates when pageInfo changes', () => {
      const pageInfo1 = { hasNextPage: true, endCursor: 'cursor-1' };
      const pageInfo2 = { hasNextPage: true, endCursor: 'cursor-2' };

      const { rerender } = renderHook(
        ({ pageInfo }) => usePantryPagination({ ...defaultProps, pageInfo }),
        { initialProps: { pageInfo: pageInfo1 } },
      );

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageInfo: pageInfo1,
        }),
      );

      rerender({ pageInfo: pageInfo2 });

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pageInfo: pageInfo2,
        }),
      );
    });

    it('updates when loading changes', () => {
      const { rerender } = renderHook(
        ({ loading }) => usePantryPagination({ ...defaultProps, loading }),
        { initialProps: { loading: false } },
      );

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
        }),
      );

      rerender({ loading: true });

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: true,
        }),
      );
    });

    it('updates when itemCount changes', () => {
      const { rerender } = renderHook(
        ({ itemCount }) => usePantryPagination({ ...defaultProps, itemCount }),
        { initialProps: { itemCount: 10 } },
      );

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          itemCount: 10,
        }),
      );

      rerender({ itemCount: 20 });

      expect(mockUsePagination).toHaveBeenLastCalledWith(
        expect.objectContaining({
          itemCount: 20,
        }),
      );
    });
  });

  describe('integration with usePagination', () => {
    it('correctly wraps generic pagination for pantry-specific use', () => {
      renderHook(() => usePantryPagination(defaultProps));

      // Verify all required pagination config is passed
      const callArgs = mockUsePagination.mock.calls[0][0];

      expect(callArgs).toMatchObject({
        pageInfo: defaultProps.pageInfo,
        loading: defaultProps.loading,
        itemCount: defaultProps.itemCount,
        fetchMore: defaultProps.fetchMore,
        fetchMoreVariables: { id: mockPantryId },
        cursorVariableName: 'itemsCursor',
      });
    });

    it('returns only the necessary pagination interface', () => {
      const { result } = renderHook(() => usePantryPagination(defaultProps));

      // Should only expose hasMore, loadMore, isLoadingMore
      expect(Object.keys(result.current)).toEqual([
        'hasMore',
        'loadMore',
        'isLoadingMore',
      ]);
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical pagination flow: has more → load → loading → loaded', async () => {
      // Initial state: has more items
      mockUsePagination.mockReturnValue({
        hasMore: true,
        endCursor: 'cursor-1',
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });

      const { result, rerender } = renderHook(() =>
        usePantryPagination(defaultProps),
      );

      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);

      // User scrolls to bottom, loadMore is called
      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockLoadMore).toHaveBeenCalled();

      // Simulate loading state
      mockUsePagination.mockReturnValue({
        hasMore: true,
        endCursor: 'cursor-1',
        loadMore: mockLoadMore,
        isLoadingMore: true,
      });

      rerender();

      expect(result.current.isLoadingMore).toBe(true);

      // Simulate loaded state with new cursor
      mockUsePagination.mockReturnValue({
        hasMore: true,
        endCursor: 'cursor-2',
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });

      rerender();

      expect(result.current.hasMore).toBe(true);
      expect(result.current.isLoadingMore).toBe(false);
    });

    it('handles reaching end of list', () => {
      // Last page loaded, no more items
      mockUsePagination.mockReturnValue({
        hasMore: false,
        endCursor: null,
        loadMore: mockLoadMore,
        isLoadingMore: false,
      });

      const { result } = renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          pageInfo: { hasNextPage: false, endCursor: null },
        }),
      );

      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoadingMore).toBe(false);
    });

    it('handles large pantry with many pages', () => {
      const { result } = renderHook(() =>
        usePantryPagination({
          ...defaultProps,
          itemCount: 500,
          pageInfo: { hasNextPage: true, endCursor: 'cursor-page-20' },
        }),
      );

      expect(result.current.hasMore).toBe(true);
      // Large item count with loading should show isLoadingMore
      expect(mockUsePagination).toHaveBeenCalledWith(
        expect.objectContaining({
          itemCount: 500,
        }),
      );
    });
  });
});
