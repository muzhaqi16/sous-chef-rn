'use no memo';

// Polyfill requestIdleCallback / cancelIdleCallback for test env
(globalThis as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
(globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);

import { renderHook, act } from '@testing-library/react-native';
import { useStorageLocationManagement } from '../useStorageLocationManagement';

// Mock token scheduler / refreshToken (transitively imported via store)
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockRefetch = jest.fn().mockResolvedValue({});
const mockCreateMutation = jest.fn().mockResolvedValue({
  data: { createStorageLocation: { storageLocation: { id: 'new-1', name: 'New Loc' } } },
});
const mockUpdateMutation = jest.fn().mockResolvedValue({
  data: { updateStorageLocation: { storageLocation: { id: 'loc-1', name: 'Updated' } } },
});
const mockDeleteMutation = jest.fn().mockResolvedValue({
  data: { deleteStorageLocation: { success: true } },
});
const mockSetDefaultMutation = jest.fn().mockResolvedValue({
  data: { setDefaultStorageLocation: { storageLocation: { id: 'loc-1', isDefault: true } } },
});
const mockFetchTree = jest.fn();

jest.mock('#generated', () => ({
  useGetStorageLocationsQuery: jest.fn(() => ({
    data: {
      storageLocations: {
        edges: [
          { node: { id: 'loc-1', name: 'Fridge', sortOrder: 1, isDefault: true } },
          { node: { id: 'loc-2', name: 'Pantry', sortOrder: 2, isDefault: false } },
        ],
      },
    },
    loading: false,
    error: undefined,
    refetch: mockRefetch,
  })),
  useGetStorageLocationTreeLazyQuery: jest.fn(() => [mockFetchTree, { data: null }]),
  useCreateStorageLocationMutation: jest.fn(() => [mockCreateMutation, { loading: false }]),
  useUpdateStorageLocationMutation: jest.fn(() => [mockUpdateMutation, { loading: false }]),
  useDeleteStorageLocationMutation: jest.fn(() => [mockDeleteMutation]),
  useSetDefaultStorageLocationMutation: jest.fn(() => [mockSetDefaultMutation]),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data || []),
}));

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: jest.fn(() => ({
    createAddOperation: jest.fn((config: any) => {
      return async (input: any) => {
        const result = await config.mutation({ variables: { input: config.transformInput(input) } });
        return config.onSuccess(result.data);
      };
    }),
  })),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToQueryFieldUpdater: jest.fn(() => jest.fn()),
  createRemoveFromQueryFieldUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/utils/compilerSafeWrappers');

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
    const { useGetStorageLocationsQuery } = jest.requireMock('#generated');
    renderHook(() => useStorageLocationManagement(undefined));

    expect(useGetStorageLocationsQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    );
  });

  it('does not skip when homeId is provided', () => {
    const { useGetStorageLocationsQuery } = jest.requireMock('#generated');
    renderHook(() => useStorageLocationManagement('home-1'));

    expect(useGetStorageLocationsQuery).toHaveBeenCalledWith(
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

  it('returns refetch function', () => {
    const { result } = renderHook(() => useStorageLocationManagement('home-1'));
    expect(typeof result.current.refetch).toBe('function');
  });
});
