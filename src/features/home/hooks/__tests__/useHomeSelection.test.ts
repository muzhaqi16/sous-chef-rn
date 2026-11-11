import { act } from '@testing-library/react-native';
import { useStore } from '#store';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { ErrorCode, MembershipRole } from '#/graphql/generated/schemaTypes';
import type { GetHomesQuery } from '#operations/home/home.generated';
import { useHomeSelection } from '../useHomeSelection';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';

jest.mock('#/services/errorService');

// The GetHomes connection-node shape this hook consumes. Derived from the
// generated query so it stays in sync.
type MockHomeNode = GetHomesQuery['homes']['edges'][number]['node'];

/** `pantries` is a shorthand: it is written out as a real connection. */
type MockHomeNodeOverrides = Partial<MockHomeNode> & {
  pantries?: Array<{ id: string; name?: string; isDefault?: boolean }>;
};

let mockIdCounter = 0;
const nextMockId = () => `test-id-${++mockIdCounter}`;

const createMockHomeNode = (
  overrides?: MockHomeNodeOverrides,
): MockHomeNode => {
  const { pantries, ...rest } = overrides ?? {};
  const pantriesConnection: MockHomeNode['pantriesConnection'] | undefined =
    pantries
      ? {
          __typename: 'PantryConnection',
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: pantries.length,
          edges: pantries.map(pantry => ({
            __typename: 'PantryEdge',
            node: {
              __typename: 'Pantry',
              version: 1,
              id: pantry.id,
              name: pantry.name ?? 'Test Pantry',
              isDefault: pantry.isDefault ?? false,
            },
          })),
        }
      : undefined;

  return {
    __typename: 'Home',
    id: nextMockId(),
    name: 'Test Home',
    isDefault: false,
    version: 1,
    myMembership: {
      __typename: 'Membership',
      version: 1,
      id: nextMockId(),
      role: MembershipRole.Member,
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
    },
    pantriesConnection: {
      __typename: 'PantryConnection',
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
      totalCount: 0,
      edges: [],
    },
    membersConnection: {
      __typename: 'MembershipConnection',
      totalCount: 0,
    },
    ...rest,
    ...(pantriesConnection ? { pantriesConnection } : {}),
  };
};

const createHomes = () => [
  createMockHomeNode({
    id: 'home-1',
    name: 'Home 1',
    pantries: [
      { id: 'pantry-1', isDefault: true },
      { id: 'pantry-2', isDefault: false },
    ],
  }),
  createMockHomeNode({
    id: 'home-2',
    name: 'Home 2',
    pantries: [{ id: 'pantry-3', isDefault: true }],
  }),
];

/** Puts the selection where a test starts it. */
const selected = (homeId: string | null, pantryId: string | null = null) => {
  useStore.setState({
    selectedHomeId: homeId,
    selectedPantryId: pantryId,
    isHomeSelectionReady: true,
  });
};

/** The selection as the store holds it. */
const selection = () => {
  const { selectedHomeId, selectedPantryId, isHomeSelectionReady } =
    useStore.getState();
  return { selectedHomeId, selectedPantryId, isHomeSelectionReady };
};

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ isOnline: true, apiReachable: true });
  selected(null);
  useDefaultHomeSyncStore.getState().clearPending();
});

function setDefaultMock(defaultPantryId: string | null = null) {
  const data: MockDataFor<typeof MarkHomeAsDefaultDocument> = {
    markHomeAsDefault: {
      __typename: 'MarkHomeAsDefaultPayload',
      settings: {
        __typename: 'UserSettings',
        id: 'settings-1',
      },
      defaultPantry: defaultPantryId
        ? { __typename: 'Pantry', version: 1, id: defaultPantryId }
        : null,
    },
  };
  return recordMock(MarkHomeAsDefaultDocument, {
    data,
  });
}

function setDefaultFailureMock() {
  const data: MockDataFor<typeof MarkHomeAsDefaultDocument> = {
    markHomeAsDefault: {
      __typename: 'NotFoundError',
      // Stated, not left to SDL completion: completion pins the union member
      // from `__typename` but fills `code` deterministically with the first
      // `ErrorCode` value, which is not the refusal this test means. There is
      // no `HOME_NOT_FOUND` in the enum — only `NOT_FOUND`.
      code: ErrorCode.NotFound,
      message: 'Home not found',
    },
  };
  return recordMock(MarkHomeAsDefaultDocument, {
    data,
  });
}

/**
 * What `queueLink` returns for a queued write: the payload field present but
 * null, and no error. `settledStatus` reads that as `'queued'`.
 */
function queuedMock() {
  const data: MockDataFor<typeof MarkHomeAsDefaultDocument> = {
    markHomeAsDefault: null,
  };
  return recordMock(MarkHomeAsDefaultDocument, {
    data,
    partial: true,
  });
}

function setDefaultErrorMock() {
  return recordMock(MarkHomeAsDefaultDocument, {
    error: new Error('Network error'),
  });
}

describe('useHomeSelection', () => {
  describe('setDefaultHome', () => {
    it('returns true early when home is already default both locally and remotely', async () => {
      selected('home-1');
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: 'home-1',
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-1');
      });

      expect(success!).toBe(true);
      expect(m.fired).toEqual([]);
    });

    it('still fires when the flag is default only because we wrote it', async () => {
      // `remoteDefaultHomeId` is derived from the field the local write sets,
      // so without the pending marker a queued-then-dropped write leaves the
      // retry skipping as "already done".
      selected('home-1');
      useDefaultHomeSyncStore.getState().markPending('home-1');
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: 'home-1',
          }),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.setDefaultHome('home-1');
      });

      expect(m.fired).toHaveLength(1);
    });

    it('shows error for empty homeId', async () => {
      const m = setDefaultMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('');
      });

      expect(success!).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Invalid home ID',
      );
    });

    it('fires the mutation for a home missing from the local list', async () => {
      // The local list is a HINT, not an authority on existence: a mutation's
      // `onCompleted` runs before React re-renders, so a home that was just
      // created or joined is legitimately absent from the `homes` prop.
      const m = setDefaultMock('pantry-9');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('brand-new-home');
      });

      expect(success!).toBe(true);
      expect(m.fired).toContainEqual({
        input: { homeId: 'brand-new-home' },
        today: expect.any(String),
      });
      expect(alertService.alert).not.toHaveBeenCalled();
      // No local record, so no pantry hint — the server's `defaultPantry` is
      // what lands the selection.
      expect(selection()).toEqual({
        selectedHomeId: 'brand-new-home',
        selectedPantryId: 'pantry-9',
        isHomeSelectionReady: true,
      });
    });

    it('pre-selects the default pantry from pantriesConnection', async () => {
      // `GetHomes` returns `pantriesConnection`, never a flat `pantries` array,
      // so reading only `pantries` cleared the pantry on every real switch.
      const m = setDefaultMock(); // server returns no defaultPantry
      const homes: MockHomeNode[] = [
        createMockHomeNode({ id: 'home-1', name: 'Home 1' }),
        {
          ...createMockHomeNode({ id: 'home-2', name: 'Home 2' }),
          pantriesConnection: {
            __typename: 'PantryConnection',
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: 2,
            edges: [
              {
                __typename: 'PantryEdge',
                node: {
                  __typename: 'Pantry',
                  version: 1,
                  id: 'pantry-a',
                  name: 'A',
                  isDefault: false,
                },
              },
              {
                __typename: 'PantryEdge',
                node: {
                  __typename: 'Pantry',
                  version: 1,
                  id: 'pantry-b',
                  name: 'B',
                  isDefault: true,
                },
              },
            ],
          },
        },
      ];

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes,
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.setDefaultHome('home-2');
      });

      expect(selection()).toMatchObject({
        selectedHomeId: 'home-2',
        selectedPantryId: 'pantry-b',
      });
    });

    it('keeps the selection when the write is queued offline', async () => {
      // The mutation is local-first, so offline `queueLink` QUEUES it and
      // resolves with no payload and no error. That is not a refusal: the
      // change is already in the cache permanently and replays on reconnect,
      // so reverting it here would snap the user's choice back for no reason.
      selected('home-1', 'pantry-1');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [queuedMock().mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(true);
      expect(alertService.alert).not.toHaveBeenCalled();
      // Never rolled back to the previous home.
      expect(selection()).toEqual({
        selectedHomeId: 'home-2',
        selectedPantryId: 'pantry-3',
        isHomeSelectionReady: true,
      });
    });

    it('re-points the pantry to the new home when the write is queued offline', async () => {
      // Switching home must move the pantry with it. Left behind, the pantry
      // screen reads the previous home's pantry and every write made from it
      // is parented to the wrong home.
      selected('home-1', 'pantry-1');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [queuedMock().mock] },
      );

      await act(async () => {
        await result.current.setDefaultHome('home-2');
      });

      // home-2's default pantry, not home-1's.
      expect(selection()).toMatchObject({
        selectedHomeId: 'home-2',
        selectedPantryId: 'pantry-3',
      });
    });

    it('calls mutation and updates state on success', async () => {
      selected('home-1', 'pantry-1');
      const m = setDefaultMock('pantry-3');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: 'home-1',
          }),
        { operationMocks: [m.mock] },
      );

      // Closed while the switch is out, so no read fires on the outgoing id.
      const readiness: boolean[] = [];
      const stop = useStore.subscribe(state => {
        readiness.push(state.isHomeSelectionReady);
      });
      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });
      stop();

      expect(success!).toBe(true);
      expect(readiness).toContain(false);
      expect(selection()).toEqual({
        selectedHomeId: 'home-2',
        selectedPantryId: 'pantry-3',
        isHomeSelectionReady: true,
      });
    });

    it('rolls back on mutation failure', async () => {
      selected('home-1', 'pantry-1');

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [setDefaultErrorMock().mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
      expect(selection()).toEqual({
        selectedHomeId: 'home-1',
        selectedPantryId: 'pantry-1',
        isHomeSelectionReady: true,
      });
    });

    it('rolls back and says why when the server refuses', async () => {
      selected('home-1', 'pantry-1');
      const m = setDefaultFailureMock();

      const { result } = renderHookWithApollo(
        () =>
          useHomeSelection({
            homes: createHomes(),
            remoteDefaultHomeId: null,
          }),
        { operationMocks: [m.mock] },
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(false);
      expect(selection()).toMatchObject({
        selectedHomeId: 'home-1',
        selectedPantryId: 'pantry-1',
      });
      // A resolved error member doesn't throw, so it must be surfaced here
      // rather than swallowed. Its CODE selects the copy — never its message.
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Not Found',
        expect.any(String),
      );
      expect(alertService.alert).not.toHaveBeenCalledWith(
        expect.anything(),
        'Home not found',
      );
      // Reported too: `markAsDefault`'s fire-and-forget callers present nothing.
      expect(errorService.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          operation: operationNameOf(MarkHomeAsDefaultDocument),
        }),
      );
    });
  });

  it('exposes setSelectedHomeId and setSelectedPantryId', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeSelection({
        homes: [],
        remoteDefaultHomeId: null,
      }),
    );

    act(() => {
      result.current.setSelectedHomeId('home-2');
      result.current.setSelectedPantryId('pantry-3');
    });

    expect(selection()).toMatchObject({
      selectedHomeId: 'home-2',
      selectedPantryId: 'pantry-3',
    });
  });
});
