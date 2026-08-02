import { act } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type {
  CreateOperationConfig,
  RemoveOperationConfig,
} from '#/hooks/utils/useCrudOperations';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateHomeDocument,
  UpdateHomeDocument,
} from '#operations/home/home.generated';
import { UpdateHomeOptimistic_HomeFragmentDoc } from '../useHomeMutations.generated';
import { alertService } from '#/services/alertService';
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
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Mutation error' })),
  }),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(() => false),
  getVersionConflictMessage: jest.fn(() => 'Version conflict'),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn(
    (conn?: { edges?: Array<{ node?: unknown } | null> | null } | null) =>
      conn?.edges ? conn.edges.map(e => e?.node).filter(Boolean) : [],
  ),
  getConnectionTotalCount: jest.fn(
    (conn?: { totalCount?: number | null } | null) => conn?.totalCount ?? 0,
  ),
}));

const mockCreateAddOperation = jest.fn(
  (config: CreateOperationConfig<unknown, unknown>) => {
    return async (input: unknown) => {
      const validation = config.validateInput?.(input);
      if (typeof validation === 'string') {
        alertService.alert('Validation Error', validation);
        return false;
      }
      const transformedInput = config.transformInput
        ? config.transformInput(input)
        : input;
      const result = await config.mutation({
        variables: { input: transformedInput },
      });
      if (result.data) {
        config.onSuccess?.(result.data);
        return result.data;
      }
      return false;
    };
  },
);

const mockCreateRemoveOperation = jest.fn(
  (config: RemoveOperationConfig<unknown>) => {
    return async () => {
      return new Promise(resolve => {
        alertService.alert(config.operationName ?? '', 'Confirm?', [
          { text: 'Cancel', onPress: () => resolve(false) },
          {
            text: 'Delete',
            onPress: async () => {
              const result = await config.mutation({
                variables: { id: config.itemId },
              });
              resolve(result?.data || false);
            },
          },
        ]);
      });
    };
  },
);

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createAddOperation: mockCreateAddOperation,
    createRemoveOperation: mockCreateRemoveOperation,
  }),
}));

jest.mock('../utils', () => ({
  addToHomesCache: jest.fn(),
  removeFromHomesCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

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

function updateHomeMock(home: { id: string; name?: string } | null) {
  return recordMock(UpdateHomeDocument, {
    data: {
      updateHome: home
        ? {
            __typename: 'UpdateHomePayload',
            home: { __typename: 'Home', id: home.id, name: home.name ?? null },
          }
        : {
            __typename: 'NotFoundError',
            message: 'Home not found',
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
    expect(typeof result.current.updateHome).toBe('function');
    expect(typeof result.current.deleteHome).toBe('function');
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
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

      expect(m.fired).toContainEqual({
        input: {
          name: 'My Home',
          createDefaultPantry: true,
          allowJoinCode: true,
        },
      });
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
          createDefaultPantry: false,
          allowJoinCode: false,
        });
      });

      expect(m.fired).toContainEqual({
        input: {
          name: 'Test',
          createDefaultPantry: false,
          allowJoinCode: false,
        },
      });
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

      expect(m.fired).toContainEqual({
        input: {
          name: 'My Home',
          createDefaultPantry: true,
          allowJoinCode: false,
        },
      });
    });

    it('shows validation error for empty name', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeMutations(createOptions()),
      );

      let returnValue!: Awaited<ReturnType<typeof result.current.createHome>>;
      await act(async () => {
        returnValue = await result.current.createHome('   ');
      });

      expect(returnValue).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Validation Error',
        'Please enter a home name',
      );
    });
  });

  describe('updateHome', () => {
    it('updates home name', async () => {
      const m = updateHomeMock({ id: 'home-1', name: 'Updated Name' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock] },
      );

      await act(async () => {
        await result.current.updateHome('home-1', { name: 'Updated Name' });
      });

      expect(m.fired).toContainEqual({
        input: { id: 'home-1', name: 'Updated Name' },
      });
    });

    it('handles isDefault update by calling setDefaultHome', async () => {
      const options = createOptions();
      const { result } = renderHookWithApollo(() => useHomeMutations(options));

      await act(async () => {
        await result.current.updateHome('home-2', { isDefault: true });
      });

      expect(options.setDefaultHome).toHaveBeenCalledWith('home-2');
    });

    it('returns false on mutation failure', async () => {
      const m = updateHomeMock(null);
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock] },
      );

      let returnValue!: Awaited<ReturnType<typeof result.current.updateHome>>;
      await act(async () => {
        returnValue = await result.current.updateHome('home-1', {
          name: 'Test',
        });
      });

      expect(returnValue).toBe(false);
    });

    it('returns true when only isDefault changes and no other updates', async () => {
      const options = createOptions();
      const m = updateHomeMock({ id: 'home-1' });
      const { result } = renderHookWithApollo(() => useHomeMutations(options), {
        operationMocks: [m.mock],
      });

      let returnValue!: Awaited<ReturnType<typeof result.current.updateHome>>;
      await act(async () => {
        returnValue = await result.current.updateHome('home-1', {
          isDefault: true,
        });
      });

      expect(returnValue).toBe(true);
      expect(m.fired).toEqual([]);
    });

    it('optimistically updates the cached home before the server responds', async () => {
      const cache = seedCache([
        {
          __typename: 'Home',
          id: 'home-1',
          name: 'Old Name',
          allowJoinCode: false,
          joinCode: null,
          version: 1,
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ]);
      const m = updateHomeMock({ id: 'home-1', name: 'New Name' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock], cache },
      );

      let pending: Promise<unknown> | undefined;
      act(() => {
        pending = result.current.updateHome('home-1', { name: 'New Name' });
      });

      // The optimistic response is written synchronously from the cached home,
      // before the server resolves. Read the optimistic layer explicitly.
      const optimistic = cache.readFragment(
        {
          id: cache.identify({ __typename: 'Home', id: 'home-1' }),
          fragment: UpdateHomeOptimistic_HomeFragmentDoc,
        },
        true,
      );
      expect(optimistic?.name).toBe('New Name');

      await act(async () => {
        await pending;
      });
    });

    it('skips the optimistic update when enabling a join code', async () => {
      const cache = seedCache([
        {
          __typename: 'Home',
          id: 'home-1',
          name: 'Home',
          allowJoinCode: false,
          joinCode: null,
          version: 1,
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      ]);
      const m = updateHomeMock({ id: 'home-1', name: 'Home' });
      const { result } = renderHookWithApollo(
        () => useHomeMutations(createOptions()),
        { operationMocks: [m.mock], cache },
      );

      let pending: Promise<unknown> | undefined;
      act(() => {
        pending = result.current.updateHome('home-1', { allowJoinCode: true });
      });

      // The server mints the join code, so there is no optimistic write —
      // allowJoinCode stays at its cached value until the server responds.
      const optimistic = cache.readFragment(
        {
          id: cache.identify({ __typename: 'Home', id: 'home-1' }),
          fragment: UpdateHomeOptimistic_HomeFragmentDoc,
        },
        true,
      );
      expect(optimistic?.allowJoinCode).toBe(false);

      await act(async () => {
        await pending;
      });
    });
  });

  describe('deleteHome', () => {
    it('calls deleteHomeMutation with confirmation dialog', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeMutations(createOptions()),
      );

      act(() => {
        result.current.deleteHome('home-2', 'Home 2');
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Home',
        expect.any(String),
        expect.any(Array),
      );
    });
  });
});
