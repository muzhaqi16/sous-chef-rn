import { act } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type {
  CreateOperationConfig,
  RemoveOperationConfig,
} from '#/hooks/utils/useCrudOperations';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreateHomeDocument } from '#operations/home/home.generated';
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

jest.mock('#/services/errorService');

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

describe('useHomeMutations', () => {
  it('returns mutation functions and loading states', () => {
    const { result } = renderHookWithApollo(() =>
      useHomeMutations(createOptions()),
    );

    expect(typeof result.current.createHome).toBe('function');
    expect(typeof result.current.deleteHome).toBe('function');
    expect(result.current.creating).toBe(false);
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
        'Home name cannot be empty',
      );
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
