'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePantryItemMutations } from '../usePantryItemMutations';

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

const mockCreatePantryItem = jest.fn();
const mockUpdatePantryItem = jest.fn();
const mockDeletePantryItem = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreatePantryItem') return [mockCreatePantryItem, {}];
    if (opName === 'UpdatePantryItem') return [mockUpdatePantryItem, {}];
    if (opName === 'DeletePantryItem') return [mockDeletePantryItem, {}];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn().mockReturnValue({ message: 'Error' }),
  }),
}));

jest.mock('#/utils/generateId', () => ({
  generateId: () => 'mock-id',
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  enhanceWithVersion: jest.fn((obj: any, updates: any) => ({
    ...obj,
    ...updates,
  })),
  createOptimisticEntity: jest.fn(
    (typename: string, id: string, fields: any) => ({
      __typename: typename,
      id,
      ...fields,
    }),
  ),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn().mockReturnValue(false),
  getVersionConflictMessage: jest.fn().mockReturnValue('Conflict message'),
}));

jest.mock('#/hooks/utils/useCrudOperations', () => ({
  useCrudOperations: () => ({
    createAddOperation: jest.fn((config: any) => async (input: any) => {
      const transformed = config.transformInput(input);
      await config.mutation({ variables: { input: transformed } });
    }),
    createUpdateOperation: jest.fn((config: any) => async (updates: any) => {
      await config.mutation({
        variables: { id: config.itemId, input: updates },
      });
    }),
  }),
}));

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerPendingDelete: jest.fn(),
    unregisterPendingDelete: jest.fn(),
  },
}));

jest.mock('../utils', () => ({
  addToPantryItemsCache: jest.fn(),
  removeFromPantryItemsCache: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const defaultOptions = {
  pantryId: 'pantry-1',
  pantryItems: [
    {
      id: 'item-1',
      itemName: 'Milk',
      version: 1,
      updatedAt: '2024-01-01',
    } as any,
  ],
  refetch: jest.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryItemMutations', () => {
  it('returns addItem, updateItem, and removeItem', () => {
    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    expect(typeof result.current.addItem).toBe('function');
    expect(typeof result.current.updateItem).toBe('function');
    expect(typeof result.current.removeItem).toBe('function');
  });

  it('removeItem registers pending delete before mutation', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    mockDeletePantryItem.mockResolvedValue({
      data: { deletePantryItem: { pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(subscriptionService.registerPendingDelete).toHaveBeenCalledWith(
      'item-1',
      'pantry-1',
      'PantryItem',
      'Pantry',
      'itemsConnection',
    );
  });

  it('removeItem unregisters pending delete after success', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    mockDeletePantryItem.mockResolvedValue({
      data: { deletePantryItem: { pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(subscriptionService.unregisterPendingDelete).toHaveBeenCalledWith(
      'item-1',
    );
  });

  it('removeItem does nothing when pantryId is undefined', async () => {
    const { result } = renderHook(() =>
      usePantryItemMutations({ ...defaultOptions, pantryId: undefined }),
    );

    await act(async () => {
      await result.current.removeItem('item-1');
    });

    expect(mockDeletePantryItem).not.toHaveBeenCalled();
  });

  it('removeItem unregisters pending delete on error', async () => {
    const {
      subscriptionService,
    } = require('#/services/subscriptions/SubscriptionService');
    mockDeletePantryItem.mockRejectedValue(new Error('Delete failed'));

    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    await act(async () => {
      try {
        await result.current.removeItem('item-1');
      } catch {
        // Expected - removeItem re-throws the error
      }
    });

    expect(subscriptionService.unregisterPendingDelete).toHaveBeenCalledWith(
      'item-1',
    );
  });

  it('updateItem calls the update mutation via createUpdateOperation', async () => {
    mockUpdatePantryItem.mockResolvedValue({
      data: { updatePantryItem: { pantryItem: { id: 'item-1' } } },
    });

    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    await act(async () => {
      await result.current.updateItem('item-1', {
        itemName: 'Updated Milk',
      } as any);
    });

    // The createUpdateOperation mock calls mutation directly
    expect(mockUpdatePantryItem).toHaveBeenCalled();
  });

  it('addItem calls createAddOperation with transformed input', async () => {
    mockCreatePantryItem.mockResolvedValue({
      data: { createPantryItem: { pantryItem: { id: 'new-1' } } },
    });

    const { result } = renderHook(() => usePantryItemMutations(defaultOptions));

    await act(async () => {
      await result.current.addItem({
        itemName: 'Bread',
        quantity: 2,
        storageState: 'FRESH' as any,
      } as any);
    });

    expect(mockCreatePantryItem).toHaveBeenCalled();
  });
});
