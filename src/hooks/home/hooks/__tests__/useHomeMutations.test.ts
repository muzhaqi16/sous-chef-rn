import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { useHomeMutations } from '../useHomeMutations';

const mockCreateHomeMutation = jest.fn();
const mockUpdateHomeMutation = jest.fn();
const mockDeleteHomeMutation = jest.fn();
const mockApolloClient = {
  cache: {
    readQuery: jest.fn(() => null),
  },
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useCreateHomeMutation: jest.fn(() => [
    mockCreateHomeMutation,
    { loading: false, client: mockApolloClient },
  ]),
  useUpdateHomeMutation: jest.fn(() => [
    mockUpdateHomeMutation,
    { loading: false },
  ]),
  useDeleteHomeMutation: jest.fn(() => [
    mockDeleteHomeMutation,
    { loading: false, client: mockApolloClient },
  ]),
}));

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
  normalizeHome: jest.fn((home: any) => home),
}));

// mockCreateAddOperation and mockCreateRemoveOperation capture config for assertions
const mockCreateAddOperation = jest.fn((config: any) => {
  return async (input: any) => {
    const {
      alertService: mockAlertService,
    } = require('#/services/alertService');
    const validation = config.validateInput?.(input);
    if (typeof validation === 'string') {
      mockAlertService.alert('Validation Error', validation);
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
    const {
      alertService: mockAlertService,
    } = require('#/services/alertService');
    return new Promise(resolve => {
      mockAlertService.alert(config.operationName, 'Confirm?', [
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

describe('useHomeMutations', () => {
  it('returns mutation functions and loading states', () => {
    const { result } = renderHook(() => useHomeMutations(createOptions()));

    expect(typeof result.current.createHome).toBe('function');
    expect(typeof result.current.updateHome).toBe('function');
    expect(typeof result.current.deleteHome).toBe('function');
    expect(result.current.creating).toBe(false);
    expect(result.current.updating).toBe(false);
    expect(result.current.deleting).toBe(false);
  });

  describe('createHome', () => {
    it('creates home with string name', async () => {
      mockCreateHomeMutation.mockResolvedValue({
        data: {
          createHome: {
            home: { id: 'new-home', name: 'My Home', pantries: [] },
          },
        },
      });

      const { result } = renderHook(() => useHomeMutations(createOptions()));

      await act(async () => {
        await result.current.createHome('My Home');
      });

      expect(mockCreateHomeMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            name: 'My Home',
            createDefaultPantry: true,
            allowJoinCode: true,
          },
        },
      });
    });

    it('creates home with options object', async () => {
      mockCreateHomeMutation.mockResolvedValue({
        data: { createHome: { home: { id: 'new-home', name: 'Test' } } },
      });

      const { result } = renderHook(() => useHomeMutations(createOptions()));

      await act(async () => {
        await result.current.createHome({
          name: 'Test',
          createDefaultPantry: false,
          allowJoinCode: false,
        });
      });

      expect(mockCreateHomeMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            name: 'Test',
            createDefaultPantry: false,
            allowJoinCode: false,
          },
        },
      });
    });

    it('shows validation error for empty name', async () => {
      const { result } = renderHook(() => useHomeMutations(createOptions()));

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
      mockUpdateHomeMutation.mockResolvedValue({
        data: {
          updateHome: { home: { id: 'home-1', name: 'Updated Name' } },
        },
      });

      const { result } = renderHook(() => useHomeMutations(createOptions()));

      await act(async () => {
        await result.current.updateHome('home-1', { name: 'Updated Name' });
      });

      expect(mockUpdateHomeMutation).toHaveBeenCalledWith({
        variables: {
          id: 'home-1',
          input: { name: 'Updated Name' },
        },
      });
    });

    it('handles isDefault update by calling setDefaultHome', async () => {
      const options = createOptions();

      const { result } = renderHook(() => useHomeMutations(options));

      await act(async () => {
        await result.current.updateHome('home-2', { isDefault: true });
      });

      expect(options.setDefaultHome).toHaveBeenCalledWith('home-2');
    });

    it('returns true when only isDefault changes and no other updates', async () => {
      const options = createOptions();

      const { result } = renderHook(() => useHomeMutations(options));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.updateHome('home-1', {
          isDefault: true,
        });
      });

      expect(returnValue).toBe(true);
      expect(mockUpdateHomeMutation).not.toHaveBeenCalled();
    });

    it('returns false on mutation failure', async () => {
      mockUpdateHomeMutation.mockResolvedValue({
        data: { updateHome: { home: null } },
      });

      const { result } = renderHook(() => useHomeMutations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.updateHome('home-1', {
          name: 'Test',
        });
      });

      expect(returnValue).toBe(false);
    });
  });

  describe('deleteHome', () => {
    it('calls deleteHomeMutation with confirmation dialog', async () => {
      const { result } = renderHook(() => useHomeMutations(createOptions()));

      // This triggers alertService.alert with confirmation
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
