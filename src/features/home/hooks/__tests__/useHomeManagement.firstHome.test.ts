/**
 * The user's FIRST home becomes the selection with no `MarkHomeAsDefault` and no
 * alert: `createHome` and `joinHomeByCode` make it the account default on the
 * server. Composes the REAL hooks through `useHomeManagement`, since each
 * sub-hook's own suite injects its collaborators.
 */
import { act, waitFor } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
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
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import { alertService } from '#/services/alertService';
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
  // The create writes the creator's own membership, so it reads the identity.
  useUser: jest.fn(() => ({
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'Tani',
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

/**
 * The server echoes the id the CLIENT minted — that is what makes the create
 * idempotent, and a mock returning a different one would look like a second
 * home to every reader.
 */
const createdHomeMock = () =>
  recordMock(CreateHomeDocument, {
    dataFor: (
      vars: Record<string, unknown>,
    ): MockDataFor<typeof CreateHomeDocument> => ({
      createHome: {
        __typename: 'CreateHomePayload',
        home: {
          __typename: 'Home',
          id: (vars.input as { id: string }).id,
          name: 'First Home',
          // `createHome` makes a first home the account default on the server.
          isDefault: true,
          // Empty: the selected pantry is the client-minted one, read from the
          // cache before its own request settles.
          pantriesConnection: {
            __typename: 'PantryConnection',
            edges: [],
            totalCount: 0,
          },
        },
      },
    }),
  });

/** Creating a home also mints its default pantry, whose failure is alerted. */
const createdPantryMock = () =>
  recordMock(CreatePantryDocument, {
    dataFor: (
      vars: Record<string, unknown>,
    ): MockDataFor<typeof CreatePantryDocument> => {
      const input = vars.input as { id: string; homeId: string };
      return {
        createPantry: {
          __typename: 'CreatePantryPayload',
          pantry: {
            __typename: 'Pantry',
            id: input.id,
            homeId: input.homeId,
          },
        },
      };
    },
  });

/** Records whether `MarkHomeAsDefault` is sent; neither path should send it. */
const markDefaultMock = () =>
  recordMock(MarkHomeAsDefaultDocument, {
    error: new Error('MarkHomeAsDefault must not be sent'),
  });

/** Joining returns Membership only; the joined home is fetched afterwards. */
const joinedHomeMock = () =>
  recordMock(JoinHomeByCodeDocument, {
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

describe('first home becomes the default', () => {
  it('adopts a newly created first home without MarkHomeAsDefault, and with no alert', async () => {
    const homes = noHomesMock();
    const create = createdHomeMock();
    const markDefault = markDefaultMock();

    const { result } = renderHookWithApollo(() => useHomeManagement(), {
      operationMocks: [
        homes.mock,
        create.mock,
        createdPantryMock().mock,
        markDefault.mock,
      ],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createHome('First Home');
    });

    const mintedId = (create.fired[0] as { input: { id: string } }).input.id;
    expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(mintedId);
    // The client-minted default pantry, adopted from the cache.
    expect(mockStoreState.setSelectedPantryId).toHaveBeenCalledWith(
      expect.any(String),
    );
    expect(markDefault.fired).toEqual([]);
    // Written ONLY by `setDefaultHome`, so this proves the create never reached it.
    expect(mockStoreState.setHomeAndPantry).not.toHaveBeenCalled();
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('selects a joined first home without MarkHomeAsDefault', async () => {
    const homes = noHomesMock();
    const markDefault = markDefaultMock();

    const { result } = renderHookWithApollo(() => useHomeManagement(), {
      operationMocks: [homes.mock, joinedHomeMock().mock, markDefault.mock],
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.joinHomeByCode('ABC123');
    });

    expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(
      'home-joined',
    );
    expect(markDefault.fired).toEqual([]);
    expect(mockStoreState.setHomeAndPantry).not.toHaveBeenCalled();
    // The join alerts its SUCCESS, so this is scoped rather than a blanket
    // not-called.
    expect(alertService.alert).not.toHaveBeenCalledWith(
      'Error',
      expect.anything(),
    );
  });
});
