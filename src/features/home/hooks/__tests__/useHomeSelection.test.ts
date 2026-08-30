import { act } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { createMockHomeNode } from '#/test-utils/mockFactories';
import { useHomeSelection } from '../useHomeSelection';
import { useDefaultHomeSyncStore } from '#features/home/store/useDefaultHomeSyncStore';

const mockStoreState = {
  selectedHomeId: null as string | null,
  selectedPantryId: null as string | null,
  setSelectedHomeId: jest.fn(),
  setSelectedPantryId: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
};

// `setDefaultHome` snapshots the selection from the live store, not from its
// render closure — see the rollback comment there.
jest.mock('#store', () => ({
  useStore: {
    getState: () => mockStoreState,
  },
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector(mockStoreState as Partial<RootState> as RootState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useSelectedPantryId: jest.fn(() => mockStoreState.selectedPantryId),
  useSetSelectedPantryId: jest.fn(() => mockStoreState.setSelectedPantryId),
  useHomeState: jest.fn(() => ({
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
  useSetHomeAndPantry: jest.fn(() => mockStoreState.setHomeAndPantry),
  useSetIsHomeSelectionReady: jest.fn(
    () => mockStoreState.setIsHomeSelectionReady,
  ),
}));

jest.mock('#/services/errorService');

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

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

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
  useDefaultHomeSyncStore.getState().clearPending();
});

function setDefaultMock(defaultPantryId: string | null = null) {
  return recordMock(MarkHomeAsDefaultDocument, {
    data: {
      markHomeAsDefault: {
        __typename: 'MarkHomeAsDefaultPayload',
        settings: {
          __typename: 'UserSettings',
          id: 'settings-1',
        },
        defaultPantry: defaultPantryId
          ? { __typename: 'Pantry', id: defaultPantryId }
          : null,
      },
    },
  });
}

function setDefaultFailureMock() {
  return recordMock(MarkHomeAsDefaultDocument, {
    data: {
      markHomeAsDefault: {
        __typename: 'NotFoundError',
        // Stated, not left to SDL completion: completion pins the union member
        // from `__typename` but fills `code` deterministically with the first
        // `ErrorCode` value, which is not the refusal this test means. There is
        // no `HOME_NOT_FOUND` in the enum — only `NOT_FOUND`.
        code: ErrorCode.NotFound,
        message: 'Home not found',
      },
    },
  });
}

/**
 * What `queueLink` returns for a queued write: the payload field present but
 * null, and no error. `classifyCreateResult` reads that as `'queued'`.
 */
function queuedMock() {
  return recordMock(MarkHomeAsDefaultDocument, {
    data: { markHomeAsDefault: null },
    partial: true,
  });
}

function setDefaultErrorMock() {
  return recordMock(MarkHomeAsDefaultDocument, {
    error: new Error('Network error'),
  });
}

describe('useHomeSelection', () => {
  it('returns the selection', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeSelection({
        homes: createHomes(),
        remoteDefaultHomeId: 'home-1',
      }),
    );

    expect(result.current.selectedHomeId).toBeNull();
  });

  describe('setDefaultHome', () => {
    it('returns true early when home is already default both locally and remotely', async () => {
      mockStoreState.selectedHomeId = 'home-1';
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
      mockStoreState.selectedHomeId = 'home-1';
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
      expect(m.fired).toContainEqual({ input: { homeId: 'brand-new-home' } });
      expect(alertService.alert).not.toHaveBeenCalled();
      // No local record, so no pantry hint — the server's `defaultPantry` is
      // what lands the selection.
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'brand-new-home',
        null,
      );
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-9',
      );
    });

    it('pre-selects the default pantry from pantriesConnection', async () => {
      // `GetHomes` returns `pantriesConnection`, never a flat `pantries` array,
      // so reading only `pantries` cleared the pantry on every real switch.
      const m = setDefaultMock(); // server returns no defaultPantry
      const homes = [
        createMockHomeNode({ id: 'home-1', name: 'Home 1' }),
        {
          ...createMockHomeNode({ id: 'home-2', name: 'Home 2' }),
          pantries: undefined,
          pantriesConnection: {
            __typename: 'PantryConnection' as const,
            totalCount: 2,
            edges: [
              {
                __typename: 'PantryEdge' as const,
                node: {
                  __typename: 'Pantry' as const,
                  id: 'pantry-a',
                  name: 'A',
                  isDefault: false,
                },
              },
              {
                __typename: 'PantryEdge' as const,
                node: {
                  __typename: 'Pantry' as const,
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

      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'home-2',
        'pantry-b',
      );
    });

    it('keeps the selection when the write is queued offline', async () => {
      // The mutation is local-first, so offline `queueLink` QUEUES it and
      // resolves with no payload and no error. That is not a refusal: the
      // change is already in the cache permanently and replays on reconnect,
      // so reverting it here would snap the user's choice back for no reason.
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

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
      expect(mockStoreState.setHomeAndPantry).not.toHaveBeenCalledWith(
        'home-1',
        'pantry-1',
      );
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenLastCalledWith(
        true,
      );
    });

    it('calls mutation and updates state on success', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';
      const m = setDefaultMock('pantry-3');

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
        success = await result.current.setDefaultHome('home-2');
      });

      expect(success!).toBe(true);
      expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(
        false,
      );
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'home-2',
        'pantry-3',
      );
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-3',
      );
    });

    it('rolls back on mutation failure', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';

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
      expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
        'home-1',
        'pantry-1',
      );
    });

    it('rolls back when mutation returns success: false', async () => {
      mockStoreState.selectedHomeId = 'home-1';
      mockStoreState.selectedPantryId = 'pantry-1';
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
      // A resolved error member doesn't throw, so it must be surfaced here
      // rather than swallowed (the executeMutation onError only fires on a throw).
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Failed to set default home',
      );
      // The fallback above is what the MOCKED errorService returns; this is
      // what proves the server's code reached the resolver at all, so that the
      // real service maps it to `errors.codes.*` copy in production.
      expect(errorService.getUserFriendlyMessage).toHaveBeenCalledWith(
        ErrorCode.NotFound,
        'Failed to set default home',
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

    expect(result.current.setSelectedHomeId).toBe(
      mockStoreState.setSelectedHomeId,
    );
    expect(result.current.setSelectedPantryId).toBe(
      mockStoreState.setSelectedPantryId,
    );
  });
});
