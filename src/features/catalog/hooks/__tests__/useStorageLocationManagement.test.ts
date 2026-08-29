'use no memo';

// Polyfill requestIdleCallback / cancelIdleCallback for test env
let idleHandleSeq = 0;
const idleTimers = new Map<number, ReturnType<typeof setTimeout>>();
globalThis.requestIdleCallback = (cb: IdleRequestCallback): number => {
  const handle = ++idleHandleSeq;
  idleTimers.set(
    handle,
    setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 0 }), 0),
  );
  return handle;
};
globalThis.cancelIdleCallback = (handle: number): void => {
  const timer = idleTimers.get(handle);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(handle);
  }
};

import { InMemoryCache } from '@apollo/client';
import { act, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetStorageLocationsDocument,
  UpdateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { StorageType } from '#/graphql/generated/schemaTypes';
import { useStorageLocationManagement } from '#features/catalog/hooks/useStorageLocationManagement';
import { storeApi } from '#store';

type ManagementApi = ReturnType<typeof useStorageLocationManagement>;

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn(
    <T>(data: T[] | null | undefined) => data || [],
  ),
  // usePreservedNodes composes usePreservedQueryData internally — passthrough.
  usePreservedQueryData: jest.fn(
    <T>(data: T | undefined, initial: T): T => data ?? initial,
  ),
}));

type MockAddOperationConfig<TInput, TResult> = {
  mutation: (options: {
    variables: { input: Record<string, unknown> };
  }) => Promise<{ data?: TResult }>;
  transformInput: (input: TInput) => Record<string, unknown>;
  onSuccess: (data?: TResult) => unknown;
};

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: jest.fn(() => ({
    createAddOperation: jest.fn(
      <TInput, TResult>(config: MockAddOperationConfig<TInput, TResult>) => {
        return async (input: TInput) => {
          const result = await config.mutation({
            variables: { input: config.transformInput(input) },
          });
          return config.onSuccess(result.data);
        };
      },
    ),
  })),
}));

// Spread the real module. Stubbing every factory to `jest.fn()` meant the
// optimistic remove and its revert — the whole local-first half of this hook —
// executed nothing, so the suite was green on writes that never happened. The
// factories are spied on top of the real implementations instead, which keeps
// the call assertions AND exercises the cache.
jest.mock('#/apollo/utils/cacheUpdaters', () =>
  jest.requireActual('#/apollo/utils/cacheUpdaters'),
);

jest.mock('#/utils/finallyHelpers');

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
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
          __typename: 'UpdateStorageLocationPayload',
          home: null,
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
  refusal: { code?: string; field?: string } = {},
): MockedResponse {
  return {
    request: {
      query: DeleteStorageLocationDocument,
      variables: () => true,
    },
    result: {
      data: {
        deleteStorageLocation: success
          ? {
              __typename: 'DeleteStorageLocationPayload',
              home: null,
              storageLocation: {
                __typename: 'StorageLocation',
                id: 'loc-1',
              },
            }
          : {
              __typename: 'ValidationError',
              message,
              code: refusal.code ?? 'VALIDATION_FAILED',
              field: refusal.field ?? null,
            },
      },
    },
  };
}

function buildSetDefaultMock(): MockedResponse {
  return {
    request: {
      query: MarkStorageLocationAsDefaultDocument,
      variables: () => true,
    },
    result: {
      data: {
        markStorageLocationAsDefault: {
          __typename: 'MarkStorageLocationAsDefaultPayload',
          home: null,
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

    let updated!: Awaited<ReturnType<ManagementApi['updateLocation']>>;
    await act(async () => {
      updated = await result.current.updateLocation('loc-1', {
        name: 'Updated Fridge',
      });
    });

    // The hook returns whether the edit stuck (server-confirmed OR queued);
    // the new name is asserted on the cache, which is what the screen reads.
    expect(updated).not.toBe(false);
    await waitFor(() =>
      expect(result.current.locations.find(l => l.id === 'loc-1')?.name).toBe(
        'Updated Fridge',
      ),
    );
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

    let deleted!: Awaited<ReturnType<ManagementApi['deleteLocation']>>;
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

    let setDefault!: Awaited<ReturnType<ManagementApi['setDefaultLocation']>>;
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

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Storage location deleted successfully',
    );
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

    // The app's own words, never the server's. `message` is English by
    // construction (no `Accept-Language` is sent and the token carries no
    // locale), so asserting it here pinned the leak in place — one commit after
    // "fix(shopping-list): … stop leaking server English".
    expect(mockToastError).not.toHaveBeenCalledWith('Location has items');
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it('shows the copy for the field the server named', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1', 'pantry-1'),
      {
        operationMocks: [
          buildGetLocationsMock(),
          buildDeleteLocationMock(false, 'Location has items', {
            field: 'storageLocation',
          }),
        ],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));
    await act(async () => {
      await result.current.deleteLocation('loc-1');
    });

    const [shown] = mockToastError.mock.calls[0] as [string];
    expect(shown).not.toBe('Location has items');
    expect(typeof shown).toBe('string');
    expect(shown.length).toBeGreaterThan(0);
  });

  describe('editing works offline', () => {
    /**
     * This block asserted the opposite until the API closed the gap. Update and
     * set-default write absolute fields keyed by an existing `id`, so a replay
     * lands the same state twice; a replayed delete now converges server-side
     * (`converged: true`) instead of 404ing. So all three queue rather than
     * refuse, and the screen no longer disables the controls.
     *
     * What these assert is the half that lives in this hook: the change is on
     * the cache before any server round trip, and the call no longer refuses.
     * The mutation is mocked because `queueLink` — which turns an offline fire
     * into a queued null result — is not in this harness; its own tests cover
     * that half.
     */
    const offline = () =>
      storeApi.setState({ isOnline: false, apiReachable: null } as Partial<
        ReturnType<typeof storeApi.getState>
      >);

    afterEach(() =>
      storeApi.setState({ isOnline: true, apiReachable: true } as Partial<
        ReturnType<typeof storeApi.getState>
      >),
    );

    it('updateLocation applies the edit to the cache while offline', async () => {
      const { result } = renderHookWithApollo(
        () => useStorageLocationManagement('home-1'),
        {
          operationMocks: [buildGetLocationsMock(), buildUpdateLocationMock()],
        },
      );
      await waitFor(() => expect(result.current.locations).toHaveLength(2));

      offline();

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.updateLocation('loc-1', {
          name: 'Updated Fridge',
        });
      });

      // Previously this returned false without touching the network.
      expect(outcome).not.toBe(false);
    });

    it('deleteLocation goes through while offline', async () => {
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

      offline();

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.deleteLocation('loc-1');
      });

      // Previously this returned false and toasted "Not available offline".
      expect(outcome).toBe(true);
      expect(mockToastError).not.toHaveBeenCalledWith('Not available offline');
    });

    it('setDefaultLocation moves the flag while offline', async () => {
      const { result } = renderHookWithApollo(
        () => useStorageLocationManagement('home-1'),
        { operationMocks: [buildGetLocationsMock(), buildSetDefaultMock()] },
      );
      await waitFor(() => expect(result.current.locations).toHaveLength(2));

      offline();

      await act(async () => {
        await result.current.setDefaultLocation('loc-2');
      });

      await waitFor(() =>
        expect(
          result.current.locations.find(l => l.id === 'loc-2')?.isDefault,
        ).toBe(true),
      );
    });
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

describe('updateLocation writes what consumers read', () => {
  /**
   * The edit sheet is seeded with the FLAT `parentLocationId` (read off
   * `location.parentLocation?.id`), but `GetStorageLocations` selects only the
   * NESTED `parentLocation { id name }` — and that nested field is what
   * `buildTreeFromFlatList` and the delete guard read. Writing the input bag
   * straight onto the entity therefore set a field nothing reads and left the
   * one everything reads pointing at the old parent.
   */
  it('re-parents the node, not just the flat id', async () => {
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock(), buildUpdateLocationMock()] },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    await act(async () => {
      await result.current.updateLocation('loc-2', {
        parentLocationId: 'loc-1',
      });
    });

    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.id,
      ).toBe('loc-1'),
    );

    // And the tree the screen renders must actually move it.
    const roots = result.current.tree;
    expect(roots.find(node => node.id === 'loc-2')).toBeUndefined();
    expect(
      roots
        .find(node => node.id === 'loc-1')
        ?.childLocations.map(child => child.id),
    ).toContain('loc-2');
  });

  it('keeps the parent link live when the parent is later renamed', async () => {
    // Own the cache so the test can rename the parent the way any other write
    // would.
    const cache = new InMemoryCache();
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        cache,
        operationMocks: [buildGetLocationsMock(), buildUpdateLocationMock()],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    await act(async () => {
      await result.current.updateLocation('loc-2', {
        parentLocationId: 'loc-1',
      });
    });

    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.id,
      ).toBe('loc-1'),
    );

    // The parent is an entity in its own right. Writing a COPY of its fields
    // onto the child forks it: renaming the parent updates one row and leaves
    // the child's sub-label reading the old name, with no fetch to correct it
    // because nothing about the child changed.
    act(() => {
      cache.modify({
        id: cache.identify({
          __typename: 'StorageLocation',
          id: 'loc-1',
        }),
        fields: { name: () => 'Cellar' },
      });
    });

    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.name,
      ).toBe('Cellar'),
    );
  });

  it('clears the previous default when the edit sets one', async () => {
    // The server answers with the location that was EDITED. The shared mock
    // always echoes loc-1, which would re-normalize the very flag under test.
    const updatedLoc2: MockedResponse = {
      request: { query: UpdateStorageLocationDocument, variables: () => true },
      result: {
        data: {
          updateStorageLocation: {
            __typename: 'UpdateStorageLocationPayload',
            home: null,
            storageLocation: buildLocationNode({
              id: 'loc-2',
              name: 'Pantry',
              sortOrder: 2,
              isDefault: true,
            }),
          },
        },
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock(), updatedLoc2] },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));
    // loc-1 is the seeded default.
    expect(
      result.current.locations.find(l => l.id === 'loc-1')?.isDefault,
    ).toBe(true);

    await act(async () => {
      await result.current.updateLocation('loc-2', { isDefault: true });
    });

    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.isDefault,
      ).toBe(true),
    );
    // Default is exclusive. Two rows badged Default is the visible symptom.
    expect(
      result.current.locations.find(l => l.id === 'loc-1')?.isDefault,
    ).toBe(false);
  });

  it('reverts a re-parent the server refuses', async () => {
    const refusal: MockedResponse = {
      request: { query: UpdateStorageLocationDocument, variables: () => true },
      result: {
        data: {
          updateStorageLocation: {
            __typename: 'ValidationError',
            message: 'nope',
          },
        },
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      { operationMocks: [buildGetLocationsMock(), refusal] },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    await act(async () => {
      await result.current.updateLocation('loc-2', {
        parentLocationId: 'loc-1',
      });
    });

    // The pre-edit value was absent from the entity's own keys, so a snapshot
    // filtered by `key in current` could not restore it.
    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation,
      ).toBeNull(),
    );
  });

  it('restores a live parent link when the server refuses', async () => {
    const refusal: MockedResponse = {
      request: { query: UpdateStorageLocationDocument, variables: () => true },
      result: {
        data: {
          updateStorageLocation: {
            __typename: 'ValidationError',
            message: 'nope',
          },
        },
      },
      maxUsageCount: Number.POSITIVE_INFINITY,
    };

    const cache = new InMemoryCache();
    const { result } = renderHookWithApollo(
      () => useStorageLocationManagement('home-1'),
      {
        cache,
        operationMocks: [
          buildGetLocationsMock(),
          buildUpdateLocationMock(),
          refusal,
        ],
      },
    );

    await waitFor(() => expect(result.current.locations).toHaveLength(2));

    // Give loc-2 a parent, the way the accepted path does.
    await act(async () => {
      await result.current.updateLocation('loc-2', {
        parentLocationId: 'loc-1',
      });
    });
    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.id,
      ).toBe('loc-1'),
    );

    // Now detach it and have the server say no. The snapshot the revert restores
    // is taken from a query READ, whose `parentLocation` is denormalized — so
    // restoring it verbatim re-introduces the copy the write path exists to
    // avoid, and only on the refusal path, where nothing looks at it again.
    await act(async () => {
      await result.current.updateLocation('loc-2', {
        parentLocationId: null,
      });
    });
    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.id,
      ).toBe('loc-1'),
    );

    act(() => {
      cache.modify({
        id: cache.identify({ __typename: 'StorageLocation', id: 'loc-1' }),
        fields: { name: () => 'Cellar' },
      });
    });

    await waitFor(() =>
      expect(
        result.current.locations.find(l => l.id === 'loc-2')?.parentLocation
          ?.name,
      ).toBe('Cellar'),
    );
  });
});
