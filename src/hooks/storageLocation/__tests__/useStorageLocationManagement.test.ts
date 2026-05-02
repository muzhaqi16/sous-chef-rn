'use no memo';

// Polyfill requestIdleCallback / cancelIdleCallback for test env
(globalThis as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
(globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);

import { renderHook, act } from '@testing-library/react-native';
import { useStorageLocationManagement } from '../useStorageLocationManagement';

// Mock token scheduler / refreshToken (transitively imported via store)
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockCreateMutation = jest.fn().mockResolvedValue({
  data: {
    createStorageLocation: {
      storageLocation: { id: 'new-1', name: 'New Loc' },
    },
  },
});
const mockUpdateMutation = jest.fn().mockResolvedValue({
  data: {
    updateStorageLocation: {
      storageLocation: { id: 'loc-1', name: 'Updated' },
    },
  },
});
const mockDeleteMutation = jest.fn().mockResolvedValue({
  data: { deleteStorageLocation: { success: true } },
});
const mockSetDefaultMutation = jest.fn().mockResolvedValue({
  data: {
    setDefaultStorageLocation: {
      storageLocation: { id: 'loc-1', isDefault: true },
    },
  },
});
const mockFetchTree = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetStorageLocations') {
      return {
        data: {
          storageLocations: {
            edges: [
              {
                node: {
                  id: 'loc-1',
                  name: 'Fridge',
                  sortOrder: 1,
                  isDefault: true,
                  parentId: null,
                },
              },
              {
                node: {
                  id: 'loc-2',
                  name: 'Pantry',
                  sortOrder: 2,
                  isDefault: false,
                  parentId: null,
                },
              },
            ],
          },
        },
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
  useLazyQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'GetStorageLocationTree')
      return [mockFetchTree, { loading: false }];
    return { data: undefined, loading: false, error: undefined };
  }),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreateStorageLocation')
      return [mockCreateMutation, { loading: false }];
    if (opName === 'UpdateStorageLocation')
      return [mockUpdateMutation, { loading: false }];
    if (opName === 'DeleteStorageLocation')
      return [mockDeleteMutation, { loading: false }];
    if (opName === 'SetDefaultStorageLocation')
      return [mockSetDefaultMutation, { loading: false }];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data || []),
}));

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: jest.fn(() => ({
    createAddOperation: jest.fn((config: any) => {
      return async (input: any) => {
        const result = await config.mutation({
          variables: { input: config.transformInput(input) },
        });
        return config.onSuccess(result.data);
      };
    }),
  })),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryFieldUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/utils/compilerSafeWrappers');

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

describe('useStorageLocationManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns locations from query', () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.locations[0].name).toBe('Fridge');
    expect(result.current.locations[1].name).toBe('Pantry');
  });

  it('returns loading state', () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));
    expect(result.current.loading).toBe(false);
    expect(result.current.initialLoading).toBe(false);
  });

  it('skips query when homeId is undefined', () => {
    const { useQuery } = jest.requireMock('@apollo/client/react');
    renderHook(() => useStorageLocationManagement(undefined));

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: true }),
    );
  });

  it('does not skip when homeId is provided', () => {
    const { useQuery } = jest.requireMock('@apollo/client/react');
    renderHook(() => useStorageLocationManagement('home-1'));

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ skip: false }),
    );
  });

  it('builds tree from flat list when tree query is empty', () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));
    // Tree should be built from flat locations since treeData is null
    expect(result.current.tree).toHaveLength(2);
  });

  it('updateLocation calls mutation', async () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    await act(async () => {
      await result.current.updateLocation('loc-1', { name: 'Updated Fridge' });
    });

    expect(mockUpdateMutation).toHaveBeenCalled();
  });

  it('deleteLocation calls mutation', async () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockDeleteMutation).toHaveBeenCalled();
  });

  it('setDefaultLocation calls mutation', async () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    await act(async () => {
      await result.current.setDefaultLocation('loc-2');
    });

    expect(mockSetDefaultMutation).toHaveBeenCalled();
  });

  it('shows success toast on successful delete', async () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Storage location deleted');
  });

  it('shows error toast when delete returns success: false', async () => {
    mockDeleteMutation.mockResolvedValueOnce({
      data: {
        deleteStorageLocation: {
          success: false,
          message: 'Location has items',
        },
      },
    });

    const { result } = renderHook(() => useStorageLocationManagement('home-1'));

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockToastError).toHaveBeenCalledWith('Location has items');
  });

  it('returns refetch function', () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));
    expect(typeof result.current.refetch).toBe('function');
  });
});
