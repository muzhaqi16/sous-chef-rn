import { act, waitFor } from '@testing-library/react-native';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  GetHomesDocument,
  type GetHomesQuery,
} from '#operations/home/home.generated';
import type { HomeCard_HomeFragment } from '#features/home/components/HomeCard.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { useDefaultHome } from '../useDefaultHome';

// Minimal shapes the connectionUtils mock operates on (home/connection nodes).
type MockEdge = { node?: { id: string; isDefault?: boolean } | null } | null;
type MockConnection = { edges?: MockEdge[] | null } | null | undefined;
type MockHome = {
  pantries?: Array<{ id: string; isDefault?: boolean }>;
  pantriesConnection?: { edges?: MockEdge[] | null };
} | null;

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
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector(mockStoreState as Partial<RootState> as RootState),
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
  // usePreservedNodes composes usePreservedQueryData internally — passthrough.
  usePreservedQueryData: jest.fn(
    <T>(data: T | undefined, initial: T): T => data ?? initial,
  ),
}));

jest.mock('#/utils/connectionUtils', () => {
  // normalizeHomes flattens each home's `pantriesConnection.edges[].node`
  // into a `pantries` array so the hook (which reads `home.pantries`
  // directly) doesn't need to know about the underlying connection shape.
  const flattenPantries = (home: MockHome) => {
    if (!home) return home;
    if (home.pantries) return home;
    const edges = home.pantriesConnection?.edges;
    if (!Array.isArray(edges)) return home;
    return {
      ...home,
      pantries: edges.map(e => e?.node).filter(Boolean),
    };
  };
  return {
    normalizeHomes: jest.fn((homes: MockHome[] | null | undefined) =>
      Array.isArray(homes) ? homes.map(flattenPantries) : homes ?? [],
    ),
    normalizeHome: jest.fn((home: MockHome) => flattenPantries(home)),
    extractNodes: jest.fn((connection: MockConnection) => {
      if (!connection?.edges) return [];
      return connection.edges.map(e => e?.node).filter(Boolean);
    }),
  };
});

// We have to mock safeEvictMany since the hook calls it; it tries to access
// real Apollo internals otherwise.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  safeEvictMany: jest.fn(),
}));

// Helper builders ----------------------------------------------------------

/** The node on the wire: the query's own selection plus the card's fragment. */
type HomeNode = GetHomesQuery['homes']['edges'][number]['node'] &
  HomeCard_HomeFragment;

function buildHomeNode(args: {
  id: string;
  isDefault?: boolean;
  pantries?: Array<{ id: string; isDefault?: boolean }>;
  /** Set above `pantries.length` to express a truncated page. */
  totalCount?: number;
}): MockPart<HomeNode> {
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
      // Overridable so a test can express a TRUNCATED page: `GetHomes` selects
      // `pantriesConnection(first: 10)`, so totalCount can exceed the edges.
      totalCount: args.totalCount ?? args.pantries?.length ?? 0,
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
): MockFor<typeof GetHomesDocument> {
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

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  mockStoreState.isHomeSelectionReady = false;
  mockStoreState.isLoggingOut = false;
  mockStoreState.hasInitializedHomeData = false;
});

describe('useDefaultHome', () => {
  it('selects the account default when nothing is selected', async () => {
    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [
        buildGetHomesMock([buildHomeNode({ id: 'home-1', isDefault: true })]),
      ],
    });

    await waitFor(() =>
      expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith('home-1'),
    );
  });

  it('refetches once when a home is selected but the list came back empty', async () => {
    // Onboarding creates the home AFTER the hook's single fetch has already
    // run, so the cached connection is an empty list while a home is selected.
    // Left alone, the home never resolves and every consumer reading it from
    // that list shows its "no home" fallback for the rest of the session.
    mockStoreState.selectedHomeId = 'home-1';

    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [
        { ...buildGetHomesMock([]), maxUsageCount: 1 },
        buildGetHomesMock([
          buildHomeNode({
            id: 'home-1',
            isDefault: true,
            pantries: [{ id: 'pantry-1', isDefault: true }],
          }),
        ]),
      ],
    });

    // Only the refetched list names the home's pantry.
    await waitFor(() =>
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-1',
      ),
    );
  });

  it('does not keep refetching when the account genuinely has no homes', async () => {
    mockStoreState.selectedHomeId = 'home-1';

    const { fired, mock } = recordMock(GetHomesDocument, {
      data: {
        homes: {
          __typename: 'HomeConnection',
          totalCount: 0,
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });

    renderHookWithApollo(() => useDefaultHome(), {
      operationMocks: [mock],
    });

    // Initial fetch plus exactly one self-heal attempt — the empty result
    // must not feed back into another refetch.
    await waitFor(() => expect(fired).toHaveLength(2));
    await waitFor(() =>
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(true),
    );
    expect(fired).toHaveLength(2);
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
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
          true,
        ),
      );
    });

    it('does not repoint a pantry merely missing from a TRUNCATED page', async () => {
      // A page answers "is it on this page", not "does it exist". Judged
      // against the page, a home's eleventh pantry was stale on every launch.
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-11';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [
                { id: 'pantry-1', isDefault: true },
                { id: 'pantry-2', isDefault: false },
              ],
              totalCount: 12,
            }),
          ]),
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
          true,
        ),
      );

      expect(mockStoreState.setSelectedPantryId).not.toHaveBeenCalledWith(
        'pantry-1',
      );
    });

    it('repoints a persisted pantry that belongs to another home, and holds ready until it does', async () => {
      // `selectedPantryId` is persisted next to `selectedHomeId`, so a cold
      // start can restore a pantry from a home the user has since left. Ready
      // opens `usePantryQuery`'s gate, so flipping it on a valid HOME alone
      // sent `GetPantry` for a pantry the user cannot read.
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-from-a-home-i-left';

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [
                { id: 'pantry-1', isDefault: false },
                { id: 'pantry-2', isDefault: true },
              ],
            }),
          ]),
        ],
      });

      // Repointed at the selected home's OWN default, not merely nulled.
      await waitFor(() =>
        expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
          'pantry-2',
        ),
      );

      // Repointed, never evicted: that pantry is usually a live pantry of
      // another home, and evicting it empties THAT home's connection.
      const { safeEvictMany } = jest.requireMock(
        '#/apollo/utils/cacheUpdaters',
      );
      expect(safeEvictMany).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ id: 'pantry-from-a-home-i-left' }),
        ]),
      );

      // And ready was never flipped while the stale id was still in place.
      const readyCallIndex =
        mockStoreState.setIsHomeSelectionReady.mock.calls.findIndex(
          ([value]) => value === true,
        );
      const repointCallOrder =
        mockStoreState.setSelectedPantryId.mock.invocationCallOrder[0];
      if (readyCallIndex !== -1) {
        expect(
          mockStoreState.setIsHomeSelectionReady.mock.invocationCallOrder[
            readyCallIndex
          ],
        ).toBeGreaterThan(repointCallOrder!);
      }
    });
  });

  describe('default pantry extraction', () => {
    it('extracts default pantry from homes data', async () => {
      renderHookWithApollo(() => useDefaultHome(), {
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
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
          'pantry-2',
        ),
      );
    });

    it('falls back to first pantry when no default marked', async () => {
      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'home-1',
              isDefault: true,
              pantries: [{ id: 'pantry-1' }],
            }),
          ]),
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
          'pantry-1',
        ),
      );
    });
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

  describe('a first home with no server default', () => {
    // The server makes a first created or joined home the default itself; a
    // sync sent from here raced the create and was refused.
    const recordMarkDefault = () =>
      recordMock(MarkHomeAsDefaultDocument, {
        data: {
          markHomeAsDefault: {
            __typename: 'MarkHomeAsDefaultPayload',
            settings: { __typename: 'UserSettings', id: 'settings-1' },
            defaultPantry: null,
          },
        },
      });

    // One macrotask: long enough for a request fired from an effect to reach
    // the mock link, which is what `fired` records.
    const flushPendingRequests = () =>
      act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

    it('is selected locally and never sent to MarkHomeAsDefault', async () => {
      const markDefault = recordMarkDefault();

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'new-home',
              isDefault: false,
              pantries: [{ id: 'new-pantry', isDefault: true }],
            }),
          ]),
          markDefault.mock,
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(
          'new-home',
        ),
      );
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'new-pantry',
      );
      await flushPendingRequests();
      expect(markDefault.fired).toEqual([]);
    });

    it('stays unsent once that home is already selected', async () => {
      mockStoreState.selectedHomeId = 'invited-home';
      const markDefault = recordMarkDefault();

      renderHookWithApollo(() => useDefaultHome(), {
        operationMocks: [
          buildGetHomesMock([
            buildHomeNode({
              id: 'invited-home',
              isDefault: false,
              pantries: [{ id: 'invited-pantry', isDefault: true }],
            }),
          ]),
          markDefault.mock,
        ],
      });

      await waitFor(() =>
        expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
          true,
        ),
      );
      await flushPendingRequests();
      expect(markDefault.fired).toEqual([]);
    });
  });
});
