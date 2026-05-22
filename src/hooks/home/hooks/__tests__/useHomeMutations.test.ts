import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  CreateHomeDocument,
  UpdateHomeDocument,
} from '#operations/home/home.generated';
import { alertService } from '#/services/alertService';
import { useHomeMutations } from '../useHomeMutations';

const mockStoreState = {
  selectedHomeId: 'home-1' as string | null,
  setSelectedHomeId: jest.fn(),
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) => selector(mockStoreState),
  useSelectedHomeId: jest.fn(() => mockStoreState.selectedHomeId),
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

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((item, updates) => ({ ...item, ...updates })),
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn((conn: any) =>
    conn?.edges ? conn.edges.map((e: any) => e?.node).filter(Boolean) : [],
  ),
  getConnectionTotalCount: jest.fn((conn: any) => conn?.totalCount ?? 0),
}));

const mockCreateAddOperation = jest.fn((config: any) => {
  return async (input: any) => {
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
});

const mockCreateRemoveOperation = jest.fn((config: any) => {
  return async () => {
    return new Promise(resolve => {
      alertService.alert(config.operationName, 'Confirm?', [
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
});

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
  homes: [
    {
      id: 'home-1',
      name: 'Home 1',
      pantries: [{ id: 'p-1', isDefault: true }],
    },
    { id: 'home-2', name: 'Home 2', pantries: [] },
  ],
  refetch: jest.fn().mockResolvedValue(undefined),
  setDefaultHome: jest.fn().mockResolvedValue(true),
  setSelectedPantryId: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.selectedHomeId = 'home-1';
});

function createHomeMock(home: { id: string; name: string }) {
  return recordMock(CreateHomeDocument, {
    data: {
      createHome: {
        __typename: 'CreateHomeSuccess',
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
            __typename: 'UpdateHomeSuccess',
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

    it('shows validation error for empty name', async () => {
      const { result } = renderHookWithApollo(() =>
        useHomeMutations(createOptions()),
      );

      let returnValue: any;
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

      let returnValue: any;
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

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.updateHome('home-1', {
          isDefault: true,
        });
      });

      expect(returnValue).toBe(true);
      expect(m.fired).toEqual([]);
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
