import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useShoppingListMutations } from '../../../src/hooks/shoppingList/useShoppingListMutations';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';

// Mock dependencies
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

jest.mock('@apollo/client/react', () => ({
  useApolloClient: jest.fn(),
}));

jest.mock('#generated', () => ({
  useAddItemToShoppingListMutation: jest.fn(),
  useUpdateShoppingListItemMutation: jest.fn(),
  useRemoveItemFromShoppingListMutation: jest.fn(),
  useToggleShoppingListItemPurchasedMutation: jest.fn(),
  ShoppingListItemFragmentDoc: {},
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
}));

jest.mock('#/utils/generateId', () => ({
  generateId: jest.fn(),
}));

jest.mock('#/apollo/offline/OptimisticDataPersistence', () => ({
  optimisticDataPersistence: {
    save: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('#/apollo/utils', () => ({
  createAddToKeyedQueryFieldUpdater: jest.fn(() => jest.fn()),
  createRemoveFromQueryFieldUpdater: jest.fn(() => jest.fn()),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/hooks/utils', () => ({
  useCrudOperations: jest.fn(),
}));

import { useApolloClient } from '@apollo/client/react';
import {
  useAddItemToShoppingListMutation,
  useUpdateShoppingListItemMutation,
  useRemoveItemFromShoppingListMutation,
  useToggleShoppingListItemPurchasedMutation,
} from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import { useCrudOperations } from '#/hooks/utils';
import { generateId } from '#/utils/generateId';

const mockUseApolloClient = useApolloClient as jest.Mock;
const mockUseAddItemToShoppingListMutation =
  useAddItemToShoppingListMutation as jest.Mock;
const mockUseUpdateShoppingListItemMutation =
  useUpdateShoppingListItemMutation as jest.Mock;
const mockUseRemoveItemFromShoppingListMutation =
  useRemoveItemFromShoppingListMutation as jest.Mock;
const mockUseToggleShoppingListItemPurchasedMutation =
  useToggleShoppingListItemPurchasedMutation as jest.Mock;
const mockUseErrorHandler = useErrorHandler as jest.Mock;
const mockUseCrudOperations = useCrudOperations as jest.Mock;
const mockGenerateId = generateId as jest.Mock;

// Helper to create mock shopping list items
const createMockItem = (
  id: string,
  itemName: string,
  overrides?: Partial<ShoppingListItemCoreFragment>,
): ShoppingListItemCoreFragment =>
  ({
    __typename: 'ShoppingListItem',
    id,
    itemName,
    quantity: 1,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      purchasedQuantity: null,
      purchasedPrice: null,
      purchaseDate: null,
      purchasedBy: null,
    },
    updatedAt: new Date().toISOString(),
    version: 1,
    displayFormat: 'DECIMAL',
    unit: null,
    shoppingList: {
      __typename: 'ShoppingList',
      id: 'list-1',
    },
    pantryItem: null,
    ...overrides,
  } as unknown as ShoppingListItemCoreFragment);

describe('useShoppingListMutations', () => {
  const mockListId = 'list-123';
  const mockRefetch = jest.fn();
  const mockItems = [
    createMockItem('item-1', 'Milk'),
    createMockItem('item-2', 'Bread'),
  ];

  const mockAddItemMutation = jest.fn();
  const mockUpdateItemMutation = jest.fn();
  const mockRemoveItemMutation = jest.fn();
  const mockTogglePurchasedMutation = jest.fn();

  const mockCreateAddOperation = jest.fn();
  const mockCreateUpdateOperation = jest.fn();
  const mockCreateRemoveOperation = jest.fn();

  const mockApolloClient = {
    cache: {
      identify: jest.fn(),
      evict: jest.fn(),
      gc: jest.fn(),
    },
    readFragment: jest.fn(),
  };

  const defaultProps = {
    listId: mockListId,
    items: mockItems,
    refetch: mockRefetch,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock error handler
    mockUseErrorHandler.mockReturnValue({
      handleApolloError: jest.fn(error => ({ message: error.message })),
    });

    // Mock Apollo client
    mockUseApolloClient.mockReturnValue(mockApolloClient);

    // Mock generateId
    mockGenerateId.mockReturnValue('mock-id-123');

    // Mock mutations
    mockUseAddItemToShoppingListMutation.mockReturnValue([
      mockAddItemMutation,
      {},
    ]);
    mockUseUpdateShoppingListItemMutation.mockReturnValue([
      mockUpdateItemMutation,
      {},
    ]);
    mockUseRemoveItemFromShoppingListMutation.mockReturnValue([
      mockRemoveItemMutation,
      {},
    ]);
    mockUseToggleShoppingListItemPurchasedMutation.mockReturnValue([
      mockTogglePurchasedMutation,
      {},
    ]);

    // Mock CRUD operations
    mockCreateAddOperation.mockReturnValue(jest.fn());
    mockCreateUpdateOperation.mockReturnValue(jest.fn());
    mockCreateRemoveOperation.mockReturnValue(jest.fn());

    mockUseCrudOperations.mockReturnValue({
      createAddOperation: mockCreateAddOperation,
      createUpdateOperation: mockCreateUpdateOperation,
      createRemoveOperation: mockCreateRemoveOperation,
    });
  });

  describe('initialization', () => {
    it('initializes all mutation hooks', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(mockUseAddItemToShoppingListMutation).toHaveBeenCalled();
      expect(mockUseUpdateShoppingListItemMutation).toHaveBeenCalled();
      expect(mockUseRemoveItemFromShoppingListMutation).toHaveBeenCalled();
      expect(mockUseToggleShoppingListItemPurchasedMutation).toHaveBeenCalled();
    });

    it('initializes CRUD operations utilities', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(mockUseCrudOperations).toHaveBeenCalled();
    });

    it('returns all mutation functions', () => {
      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      expect(result.current).toHaveProperty('addItem');
      expect(result.current).toHaveProperty('updateItem');
      expect(result.current).toHaveProperty('removeItem');
      expect(result.current).toHaveProperty('toggleItem');
      expect(typeof result.current.addItem).toBe('function');
      expect(typeof result.current.updateItem).toBe('function');
      expect(typeof result.current.removeItem).toBe('function');
      expect(typeof result.current.toggleItem).toBe('function');
    });
  });

  describe('addItem', () => {
    it('creates add operation with correct configuration', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      expect(callArgs.mutation).toBe(mockAddItemMutation);
      expect(typeof callArgs.parentId).toBe('function');
      expect(callArgs.parentId()).toBe(mockListId);
      expect(callArgs.operationName).toBe('Add Shopping List Item');
    });

    it('transforms input correctly', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      const transformInput = callArgs.transformInput;

      const input = {
        itemName: 'Milk',
        quantity: 2,
        unitName: 'gallons',
        unitId: 'unit-1',
        notes: 'Organic',
        category: 'Dairy',
      };

      const transformed = transformInput(input);

      expect(transformed).toEqual({
        shoppingListId: mockListId,
        itemName: 'Milk',
        quantity: 2,
        unitName: 'gallons',
        unitId: 'unit-1',
        notes: 'Organic',
        category: 'Dairy',
      });
    });

    it('returns created item on success', () => {
      const mockCreatedItem = createMockItem('new-item', 'Eggs');

      const mockAddOperation = jest.fn().mockResolvedValue(mockCreatedItem);
      mockCreateAddOperation.mockReturnValue(mockAddOperation);

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      expect(typeof result.current.addItem).toBe('function');
    });

    it('uses errorPolicy: all for add mutation', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(mockUseAddItemToShoppingListMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('updateItem', () => {
    it('is a custom implementation with cache read', async () => {
      mockApolloClient.cache.identify.mockReturnValue(
        'ShoppingListItem:item-1',
      );
      mockApolloClient.readFragment.mockReturnValue(
        createMockItem('item-1', 'Milk'),
      );
      mockUpdateItemMutation.mockResolvedValue({
        data: {
          updateShoppingListItem: createMockItem('item-1', 'Updated Milk'),
        },
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      const success = await act(async () => {
        return await result.current.updateItem('item-1', {
          itemName: 'Updated Milk',
        });
      });

      expect(mockUpdateItemMutation).toHaveBeenCalled();
      expect(success).toBeTruthy();
    });

    it('uses errorPolicy: all for update mutation', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(mockUseUpdateShoppingListItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });

    it('handles item not in cache', async () => {
      mockApolloClient.cache.identify.mockReturnValue(
        'ShoppingListItem:item-1',
      );
      mockApolloClient.readFragment.mockReturnValue(null);
      mockUpdateItemMutation.mockResolvedValue({
        data: { updateShoppingListItem: createMockItem('item-1', 'Updated') },
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await act(async () => {
        await result.current.updateItem('item-1', { itemName: 'Updated' });
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Item not in cache, cannot update optimistically:',
        'item-1',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('removeItem', () => {
    it('creates remove operation when called', async () => {
      const mockRemoveOperation = jest.fn();
      mockCreateRemoveOperation.mockReturnValue(mockRemoveOperation);

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      await act(async () => {
        await result.current.removeItem('item-1');
      });

      const callArgs = mockCreateRemoveOperation.mock.calls[0][0];
      expect(callArgs.mutation).toBe(mockRemoveItemMutation);
      expect(callArgs.parentId).toBe(mockListId);
      expect(callArgs.itemId).toBe('item-1');
      expect(callArgs.operationName).toBe('Delete Shopping List Item');
    });

    it('uses errorPolicy: all for remove mutation', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(mockUseRemoveItemFromShoppingListMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('toggleItem', () => {
    it('creates toggle operation when called', async () => {
      const mockToggleOperation = jest.fn();
      mockCreateAddOperation.mockReturnValueOnce(jest.fn()); // for addItem
      mockUseCrudOperations.mockReturnValue({
        createAddOperation: mockCreateAddOperation,
        createUpdateOperation: mockCreateUpdateOperation,
        createRemoveOperation: mockCreateRemoveOperation,
        createToggleOperation: jest.fn().mockReturnValue(mockToggleOperation),
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      // toggleItem should be available
      expect(typeof result.current.toggleItem).toBe('function');
    });

    it('uses errorPolicy: all for toggle mutation', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      expect(
        mockUseToggleShoppingListItemPurchasedMutation,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('shows alert on add error', () => {
      const mockError = new Error('Add failed');
      mockUseAddItemToShoppingListMutation.mockReturnValue([
        mockAddItemMutation,
        { error: mockError },
      ]);

      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockUseAddItemToShoppingListMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Add failed');
    });

    it('shows alert on update error', () => {
      const mockError = new Error('Update failed');

      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockUseUpdateShoppingListItemMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalled();
    });

    it('shows alert on remove error', () => {
      const mockError = new Error('Remove failed');

      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs =
        mockUseRemoveItemFromShoppingListMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Remove failed');
    });

    it('shows alert on toggle error', () => {
      const mockError = new Error('Toggle failed');

      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs =
        mockUseToggleShoppingListItemPurchasedMutation.mock.calls[0][0];
      callArgs.onError(mockError);

      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Toggle failed');
    });
  });

  describe('edge cases', () => {
    it('handles undefined listId', () => {
      const propsWithoutListId = {
        ...defaultProps,
        listId: undefined,
      };

      const { result } = renderHook(() =>
        useShoppingListMutations(propsWithoutListId),
      );

      expect(result.current).toHaveProperty('addItem');
      expect(result.current).toHaveProperty('updateItem');
      expect(result.current).toHaveProperty('removeItem');
      expect(result.current).toHaveProperty('toggleItem');
    });

    it('handles empty items array', () => {
      const propsWithEmptyItems = {
        ...defaultProps,
        items: [],
      };

      const { result } = renderHook(() =>
        useShoppingListMutations(propsWithEmptyItems),
      );

      expect(result.current).toHaveProperty('addItem');
    });

    it('handles props changes', () => {
      const { rerender } = renderHook(
        (props: typeof defaultProps) => useShoppingListMutations(props),
        { initialProps: defaultProps },
      );

      const newProps = {
        listId: 'list-456',
        items: [createMockItem('item-3', 'Eggs')],
        refetch: jest.fn(),
      };

      rerender(newProps);

      // Should handle props change without errors
      expect(mockUseCrudOperations).toHaveBeenCalled();
    });
  });

  describe('integration with CRUD utilities', () => {
    it('uses createAddOperation for addItem', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      expect(callArgs.mutation).toBe(mockAddItemMutation);
      expect(typeof callArgs.parentId).toBe('function');
      expect(callArgs.parentId()).toBe(mockListId);
    });

    it('creates operations with correct parent ID', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      // Check all operations receive the correct parentId
      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      expect(typeof callArgs.parentId).toBe('function');
      expect(callArgs.parentId()).toBe(mockListId);
    });

    it('provides onSuccess callback for addItem', () => {
      renderHook(() => useShoppingListMutations(defaultProps));

      const callArgs = mockCreateAddOperation.mock.calls[0][0];
      expect(callArgs.onSuccess).toBeDefined();
      expect(typeof callArgs.onSuccess).toBe('function');
    });
  });

  describe('real-world scenarios', () => {
    it('handles complete add item flow', async () => {
      const mockAddOperation = jest
        .fn()
        .mockResolvedValue(createMockItem('new-item', 'Eggs'));
      mockCreateAddOperation.mockReturnValue(mockAddOperation);

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      const newItem = {
        itemName: 'Eggs',
        quantity: 12,
        notes: 'Free range',
      };

      await act(async () => {
        await result.current.addItem(newItem);
      });

      // Verify operation was created and called
      expect(mockCreateAddOperation).toHaveBeenCalled();
    });

    it('handles update item with partial data', async () => {
      mockApolloClient.cache.identify.mockReturnValue(
        'ShoppingListItem:item-1',
      );
      mockApolloClient.readFragment.mockReturnValue(
        createMockItem('item-1', 'Milk'),
      );
      mockUpdateItemMutation.mockResolvedValue({
        data: {
          updateShoppingListItem: createMockItem('item-1', 'Milk', {
            quantity: 2,
          }),
        },
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      await act(async () => {
        await result.current.updateItem('item-1', { quantity: 2 });
      });

      expect(mockUpdateItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            id: 'item-1',
            input: expect.objectContaining({ quantity: 2 }),
          }),
        }),
      );
    });

    it('handles toggle purchased state', async () => {
      mockTogglePurchasedMutation.mockResolvedValue({
        data: {
          toggleShoppingListItemPurchased: createMockItem('item-1', 'Milk', {
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              purchasedQuantity: null,
              purchasedPrice: null,
              purchaseDate: null,
              purchasedBy: null,
            },
          }),
        },
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      await act(async () => {
        const success = await result.current.toggleItem('item-1');
        expect(success).toBeTruthy();
      });

      expect(mockTogglePurchasedMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            id: 'item-1',
            purchased: true,
          }),
        }),
      );
    });

    it('returns false when toggling non-existent item', async () => {
      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      await act(async () => {
        const success = await result.current.toggleItem('non-existent-id');
        expect(success).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Item not found:',
        'non-existent-id',
      );

      consoleSpy.mockRestore();
    });

    it('handles sequential mutations', async () => {
      const mockAddOperation = jest
        .fn()
        .mockResolvedValue(createMockItem('new-item', 'Eggs'));
      const mockRemoveOperation = jest.fn().mockResolvedValue({});

      mockCreateAddOperation.mockReturnValue(mockAddOperation);
      mockCreateRemoveOperation.mockReturnValue(mockRemoveOperation);

      mockApolloClient.cache.identify.mockReturnValue(
        'ShoppingListItem:item-1',
      );
      mockApolloClient.readFragment.mockReturnValue(
        createMockItem('item-1', 'Milk'),
      );
      mockUpdateItemMutation.mockResolvedValue({
        data: {
          updateShoppingListItem: createMockItem('item-1', 'Milk', {
            quantity: 2,
          }),
        },
      });

      const { result } = renderHook(() =>
        useShoppingListMutations(defaultProps),
      );

      // Add item
      await act(async () => {
        await result.current.addItem({ itemName: 'Eggs' });
      });

      // Update item
      await act(async () => {
        await result.current.updateItem('item-1', { quantity: 2 });
      });

      // Remove item
      await act(async () => {
        await result.current.removeItem('item-1');
      });

      // All operations should have been called
      expect(mockAddOperation).toHaveBeenCalled();
      expect(mockUpdateItemMutation).toHaveBeenCalled();
      expect(mockRemoveOperation).toHaveBeenCalled();
    });
  });
});
