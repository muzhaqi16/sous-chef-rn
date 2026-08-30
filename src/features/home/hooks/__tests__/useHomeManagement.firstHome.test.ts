/**
 * Regression: creating — or joining — the user's FIRST home must sync it as the
 * server-side default, with no alert.
 *
 * The defect lived in the SEAM between two hooks, which is why every existing
 * suite was blind to it: `useHomeMutations.test.ts` and
 * `useHomeInvitations.test.ts` both inject
 * `setDefaultHome: jest.fn().mockResolvedValue(true)`, and
 * `useHomeManagement.test.ts` mocks all four sub-hooks. A mutation's
 * `onCompleted` runs in the same task as its cache write, BEFORE React
 * re-renders, so `useHomeSelection`'s `homes` PROP is still the pre-create
 * (empty) list — any existence check against that prop misses the very home
 * that was just created, aborting the switch before `MarkHomeAsDefault` fires
 * and alerting "Home not found" for a home that exists.
 *
 * So this composes the REAL hooks through `useHomeManagement`.
 */
import { act, waitFor } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateHomeDocument,
  GetHomesDocument,
  JoinHomeByCodeDocument,
} from '#operations/home/home.generated';
import { MarkHomeAsDefaultDocument } from '#operations/home/userSettings.generated';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useHomeManagement } from '../useHomeManagement';

const mockStoreState = {
  selectedHomeId: null as string | null,
  selectedPantryId: null as string | null,
  hasUnverifiedEmail: false,
  // Stateful on purpose: `useHomeSelection`'s auto-select effect is gated on
  // `!selectedHomeId`, and `onCompleted` sets it before calling
  // `setDefaultHome`. A jest.fn that dropped the write would leave that effect
  // free to fire the same mutation, and the assertions below could not tell the
  // two routes apart.
  setSelectedHomeId: jest.fn((id: string | null) => {
    mockStoreState.selectedHomeId = id;
  }),
  setSelectedPantryId: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector(mockStoreState as Partial<RootState> as RootState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useSelectedPantryId: jest.fn(() => mockStoreState.selectedPantryId),
  useSetSelectedPantryId: jest.fn(() => mockStoreState.setSelectedPantryId),
  useSetHomeAndPantry: jest.fn(() => mockStoreState.setHomeAndPantry),
  useSetIsHomeSelectionReady: jest.fn(
    () => mockStoreState.setIsHomeSelectionReady,
  ),
  useHasUnverifiedEmail: jest.fn(() => mockStoreState.hasUnverifiedEmail),
  useHomeState: jest.fn(() => ({
    selectedHomeId: mockStoreState.selectedHomeId,
    setSelectedHomeId: mockStoreState.setSelectedHomeId,
  })),
}));

jest.mock('#/services/errorService');
jest.mock('#/utils/finallyHelpers');
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = null;
  mockStoreState.selectedPantryId = null;
});

/** A user with no homes at all. */
const noHomesMock = () =>
  recordMock(GetHomesDocument, {
    data: {
      homes: {
        __typename: 'HomeConnection',
        edges: [],
        totalCount: 0,
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
      },
    },
  });

const markDefaultMock = (defaultPantryId: string) =>
  recordMock(MarkHomeAsDefaultDocument, {
    data: {
      markHomeAsDefault: {
        __typename: 'MarkHomeAsDefaultPayload',
        settings: { __typename: 'UserSettings', id: 'settings-1' },
        defaultPantry: { __typename: 'Pantry', id: defaultPantryId },
      },
    },
  });

const markDefaultRefusedMock = () =>
  recordMock(MarkHomeAsDefaultDocument, {
    data: {
      markHomeAsDefault: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'Home not found',
      },
    },
  });

describe('first home becomes the default', () => {
  it('reports a refused sync, since nothing else can', async () => {
    // A new user left with no default home is invisible otherwise: the
    // surviving log call is stripped in release and never reaches errorService.
    const homes = noHomesMock();
    const create = recordMock(CreateHomeDocument, {
      data: {
        createHome: {
          __typename: 'CreateHomePayload',
          home: {
            __typename: 'Home',
            id: 'home-new',
            name: 'First Home',
            isDefault: false,
            pantriesConnection: {
              __typename: 'PantryConnection',
              edges: [],
              totalCount: 0,
            },
          },
        },
      },
    });
    const markDefault = markDefaultRefusedMock();

    const { result } = renderHookWithApollo(() => useHomeManagement(), {
      operationMocks: [homes.mock, create.mock, markDefault.mock],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createHome('First Home');
    });

    await waitFor(() =>
      expect(errorService.reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ operation: 'Set First Home as Default' }),
      ),
    );
  });

  it('syncs a newly created first home to the server, with no alert', async () => {
    const homes = noHomesMock();
    const create = recordMock(CreateHomeDocument, {
      data: {
        createHome: {
          __typename: 'CreateHomePayload',
          home: {
            __typename: 'Home',
            id: 'home-new',
            name: 'First Home',
            // Not default server-side yet — that is what MarkHomeAsDefault is
            // for, and it keeps `remoteDefaultHomeId` honest.
            isDefault: false,
            // Empty so the only writer of the pantry selection is the
            // MarkHomeAsDefault response, not createHome's own onCompleted.
            pantriesConnection: {
              __typename: 'PantryConnection',
              edges: [],
              totalCount: 0,
            },
          },
        },
      },
    });
    const markDefault = markDefaultMock('pantry-new');

    const { result } = renderHookWithApollo(() => useHomeManagement(), {
      operationMocks: [homes.mock, create.mock, markDefault.mock],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createHome('First Home');
    });

    // `setDefaultHome` is fire-and-forget from createHome's onCompleted, so
    // wait on its LAST effect rather than on the mutation firing — `fired`
    // records the invocation, not the resolved result, and asserting on it
    // would both race and leak the pending promise into the next test.
    await waitFor(() =>
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-new',
      ),
    );
    expect(markDefault.fired).toContainEqual({ input: { homeId: 'home-new' } });

    // `setHomeAndPantry` / `setIsHomeSelectionReady` are written ONLY by
    // `setDefaultHome` — the auto-select effect fires the mutation directly and
    // touches neither. Asserting on them is what stops this test passing via
    // that effect rather than via the path it means to cover.
    expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
      'home-new',
      null,
    );
    expect(mockStoreState.setIsHomeSelectionReady).toHaveBeenCalledWith(false);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('syncs a joined first home that is in neither the prop nor the cache', async () => {
    // `JoinHomeByCode` returns Membership only and its `update` kicks off an
    // un-awaited refetch, so the joined home exists nowhere locally when
    // `setDefaultHome` runs. A cache-based fallback alone would not fix this.
    const homes = noHomesMock();
    const join = recordMock(JoinHomeByCodeDocument, {
      data: {
        joinHomeByCode: {
          __typename: 'JoinHomeByCodePayload',
          membership: {
            __typename: 'Membership',
            id: 'membership-1',
            homeId: 'home-joined',
          },
        },
      },
    });
    const markDefault = markDefaultMock('pantry-joined');

    const { result } = renderHookWithApollo(() => useHomeManagement(), {
      operationMocks: [homes.mock, join.mock, markDefault.mock],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.joinHomeByCode('ABC123');
    });

    await waitFor(() =>
      expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-joined',
      ),
    );
    expect(markDefault.fired).toContainEqual({
      input: { homeId: 'home-joined' },
    });
    expect(mockStoreState.setHomeAndPantry).toHaveBeenCalledWith(
      'home-joined',
      null,
    );
    // joinHomeByCode's onCompleted alerts SUCCESS, so this is scoped rather
    // than a blanket not-called.
    expect(alertService.alert).not.toHaveBeenCalledWith(
      'Error',
      'Home not found',
    );
  });
});
