'use no memo';

// Polyfill requestIdleCallback / cancelIdleCallback for test env
(globalThis as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 0);
(globalThis as any).cancelIdleCallback = (id: number) => clearTimeout(id);

import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetStorageLocationsDocument,
  UpdateStorageLocationDocument,
  DeleteStorageLocationDocument,
  SetDefaultStorageLocationDocument,
} from '#operations/storageLocation/storageLocation.generated';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { useStorageLocationManagement } from '../useStorageLocationManagement';

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
  createAddToQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromQueryConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
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

// ----------------------------------------------------------------------
// Mock builders
// ----------------------------------------------------------------------

function buildLocationNode(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'StorageLocation',
    id: 'loc-1',
    name: 'Fridge',
    type: StorageType.Refrigerator,
    icon: null,
    color: null,
    temperature: null,
    description: null,
    isClimateControlled: false,
    capacity: null,
    capacityUnit: null,
    sortOrder: 1,
    isDefault: true,
    currentItemCount: 0,
    parentLocation: null,
    ...overrides,
  };
}

function buildGetLocationsMock(homeId: string = 'home-1'): MockedResponse {
  return {
    request: {
      query: GetStorageLocationsDocument,
      variables: { homeId },
    },
    result: {
      data: {
        storageLocations: {
          __typename: 'StorageLocationConnection',
          totalCount: 2,
          edges: [
            {
              __typename: 'StorageLocationEdge',
              cursor: 'c1',
              node: buildLocationNode({
                id: 'loc-1',
                name: 'Fridge',
                sortOrder: 1,
                isDefault: true,
              }),
            },
            {
              __typename: 'StorageLocationEdge',
              cursor: 'c2',
              node: buildLocationNode({
                id: 'loc-2',
                name: 'Pantry',
                sortOrder: 2,
                isDefault: false,
              }),
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
  };
}

function buildUpdateLocationMock(): MockedResponse {
  return {
    request: {
      query: UpdateStorageLocationDocument,
      variables: () => true,
    },
    result: {
      data: {
        updateStorageLocation: {
          __typename: 'StorageLocationPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          storageLocation: buildLocationNode({
            id: 'loc-1',
            name: 'Updated Fridge',
          }),
        },
      },
    },
  };
}

function buildDeleteLocationMock(
  success: boolean = true,
  message: string = 'OK',
): MockedResponse {
  return {
    request: {
      query: DeleteStorageLocationDocument,
      variables: () => true,
    },
    result: {
      data: {
        deleteStorageLocation: {
          __typename: 'StorageLocationPayload',
          success,
          message,
          code: success ? 'OK' : 'ERROR',
          storageLocation: success
            ? { __typename: 'StorageLocation', id: 'loc-1' }
            : null,
        },
      },
    },
  };
}

function buildSetDefaultMock(): MockedResponse {
  return {
    request: {
      query: SetDefaultStorageLocationDocument,
      variables: () => true,
    },
    result: {
      data: {
        setDefaultStorageLocation: {
          __typename: 'StorageLocationPayload',
          success: true,
          message: 'OK',
          code: 'OK',
          storageLocation: {
            __typename: 'StorageLocation',
            id: 'loc-2',
            name: 'Pantry',
            isDefault: true,
          },
        },
      },
    },
  };
}

describe('useStorageLocationManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns locations from query', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock()] },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));
    expect(result.current.locations[0].name).toBe('Fridge');
    expect(result.current.locations[1].name).toBe('Pantry');
  });

  it('returns loading state', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock()] },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.initialLoading).toBe(false);
  });

  it('skips query when homeId is undefined', () => {
    // No mock — if the query fired, MockedProvider would error
    const { result } = renderHookWithApollo(() =>
      useStorageLocationManagement(undefined),
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.locations).toEqual([]);
  });

  it('builds tree from flat list when tree query is empty', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock()] },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));
    expect(result.current.tree).toHaveLength(2);
  });

  it('updateLocation calls mutation', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        operationMocks: [buildGetLocationsMock(), buildUpdateLocationMock()],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    let updated: any;
    await act(async () => {
      updated = await result.current.updateLocation('loc-1', {
        name: 'Updated Fridge',
      });
    });

    expect(updated).not.toBe(false);
    expect(updated?.name).toBe('Updated Fridge');
  });

  it('deleteLocation calls mutation', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        operationMocks: [
          buildGetLocationsMock(),
          buildDeleteLocationMock(true),
        ],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    let deleted: any;
    await act(async () => {
      deleted = await result.current.deleteLocation('loc-1');
    });

    expect(deleted).toBe(true);
  });

  it('setDefaultLocation calls mutation', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        operationMocks: [buildGetLocationsMock(), buildSetDefaultMock()],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    let setDefault: any;
    await act(async () => {
      setDefault = await result.current.setDefaultLocation('loc-2');
    });

    expect(setDefault).not.toBe(false);
  });

  it('shows success toast on successful delete', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        operationMocks: [
          buildGetLocationsMock(),
          buildDeleteLocationMock(true),
        ],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Storage location deleted');
  });

  it('shows error toast when delete returns success: false', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        operationMocks: [
          buildGetLocationsMock(),
          buildDeleteLocationMock(false, 'Location has items'),
        ],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    expect(mockToastError).toHaveBeenCalledWith('Location has items');
  });

  it('returns refetch function', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock()] },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
