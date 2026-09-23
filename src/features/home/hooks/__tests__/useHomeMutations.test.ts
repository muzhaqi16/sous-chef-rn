import { act, waitFor } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateHomeDocument,
  DeleteHomeDocument,
} from '#operations/home/home.generated';
import { CreatePantryDocument } from '#features/pantry/graphql/pantry.generated';
import { alertService } from '#/services/alertService';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';
import { removeFromHomesCache } from '../homeCacheUpdaters';
import type { MockFor } from '#/test-utils/apolloMockProvider';
import { useHomeMutations } from '../useHomeMutations';

const mockStoreState = {
  selectedHomeId: 'home-1' as string | null,
  setSelectedHomeId: jest.fn(),
};

let mockHasUnverifiedEmail = false;

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: Partial<RootState>) => unknown) =>
    selector(mockStoreState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
  useHasUnverifiedEmail: jest.fn(() => mockHasUnverifiedEmail),
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

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(
    (conn?: { edges?: Array<{ node?: unknown } | null> | null } | null) =>
      conn?.edges ? conn.edges.map(e => e?.node).filter(Boolean) : [],
  ),
  getConnectionTotalCount: jest.fn(
    (conn?: { totalCount?: number | null } | null) => conn?.totalCount ?? 0,
  ),
}));

jest.mock('../homeCacheUpdaters', () => ({
  addToHomesCache: jest.fn(),
  removeFromHomesCache: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createOptions = () => ({
  refetch: jest.fn().mockResolvedValue(undefined),
  setDefaultHome: jest.fn().mockResolvedValue(true),
  setSelectedPantryId: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = 'home-1';
  mockHasUnverifiedEmail = false;
});

function createHomeMock(home: { id: string; name: string }) {
  return recordMock(CreateHomeDocument, {
    data: {
      createHome: {
        __typename: 'CreateHomePayload',
        home: { __typename: 'Home', id: home.id, name: home.name },
      },
    },
  });
}

function createPantryMock(pantry: { id: string; homeId: string }) {
  return recordMock(CreatePantryDocument, {
    data: {
      createPantry: {
        __typename: 'CreatePantryPayload',
        pantry: {
          __typename: 'Pantry',
          id: pantry.id,
          homeId: pantry.homeId,
        },
      },
    },
  });
}

describe('useHomeMutations', () => {
  it('returns mutation functions and loading states', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeMutations(createOptions()),
    );

    expect(typeof result.current.createHome).toBe('function');
    expect(typeof result.current.deleteHome).toBe('function');
    expect(result.current.creating).toBe(false);
  });

  describe('createHome', () => {
    it('creates home with string name', async () => {
      const m = createHomeMock({ id: 'new-home', name: 'My Home' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.createHome('My Home');
      });

      // The id is minted here, and the default pantry is asked for OFF — a
      // server-minted pantry id is one no offline pantry write could name.
      expect(m.fired[0]).toMatchObject({
        input: {
          name: 'My Home',
          allowJoinCode: true,
          createDefaultPantry: false,
        },
      });
      expect((m.fired[0] as { input: { id?: string } }).input.id).toBeTruthy();
    });

    it('creates home with options object', async () => {
      const m = createHomeMock({ id: 'new-home', name: 'Test' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.createHome({
          name: 'Test',
          allowJoinCode: false,
        });
      });

      expect(m.fired[0]).toMatchObject({
        input: { name: 'Test', allowJoinCode: false },
      });
    });

    it('mints the new home a default pantry, since the create asks for none', async () => {
      // `createDefaultPantry` is forced off, so without this second write a
      // home made here would have no pantry for any later write to name.
      const home = createHomeMock({ id: 'new-home', name: 'My Home' });
      const pantry = createPantryMock({ id: 'new-pantry', homeId: 'new-home' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [home.mock, pantry.mock] },
      );

      await act(async () => {
        await result.current.createHome('My Home');
      });

      expect(pantry.fired[0]).toMatchObject({
        input: { name: 'Kitchen Pantry', isDefault: true },
      });
      const pantryInput = (pantry.fired[0] as { input: { homeId: string } })
        .input;
      const homeInput = (home.fired[0] as { input: { id: string } }).input;
      expect(pantryInput.homeId).toBe(homeInput.id);
    });

    it('stays creating until the default pantry has settled', async () => {
      // The home resolves at once; the pantry's request is held open. The
      // submit control reads `creating`, so a second tap during that window
      // must find it disabled — a duplicate home is what it would create.
      const home = createHomeMock({ id: 'new-home', name: 'My Home' });
      const pantry = createPantryMock({ id: 'new-pantry', homeId: 'new-home' });
      pantry.mock.delay = 200;
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [home.mock, pantry.mock] },
      );

      let settled = false;
      await act(async () => {
        void result.current.createHome('My Home').then(() => {
          settled = true;
        });
        await Promise.resolve();
      });
      await waitFor(() => expect(home.fired).toHaveLength(1));
      expect(settled).toBe(false);
      expect(result.current.creating).toBe(true);

      // `settled` flips in a microtask; `result.current` only after React's
      // re-render and passive effect, so the flag is awaited, not read after.
      await waitFor(() => {
        expect(settled).toBe(true);
        expect(result.current.creating).toBe(false);
      });
    });

    it('reports a refused default pantry and keeps the home', async () => {
      // A refusal resolves as a union member; it never throws, so a `catch`
      // around the create sees nothing and the user would learn of the missing
      // pantry only from an empty pantry tab.
      const home = createHomeMock({ id: 'new-home', name: 'My Home' });
      const refused = recordMock(CreatePantryDocument, {
        data: {
          createPantry: {
            __typename: 'ForbiddenError',
            message: 'Pantries are capped on this plan',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [home.mock, refused.mock] },
      );

      let created: boolean | undefined;
      await act(async () => {
        created = await result.current.createHome('My Home');
      });

      expect(created).toBe(true);
      expect(refused.fired).toHaveLength(1);
      // The caller's LOCALIZED copy, never the server's English message.
      expect(alertService.alert).toHaveBeenCalledWith(
        expect.any(String),
        'Failed to create pantry',
      );
    });

    it('creates the home without a join code when the email is unverified', async () => {
      // The server refuses createHome outright for allowJoinCode: true from an
      // unverified caller, so requesting one would fail the whole creation.
      mockHasUnverifiedEmail = true;
      const m = createHomeMock({ id: 'new-home', name: 'My Home' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.createHome('My Home');
      });

      expect(m.fired[0]).toMatchObject({
        input: { name: 'My Home', allowJoinCode: false },
      });
    });
  });

  describe('deleteHome', () => {
    it('calls deleteHomeMutation with confirmation dialog', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeMutations(createOptions()),
      );

      act(() => {
        void result.current.deleteHome('home-2', 'Home 2');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Home',
        expect.any(String),
        expect.any(Array),
      );
    });

    // The mutation's own `onError` alerted beside the removal builder, which
    // settles and alerts the same failure: one failure, two dialogs.
    it('alerts a failed delete once', async () => {
      const failed = recordMock(DeleteHomeDocument, {
        error: new Error('Network error'),
      });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [failed.mock] },
      );

      let deleted: Promise<unknown> | undefined;
      act(() => {
        deleted = result.current.deleteHome('home-2', 'Home 2');
      });
      const confirm = (alertService.alert as jest.Mock).mock.lastCall?.[2] as
        | Array<{ style?: string; onPress?: () => unknown }>
        | undefined;
      await act(async () => {
        await confirm?.find(b => b.style === 'destructive')?.onPress?.();
      });

      await expect(deleted).resolves.toBe(false);
      // The confirmation, then exactly one failure.
      expect(alertService.alert).toHaveBeenCalledTimes(2);
    });

    it('moves the selection off a selected home the server says is already gone', async () => {
      const gone = recordMock(DeleteHomeDocument, {
        data: {
          deleteHome: { __typename: 'NotFoundError', code: ErrorCode.NotFound },
        },
      });
      const options = createOptions();
      const { result } = renderHookWithApollo(() => useHomeMutations(options), {
        operationMocks: [gone.mock],
      });

      let deleted: Promise<unknown> | undefined;
      act(() => {
        deleted = result.current.deleteHome('home-1', 'Home 1');
      });
      const confirm = (alertService.alert as jest.Mock).mock.lastCall?.[2] as
        | Array<{ style?: string; onPress?: () => unknown }>
        | undefined;
      await act(async () => {
        await confirm?.find(b => b.style === 'destructive')?.onPress?.();
      });

      await expect(deleted).resolves.toBeTruthy();
      expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(null);
      expect(options.setSelectedPantryId).toHaveBeenCalledWith(null);
    });

    // RESOURCE_NOT_FOUND arrives as a top-level error with no payload, so no
    // `update` can read it — the removal still has to take the card away.
    it('removes a home the server says is gone with a top-level code', async () => {
      const actual: typeof import('#/services/errorService') =
        jest.requireActual('#/services/errorService');
      jest
        .mocked(errorService.parseApolloError)
        .mockImplementation((...args) =>
          actual.errorService.parseApolloError(...args),
        );
      const gone: MockFor<typeof DeleteHomeDocument> = {
        request: { query: DeleteHomeDocument, variables: () => true },
        result: {
          data: null,
          errors: [
            {
              message: 'gone',
              extensions: { code: TopLevelErrorCode.ResourceNotFound },
            },
          ],
        },
      };
      const options = createOptions();
      const { result } = renderHookWithApollo(() => useHomeMutations(options), {
        operationMocks: [gone],
      });

      act(() => {
        void result.current.deleteHome('home-1', 'Home 1');
      });
      const confirm = (alertService.alert as jest.Mock).mock.lastCall?.[2] as
        | Array<{ style?: string; onPress?: () => unknown }>
        | undefined;
      await act(async () => {
        await confirm?.find(b => b.style === 'destructive')?.onPress?.();
      });

      await waitFor(() =>
        expect(removeFromHomesCache).toHaveBeenCalledWith(
          expect.anything(),
          'home-1',
          { evictItem: true },
        ),
      );
      expect(mockStoreState.setSelectedHomeId).toHaveBeenCalledWith(null);
      // The confirmation only: a converged removal says nothing more.
      expect(alertService.alert).toHaveBeenCalledTimes(1);
    });
  });
});
