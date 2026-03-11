import { renderHook } from '@testing-library/react-native';
import { useShoppingListDetails } from '../useShoppingListDetails';

// --- Mocks ---

let mockQueryResult: any = {
  data: null,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
  networkStatus: 7, // NetworkStatus.ready
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetShoppingListQuery: () => mockQueryResult,
}));

jest.mock('@apollo/client', () => ({
  NetworkStatus: {
    refetch: 4,
    ready: 7,
  },
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedQueryData: (data: any, fallback: any) => data ?? fallback,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult = {
    data: null,
    loading: false,
    error: undefined,
    refetch: jest.fn(),
    networkStatus: 7,
  };
});

describe('useShoppingListDetails', () => {
  it('returns loading state', () => {
    mockQueryResult = {
      ...mockQueryResult,
      loading: true,
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.loading).toBe(true);
  });

  it('returns shopping list data', () => {
    mockQueryResult = {
      ...mockQueryResult,
      data: {
        shoppingList: {
          id: 'list-1',
          name: 'Groceries',
          isDefault: true,
          collaboratorsConnection: {
            edges: [
              { node: { id: 'collab-1', email: 'alice@test.com' } },
            ],
          },
        },
      },
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.shoppingList).not.toBeNull();
    expect(result.current.name).toBe('Groceries');
    expect(result.current.isDefault).toBe(true);
    expect(result.current.collaborators).toHaveLength(1);
    expect(result.current.collaborators[0].email).toBe('alice@test.com');
    expect(result.current.isShared).toBe(true);
  });

  it('returns default values when no shopping list data', () => {
    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.shoppingList).toBeNull();
    expect(result.current.name).toBe('');
    expect(result.current.isDefault).toBe(false);
    expect(result.current.collaborators).toEqual([]);
    expect(result.current.isShared).toBe(false);
  });

  it('returns error state', () => {
    const testError = new Error('Query failed');
    mockQueryResult = {
      ...mockQueryResult,
      error: testError,
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.error).toBe(testError);
  });

  it('exposes refetch function', () => {
    const mockRefetch = jest.fn();
    mockQueryResult = {
      ...mockQueryResult,
      refetch: mockRefetch,
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.refetch).toBe(mockRefetch);
  });

  it('detects refetching status from networkStatus', () => {
    mockQueryResult = {
      ...mockQueryResult,
      networkStatus: 4, // NetworkStatus.refetch
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.isRefetching).toBe(true);
  });

  it('isRefetching is false for normal ready status', () => {
    mockQueryResult = {
      ...mockQueryResult,
      networkStatus: 7, // NetworkStatus.ready
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.isRefetching).toBe(false);
  });

  it('returns isShared false when no collaborators', () => {
    mockQueryResult = {
      ...mockQueryResult,
      data: {
        shoppingList: {
          id: 'list-1',
          name: 'My List',
          isDefault: false,
          collaboratorsConnection: {
            edges: [],
          },
        },
      },
    };

    const { result } = renderHook(() =>
      useShoppingListDetails('list-1'),
    );

    expect(result.current.isShared).toBe(false);
  });
});
