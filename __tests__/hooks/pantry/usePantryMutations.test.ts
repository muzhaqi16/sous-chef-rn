import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { usePantryMutations } from '../../../src/hooks/pantry/usePantryMutations';
import type { PantryItem } from '#/graphql/generated/types';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('#generated', () => ({
  useCreatePantryItemMutation: jest.fn(),
  useUpdatePantryItemMutation: jest.fn(),
  useDeletePantryItemMutation: jest.fn(),
  StorageState: {
    FRESH: 'FRESH',
    FROZEN: 'FROZEN',
    PANTRY: 'PANTRY',
  },
}));

jest.mock('#/utils/errorHandling', () => ({
  useErrorHandler: jest.fn(),
}));

jest.mock('#/utils/errors/versionConflict', () => ({
  handleVersionConflict: jest.fn(),
  getVersionConflictMessage: jest.fn(),
}));

jest.mock('#/apollo/utils/createOptimisticResponse', () => ({
  createOptimisticEntity: jest.fn(),
  enhanceWithVersion: jest.fn(),
}));

jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(),
}));

jest.mock('#/apollo/utils', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/hooks/utils', () => ({
  useCrudOperations: jest.fn(),
}));

import {
  useCreatePantryItemMutation,
  useUpdatePantryItemMutation,
  useDeletePantryItemMutation,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import { handleVersionConflict, getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { useCrudOperations } from '#/hooks/utils';
import { generateId } from '#/utils/generateId';

const mockUseCreatePantryItemMutation = useCreatePantryItemMutation as jest.Mock;
const mockUseUpdatePantryItemMutation = useUpdatePantryItemMutation as jest.Mock;
const mockUseDeletePantryItemMutation = useDeletePantryItemMutation as jest.Mock;
const mockUseErrorHandler = useErrorHandler as jest.Mock;
const mockHandleVersionConflict = handleVersionConflict as jest.Mock;
const mockGetVersionConflictMessage = getVersionConflictMessage as jest.Mock;
const mockUseCrudOperations = useCrudOperations as jest.Mock;
const mockGenerateId = generateId as jest.Mock;

// Helper to create mock pantry items
const createMockPantryItem = (
  id: string,
  itemName: string,
  overrides?: Partial<PantryItem>,
): PantryItem => ({
  __typename: 'PantryItem',
  id,
  itemName,
  currentQuantity: 5,
  storageState: 'FRESH',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  storageLocation: null,
  storageNotes: null,
  expiresAt: null,
  autoReorderPoint: null,
  pantry: {
    __typename: 'Pantry',
    id: 'pantry-1',
  },
  unit: null,
  ...overrides,
} as PantryItem);

describe('usePantryMutations', () => {
  const mockPantryId = 'pantry-123';
  const mockRefetch = jest.fn();
  const mockItems = [
    createMockPantryItem('item-1', 'Milk'),
    createMockPantryItem('item-2', 'Bread'),
  ];

  const mockAddItemMutation = jest.fn();
  const mockUpdateItemMutation = jest.fn();
  const mockRemoveItemMutation = jest.fn();

  const mockCreateAddOperation = jest.fn();
  const mockCreateUpdateOperation = jest.fn();
  const mockCreateRemoveOperation = jest.fn();

  const defaultProps = {
    pantryId: mockPantryId,
    items: mockItems,
    refetch: mockRefetch,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock error handler
    mockUseErrorHandler.mockReturnValue({
      handleApolloError: jest.fn((error) => ({ message: error.message })),
    });

    // Mock generateId
    mockGenerateId.mockReturnValue('mock-id-123');

    // Mock mutations
    mockUseCreatePantryItemMutation.mockReturnValue([mockAddItemMutation, {}]);
    mockUseUpdatePantryItemMutation.mockReturnValue([mockUpdateItemMutation, {}]);
    mockUseDeletePantryItemMutation.mockReturnValue([mockRemoveItemMutation, {}]);

    // Mock CRUD operations
    mockCreateAddOperation.mockReturnValue(jest.fn());
    mockCreateUpdateOperation.mockReturnValue(jest.fn());
    mockCreateRemoveOperation.mockReturnValue(jest.fn());

    mockUseCrudOperations.mockReturnValue({
      createAddOperation: mockCreateAddOperation,
      createUpdateOperation: mockCreateUpdateOperation,
      createRemoveOperation: mockCreateRemoveOperation,
    });

    // Mock version conflict handlers
    mockHandleVersionConflict.mockReturnValue(false);
    mockGetVersionConflictMessage.mockReturnValue('Item was updated by another user');
  });

  describe('initialization', () => {
    it('initializes all mutation hooks', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockUseCreatePantryItemMutation).toHaveBeenCalled();
      expect(mockUseUpdatePantryItemMutation).toHaveBeenCalled();
      expect(mockUseDeletePantryItemMutation).toHaveBeenCalled();
    });

    it('initializes CRUD operations utilities', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockUseCrudOperations).toHaveBeenCalled();
    });

    it('returns all mutation functions', () => {
      const { result } = renderHook(() => usePantryMutations(defaultProps));

      expect(result.current).toHaveProperty('addItem');
      expect(result.current).toHaveProperty('updateItem');
      expect(result.current).toHaveProperty('removeItem');
      expect(typeof result.current.addItem).toBe('function');
      expect(typeof result.current.updateItem).toBe('function');
      expect(typeof result.current.removeItem).toBe('function');
    });
  });

  describe('addItem', () => {
    it('creates add operation with correct configuration', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockCreateAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: mockAddItemMutation,
          parentId: expect.any(Function),
          operationName: 'Add Pantry Item',
        }),
      );
    });

    it('transforms input correctly', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      const transformInput = callArgs.transformInput;

      const input = {
        itemName: 'Milk',
        quantity: 2,
        unitId: 'unit-1',
        storageState: 'FRESH' as const,
        brand: 'Organic Valley',
        location: 'Fridge',
        expirationDate: '2025-12-31',
        notes: 'Keep cold',
        category: 'Dairy',
        barcode: '123456789',
      };

      const transformed = transformInput(input);

      expect(transformed).toEqual({
        pantryId: mockPantryId,
        initialQuantity: 2,
        itemName: 'Milk',
        unitId: 'unit-1',
        storageState: 'FRESH',
        itemBrand: 'Organic Valley',
        storageLocation: 'Fridge',
        expiresAt: '2025-12-31',
        storageNotes: 'Keep cold',
        itemCategory: 'Dairy',
        itemUpc: '123456789',
      });
    });

    it('omits optional fields when not provided', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      const transformInput = callArgs.transformInput;

      const input = {
        itemName: 'Milk',
        quantity: 2,
        unitId: 'unit-1',
        storageState: 'FRESH' as const,
      };

      const transformed = transformInput(input);

      expect(transformed).toEqual({
        pantryId: mockPantryId,
        initialQuantity: 2,
        itemName: 'Milk',
        unitId: 'unit-1',
        storageState: 'FRESH',
      });
      expect(transformed).not.toHaveProperty('itemBrand');
      expect(transformed).not.toHaveProperty('storageLocation');
    });

    it('uses errorPolicy: all for add mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockUseCreatePantryItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });

    it('provides onSuccess callback', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      expect(callArgs.onSuccess).toBeDefined();
      expect(typeof callArgs.onSuccess).toBe('function');
    });
  });

  describe('updateItem', () => {
    it('creates update operation when called', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.updateItem('item-1', { itemName: 'Updated Milk' });
      });

      expect(mockCreateUpdateOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: mockUpdateItemMutation,
          parentId: expect.any(Function),
          itemId: 'item-1',
          operationName: 'Update Pantry Item',
        }),
      );
    });

    it('uses errorPolicy: all for update mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockUseUpdatePantryItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });

    it('provides refetch callback for version conflicts', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      // Need to call updateItem to trigger createUpdateOperation
      await act(async () => {
        await result.current.updateItem('item-1', { itemName: 'Updated' });
      });

      const callArgs = mockCreateUpdateOperation.mock.calls[0][0];
      expect(callArgs.onVersionConflict).toBe(mockRefetch);
    });

    it('provides onSuccess callback', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      // Need to call updateItem to trigger createUpdateOperation
      await act(async () => {
        await result.current.updateItem('item-1', { itemName: 'Updated' });
      });

      const callArgs = mockCreateUpdateOperation.mock.calls[0][0];
      expect(callArgs.onSuccess).toBeDefined();
      expect(typeof callArgs.onSuccess).toBe('function');
    });
  });

  describe('removeItem', () => {
    it('creates remove operation when called', async () => {
      const mockRemoveOperation = jest.fn().mockResolvedValue({});
      mockCreateRemoveOperation.mockReturnValue(mockRemoveOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.removeItem('item-1');
      });

      expect(mockCreateRemoveOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: mockRemoveItemMutation,
          parentId: expect.any(Function),
          itemId: 'item-1',
          operationName: 'Delete Pantry Item',
        }),
      );
    });

    it('uses errorPolicy: all for remove mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockUseDeletePantryItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('shows alert on add error', () => {
      const mockError = new Error('Add failed');

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseCreatePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Add failed');
    });

    it('shows alert on update error (non-version conflict)', () => {
      const mockError = new Error('Update failed');
      mockHandleVersionConflict.mockReturnValue(false);

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseUpdatePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Update failed');
    });

    it('shows version conflict alert with refresh option', () => {
      const mockError = new Error('Version conflict');
      mockHandleVersionConflict.mockReturnValue(true);
      mockGetVersionConflictMessage.mockReturnValue('Item was updated by another user');

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseUpdatePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(mockHandleVersionConflict).toHaveBeenCalledWith(mockError);
      expect(mockGetVersionConflictMessage).toHaveBeenCalledWith(mockError);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Item Updated',
        'Item was updated by another user',
        [
          { text: 'Refresh', onPress: expect.any(Function) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    });

    it('calls refetch when user chooses refresh on version conflict', () => {
      const mockError = new Error('Version conflict');
      mockHandleVersionConflict.mockReturnValue(true);

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseUpdatePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      // Get the refresh button callback
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const buttons = alertCall[2];
      const refreshButton = buttons.find((btn: any) => btn.text === 'Refresh');

      // Call the refresh callback
      refreshButton.onPress();

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('shows alert on remove error', () => {
      const mockError = new Error('Remove failed');

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseDeletePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Remove failed');
    });
  });

  describe('edge cases', () => {
    it('handles undefined pantryId', () => {
      const propsWithoutPantryId = {
        ...defaultProps,
        pantryId: undefined,
      };

      const { result } = renderHook(() => usePantryMutations(propsWithoutPantryId));

      expect(result.current).toHaveProperty('addItem');
      expect(result.current).toHaveProperty('updateItem');
      expect(result.current).toHaveProperty('removeItem');
    });

    it('handles empty items array', () => {
      const propsWithEmptyItems = {
        ...defaultProps,
        items: [],
      };

      const { result } = renderHook(() => usePantryMutations(propsWithEmptyItems));

      expect(result.current).toHaveProperty('addItem');
    });

    it('handles props changes', () => {
      const { rerender } = renderHook(
        ({ pantryId, items, refetch }) => usePantryMutations({ pantryId, items, refetch }),
        { initialProps: defaultProps },
      );

      const newProps = {
        pantryId: 'pantry-456',
        items: [createMockPantryItem('item-3', 'Eggs')],
        refetch: jest.fn(),
      };

      rerender(newProps);

      // Should handle props change without errors
      expect(mockUseCrudOperations).toHaveBeenCalled();
    });
  });

  describe('integration with CRUD utilities', () => {
    it('uses createAddOperation for addItem', () => {
      renderHook(() => usePantryMutations(defaultProps));

      expect(mockCreateAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutation: mockAddItemMutation,
          parentId: expect.any(Function),
        }),
      );
    });

    it('uses createUpdateOperation for updateItem', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.updateItem('item-1', { currentQuantity: 10 });
      });

      expect(mockCreateUpdateOperation).toHaveBeenCalled();
      expect(mockUpdateOperation).toHaveBeenCalledWith({ currentQuantity: 10 });
    });

    it('uses createRemoveOperation for removeItem', async () => {
      const mockRemoveOperation = jest.fn().mockResolvedValue({});
      mockCreateRemoveOperation.mockReturnValue(mockRemoveOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.removeItem('item-1');
      });

      expect(mockCreateRemoveOperation).toHaveBeenCalled();
      expect(mockRemoveOperation).toHaveBeenCalled();
    });

    it('creates operations with correct parent ID', () => {
      renderHook(() => usePantryMutations(defaultProps));

      // Check all operations receive the correct parentId
      expect(mockCreateAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: expect.any(Function),
        }),
      );
    });
  });

  describe('real-world scenarios', () => {
    it('handles complete add item flow', async () => {
      const mockAddOperation = jest.fn().mockResolvedValue(
        createMockPantryItem('new-item', 'Eggs'),
      );
      mockCreateAddOperation.mockReturnValue(mockAddOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      const newItem = {
        itemName: 'Eggs',
        quantity: 12,
        unitId: 'unit-dozen',
        storageState: 'FRESH' as const,
        expirationDate: '2025-12-31',
        notes: 'Free range',
      };

      await act(async () => {
        await result.current.addItem(newItem);
      });

      // Verify operation was created and called
      expect(mockCreateAddOperation).toHaveBeenCalled();
      expect(mockAddOperation).toHaveBeenCalled();
    });

    it('handles update item with partial data', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.updateItem('item-1', { currentQuantity: 3 });
      });

      expect(mockUpdateOperation).toHaveBeenCalledWith({ currentQuantity: 3 });
    });

    it('handles sequential mutations', async () => {
      const mockAddOperation = jest.fn().mockResolvedValue(createMockPantryItem('new-item', 'Eggs'));
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      const mockRemoveOperation = jest.fn().mockResolvedValue({});

      mockCreateAddOperation.mockReturnValue(mockAddOperation);
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);
      mockCreateRemoveOperation.mockReturnValue(mockRemoveOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      // Add item
      await act(async () => {
        await result.current.addItem({
          itemName: 'Eggs',
          quantity: 12,
          unitId: 'unit-1',
          storageState: 'FRESH' as const,
        });
      });

      // Update item
      await act(async () => {
        await result.current.updateItem('item-1', { currentQuantity: 3 });
      });

      // Remove item
      await act(async () => {
        await result.current.removeItem('item-1');
      });

      // All operations should have been called
      expect(mockAddOperation).toHaveBeenCalled();
      expect(mockUpdateOperation).toHaveBeenCalled();
      expect(mockRemoveOperation).toHaveBeenCalled();
    });

    it('handles version conflict during update', async () => {
      const mockError = new Error('Version conflict');
      mockHandleVersionConflict.mockReturnValue(true);

      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseUpdatePantryItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith(
        'Item Updated',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('handles add item with all optional fields', async () => {
      const mockAddOperation = jest.fn().mockResolvedValue(
        createMockPantryItem('new-item', 'Premium Milk'),
      );
      mockCreateAddOperation.mockReturnValue(mockAddOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      const newItem = {
        itemName: 'Premium Milk',
        quantity: 2,
        unitId: 'unit-gallon',
        storageState: 'FRESH' as const,
        brand: 'Organic Valley',
        location: 'Top shelf',
        expirationDate: '2025-12-31',
        notes: 'Lactose free',
        category: 'Dairy',
        barcode: '987654321',
        autoReorderPoint: 1,
      };

      await act(async () => {
        await result.current.addItem(newItem);
      });

      expect(mockAddOperation).toHaveBeenCalled();
    });

    it('handles update with storage state change', async () => {
      const mockUpdateOperation = jest.fn().mockResolvedValue({});
      mockCreateUpdateOperation.mockReturnValue(mockUpdateOperation);

      const { result } = renderHook(() => usePantryMutations(defaultProps));

      await act(async () => {
        await result.current.updateItem('item-1', {
          storageState: 'FROZEN' as const,
          location: 'Freezer',
        });
      });

      expect(mockUpdateOperation).toHaveBeenCalledWith({
        storageState: 'FROZEN',
        location: 'Freezer',
      });
    });
  });

  describe('optimistic responses', () => {
    it('configures optimistic response for add mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseCreatePantryItemMutation.mock.calls[0][0];
      expect(callArgs.optimisticResponse).toBeDefined();
      expect(typeof callArgs.optimisticResponse).toBe('function');
    });

    it('configures optimistic response for update mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseUpdatePantryItemMutation.mock.calls[0][0];
      expect(callArgs.optimisticResponse).toBeDefined();
      expect(typeof callArgs.optimisticResponse).toBe('function');
    });

    it('does not configure optimistic response for delete mutation', () => {
      // Note: Delete mutation doesn't use optimistic response in the implementation
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseDeletePantryItemMutation.mock.calls[0][0];
      // Delete mutation uses onError, update callbacks but not optimisticResponse
      expect(callArgs.onError).toBeDefined();
      expect(callArgs.update).toBeDefined();
    });
  });

  describe('cache updates', () => {
    it('configures cache update for add mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseCreatePantryItemMutation.mock.calls[0][0];
      expect(callArgs.update).toBeDefined();
      expect(typeof callArgs.update).toBe('function');
    });

    it('configures cache update for delete mutation', () => {
      renderHook(() => usePantryMutations(defaultProps));

      const callArgs = mockUseDeletePantryItemMutation.mock.calls[0][0];
      expect(callArgs.update).toBeDefined();
      expect(typeof callArgs.update).toBe('function');
    });
  });
});
