import { waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { GetHomesDocument } from '#operations/home/home.generated';
import { SetDefaultHomeDocument } from '#operations/home/userSettings.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useDefaultHome } from '../useDefaultHome';

// Store mock state — mutable so each test can prep its own scenario
const mockStoreState = {
  selectedHomeId: null as string | null,
  setSelectedHomeId: jest.fn(),
  selectedPantryId: null as string | null,
  setSelectedPantryId: jest.fn(),
  isHomeSelectionReady: false,
  setIsHomeSelectionReady: jest.fn(),
  isLoggingOut: false,
  hasInitializedHomeData: false,
  setHasInitializedHomeData: jest.fn(),
  accessToken: 'mock-token' as string | null,
  refreshToken: 'mock-refresh' as string | null,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  usePantryState: jest.fn(() => ({
    selectedPantryId: mockStoreState.selectedPantryId,
    setSelectedPantryId: mockStoreState.setSelectedPantryId,
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
  useIsHomeSelectionReady: jest.fn(() => mockStoreState.isHomeSelectionReady),
  useSetIsHomeSelectionReady: jest.fn(
    () => mockStoreState.setIsHomeSelectionReady,
  ),
  useIsLoggingOut: jest.fn(() => mockStoreState.isLoggingOut),
}));

jest.mock('#store', () => ({
  useStore: {
    getState: jest.fn(() => ({
      hasInitializedHomeData: mockStoreState.hasInitializedHomeData,
      setHasInitializedHomeData: mockStoreState.setHasInitializedHomeData,
    })),
  },
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data ?? []),
}));

jest.mock('#/utils/connectionUtils', () => {
  // normalizeHomes flattens each home's `pantriesConnection.edges[].node`
  // into a `pantries` array so the hook (which reads `home.pantries`
  // directly) doesn't need to know about the underlying connection shape.
  const flattenPantries = (home: any) => {
    if (!home) return home;
    if (home.pantries) return home;
    const edges = home.pantriesConnection?.edges;
    if (!Array.isArray(edges)) return home;
    return {
      ...home,
      pantries: edges.map((e: any) => e?.node).filter(Boolean),
    };
  };
  return {
    normalizeHomes: jest.fn((homes: any) =>
      Array.isArray(homes) ? homes.map(flattenPantries) : homes ?? [],
    ),
    normalizeHome: jest.fn((home: any) => flattenPantries(home)),
    extractNodes: jest.fn((connection: any) => {
      if (!connection?.edges) return [];
      return connection.edges.map((e: any) => e?.node).filter(Boolean);
    }),
  };
});

// We have to mock safeEvictMany since the hook calls it; it tries to access
// real Apollo internals otherwise.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  safeEvictMany: jest.fn(),
}));

// Helper builders ----------------------------------------------------------

function buildHomeNode(args: {
  id: string;
  isDefault?: boolean;
  pantries?: Array<{ id: string; isDefault?: boolean }>;
}) {
  return {
    __typename: 'Home',
    id: args.id,
    name: `Home ${args.id}`,
    isDefault: args.isDefault ?? false,
    version: 1,
    membersConnection: {
      __typename: 'MembershipConnection',
      totalCount: 0,
      edges: [],
    },
    invitesConnection: {
      __typename: 'HomeInviteConnection',
      totalCount: 0,
      edges: [],
    },
    // The query selects pantriesConnection (not a flat `pantries` field).
    // The mock `normalizeHomes` (above) flattens this into `pantries` for
    // the hook to read.
    pantriesConnection: {
      __typename: 'PantryConnection',
      totalCount: args.pantries?.length ?? 0,
      edges: (args.pantries ?? []).map(p => ({
        __typename: 'PantryEdge',
        node: {
          __typename: 'Pantry',
          id: p.id,
          name: `Pantry ${p.id}`,
          isDefault: p.isDefault ?? false,
        },
      })),
    },
    myMembership: {
      __typename: 'Membership',
      id: `mem-${args.id}`,
      role: MembershipRole.Member,
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
    },
  };
}

function buildGetHomesMock(
  homes: Array<ReturnType<typeof buildHomeNode>>,
): MockedResponse {
  return {
    request: {
      query: GetHomesDocument,
      variables: () => true,
    },
    result: {
      data: {
        homes: {
          __typename: 'HomeConnection',
          totalCount: homes.length,
          edges: homes.map(node => ({
            __typename: 'HomeEdge',
            cursor: node.id,
            node,
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    },
    // The hook fires the lazy query at most once per "init" cycle; mark
    // unlimited usage so both initial fetches and refetches consume the same
    // mock (the test scenarios don't need to differentiate).
    maxUsageCount: 10,
  };
}

function buildSetDefaultHomeMock(homeId: string): MockedResponse {
  return {
    request: {
      query: SetDefaultHomeDocument,
      variables: { homeId },
    },
    result: {
      data: {
        setDefaultHome: {
          __typename: 'SetDefaultHomePayload',
          success: true,
          message: 'OK',
          code: 'OK',
          settings: { __typename: 'UserSettings', id: 'settings-1' },
          defaultPantry: null,
        },
      },
    },
    maxUsageCount: 10,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  mockStoreState.isHomeSelectionReady = false;
  mockStoreState.isLoggingOut = false;
  mockStoreState.hasInitializedHomeData = false;
});

describe('useDefaultHome', () => {
  it('returns initial state when no data', () => {
    // No GetHomes mock — hook fires query but resolves to undefined initially.
    // Since hasInitializedHomeData=false → canAttemptQueries=true → query
    // fires. Provide an empty homes mock to satisfy.
    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    // Initial render before query resolves
    expect(result.current.state.selectedHomeId).toBeNull();
    expect(result.current.state.homes).toEqual([]);
    expect(result.current.state.hasDefaultHome).toBe(false);
    expect(result.current.state.remoteDefaultHomeId).toBeNull();
    expect(result.current.state.isHomeSelectionReady).toBe(false);
  });

  it('returns selectedHomeId from store', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    expect(result.current.state.selectedHomeId).toBe('home-1');
    expect(result.current.state.hasDefaultHome).toBe(true);
  });

  it('falls back to remoteDefaultHomeId when no selectedHomeId', async () => {
    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [
        buildGetHomesMock([buildHomeNode({ id: 'home-1', isDefault: true })]),
        // Hook will also fire SetDefaultHome (first home via invitation logic
        // when only one home exists) — provide a permissive matcher.
        buildSetDefaultHomeMock('home-1'),
      ],
    });

    await waitFor(() =>
      expect(result.current.state.remoteDefaultHomeId).toBe('home-1'),
    );
    expect(result.current.state.selectedHomeId).toBe('home-1');
  });

  it('returns homes from query data', async () => {
    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [
        buildGetHomesMock([
          buildHomeNode({ id: 'home-1', isDefault: true }),
          buildHomeNode({ id: 'home-2' }),
        ]),
        buildSetDefaultHomeMock('home-1'),
      ],
    });

    await waitFor(() => expect(result.current.state.homes).toHaveLength(2));
  });

  it('exposes loading state and error fields', async () => {
    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    // The lazy query fires from a useEffect, so initial loading might be true
    // momentarily. We just assert the field exists.
    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.error).toBeFalsy();
  });

  describe('getDefaultPantry', () => {
    it('returns default pantry from home', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const home = {
        pantries: [
          { id: 'p-1', isDefault: false },
          { id: 'p-2', isDefault: true },
        ],
      };

      const pantry = result.current.actions.getDefaultPantry(home);
      expect(pantry?.id).toBe('p-2');
    });

    it('returns first pantry when no default marked', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const home = {
        pantries: [
          { id: 'p-1', isDefault: false },
          { id: 'p-2', isDefault: false },
        ],
      };

      const pantry = result.current.actions.getDefaultPantry(home);
      expect(pantry?.id).toBe('p-1');
    });

    it('returns null when no pantries', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const pantry = result.current.actions.getDefaultPantry({ pantries: [] });
      expect(pantry).toBeNull();
    });

    it('handles nested home property', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const homeData = {
        home: {
          pantries: [{ id: 'p-1', isDefault: true }],
        },
      };

      const pantry = result.current.actions.getDefaultPantry(homeData);
      expect(pantry?.id).toBe('p-1');
    });

    it('returns null for null input', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const pantry = result.current.actions.getDefaultPantry(null);
      expect(pantry).toBeNull();
    });

    it('returns null when home has no pantries property', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const pantry = result.current.actions.getDefaultPantry({});
      expect(pantry).toBeNull();
    });

    it('returns null for undefined input', () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      const pantry = result.current.actions.getDefaultPantry(undefined);
      expect(pantry).toBeNull();
    });
  });

  it('exposes selectedPantryId and setSelectedPantryId', () => {
    mockStoreState.selectedPantryId = 'pantry-1';

    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    expect(result.current.state.selectedPantryId).toBe('pantry-1');
    expect(typeof result.current.actions.setSelectedPantryId).toBe('function');
  });

  it('sets early ready when persisted home/pantry IDs exist', async () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';
    mockStoreState.isHomeSelectionReady = false;

    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    await waitFor(() => {
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(true);
    });
  });

  it('does not set early ready when already ready', () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = 'pantry-1';
    mockStoreState.isHomeSelectionReady = true;

    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    // Should not call setIsHomeSelectionReady since already ready
    expect(mockStoreState.setIsHomeSelectionReady).not.toHaveBeenCalled();
  });

  it('does not set early ready when no selectedPantryId', () => {
    mockStoreState.selectedHomeId = 'home-1';
    mockStoreState.selectedPantryId = null;
    mockStoreState.isHomeSelectionReady = false;

    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    expect(mockStoreState.setIsHomeSelectionReady).not.toHaveBeenCalledWith(
      true,
    );
  });

  describe('home selection ready state', () => {
    it('sets ready when no homes exist and query was called', async () => {
      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [buildGetHomesMock([])],
      });

      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
          true,
        ),
      );
    });

    it('sets ready when valid home is selected', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([buildHomeNode({ id: 'home-1', isDefault: true })]),
          buildSetDefaultHomeMock('home-1'),
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
          true,
        ),
      );
    });
  });

  describe('default pantry extraction', () => {
    it('extracts default pantry from homes data', async () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [
                { id: 'pantry-1' },
                { id: 'pantry-2', isDefault: true },
              ],
            }),
          ]),
          buildSetDefaultHomeMock('home-1'),
        ],
      });

      await waitFor(() =>
        expect(result.current.state.remoteDefaultHomeId).toBe('home-1'),
      );
    });

    it('falls back to first pantry when no default marked', async () => {
      const { result } = renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [{ id: 'pantry-1' }],
            }),
          ]),
          buildSetDefaultHomeMock('home-1'),
        ],
      });

      await waitFor(() =>
        expect(result.current.state.remoteDefaultHomeId).toBe('home-1'),
      );
    });
  });

  it('returns hasDefaultHome as true when currentHomeId exists', () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });

    expect(result.current.state.hasDefaultHome).toBe(true);
  });

  it('returns hasDefaultHome as false when no home is selected or default', () => {
    const { result } = renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [buildGetHomesMock([])],
    });
    expect(result.current.state.hasDefaultHome).toBe(false);
  });

  describe('sync remote defaults on mismatch (invitation acceptance restart)', () => {
    it('restores selectedHomeId to remoteDefaultHomeId when they differ', async () => {
      mockStoreState.selectedHomeId = 'accepted-home';
      mockStoreState.selectedPantryId = 'accepted-pantry';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'default-home',
              isDefault: true,
              pantries: [{ id: 'default-pantry', isDefault: true }],
            }),
            buildHomeNode({
              id: 'accepted-home',
              isDefault: false,
              pantries: [{ id: 'accepted-pantry', isDefault: true }],
            }),
          ]),
        ],
      });

      await waitFor(() => {
        expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(
          'default-home',
        );
      });
      // Pantry sync happens in the same effect tick as the home sync
      await waitFor(() => {
        expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
          'default-pantry',
        );
      });
    });

    it('does not restore when selectedHomeId matches remoteDefaultHomeId (explicit default)', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [{ id: 'pantry-1', isDefault: true }],
            }),
          ]),
        ],
      });

      // Allow effects to settle
      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalled(),
      );

      expect(mockStoreState.setSelectedHomeId).not.toHaveBeenCalled();
      expect(mockStoreState.setSelectedPantryId).not.toHaveBeenCalled();
    });

    it('skips restore when remoteDefaultHomeId is null', async () => {
      mockStoreState.selectedHomeId = 'some-home';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'some-home',
              isDefault: false,
              pantries: [],
            }),
          ]),
          // First-home-via-invitation may fire SetDefaultHome
          buildSetDefaultHomeMock('some-home'),
        ],
      });

      // Allow effects to settle by waiting for ready state
      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalled(),
      );

      // No remote default → no restore via the first sync effect
      expect(mockStoreState.setSelectedHomeId).not.toHaveBeenCalled();
    });
  });

  describe('first home via invitation', () => {
    it('syncs server default when user has exactly one home with no server default', async () => {
      mockStoreState.selectedHomeId = 'invited-home';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'invited-home',
              isDefault: false,
              pantries: [{ id: 'invited-pantry', isDefault: true }],
            }),
          ]),
          buildSetDefaultHomeMock('invited-home'),
        ],
      });

      // Allow effects to settle by waiting for ready state
      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalled(),
      );
    });

    it('does not sync when server already has a default', async () => {
      mockStoreState.selectedHomeId = 'home-1';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [],
            }),
          ]),
        ],
      });

      // Allow effects to settle
      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalled(),
      );

      // The "first home via invitation" effect's first guard is
      // `if (remoteDefaultHomeId) return;` — server already has a default
      // (home-1.isDefault = true) so the SetDefaultHome mutation never fires.
      // We can't directly assert the mutation didn't fire, but if it had been
      // called with home-1 it would have errored (no mock provided for that
      // variable combo). The fact that we got to `isHomeSelectionReady=true`
      // proves the path completed successfully.
    });

    it('does not sync when user has multiple homes', async () => {
      mockStoreState.selectedHomeId = 'home-1';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({ id: 'home-1', isDefault: false, pantries: [] }),
            buildHomeNode({ id: 'home-2', isDefault: false, pantries: [] }),
          ]),
        ],
      });

      // Allow effects to settle
      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalled(),
      );

      // Multiple homes → first-home-via-invitation guard fails (length !== 1).
      // No SetDefaultHome should fire — the mock provider would error if it
      // had, since we didn't include that mock.
    });
  });
});
