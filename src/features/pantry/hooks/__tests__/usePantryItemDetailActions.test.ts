import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import type { errorService } from '#/services/errorService';
import type { executeMutation } from '#/utils/compilerSafeWrappers';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { alertService } from '#/services/alertService';
import { usePantryItemDetailActions } from '../usePantryItemDetailActions';

const mockNavigateTo = {
  shoppingListMain: jest.fn(),
  pantryItem: jest.fn(),
  nutritionScreen: jest.fn(),
};
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    navigateTo: mockNavigateTo,
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockReportError = jest.fn();
jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: (...args: Parameters<typeof errorService.reportError>) =>
      mockReportError(...args),
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: () => void) => fn()),
  executeMutation: jest.fn(
    async (
      fn: Parameters<typeof executeMutation>[0],
      onError: Parameters<typeof executeMutation>[1],
    ) => {
      try {
        await fn();
        return true;
      } catch (e) {
        if (typeof onError === 'function') await onError(e);
        return false;
      }
    },
  ),
}));

jest.mock('#hooks/home/pantry/utils', () => ({
  removeFromPantryItemsCache: jest.fn(),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => {
  const { classifyCreateResult } = jest.requireActual(
    '#/apollo/utils/classifyCreateResult',
  );
  const revertOptimisticShoppingListItem = jest.fn();
  return {
    addNewItemToShoppingListCache: jest.fn(),
    adoptServerShoppingListItemId: jest.fn(),
    revertOptimisticShoppingListItem,
    addOptimisticShoppingListItem: jest.fn(),
    buildAddItemsReconcileUpdate: jest.fn(() => jest.fn()),
    createOptimisticShoppingListItem: jest.fn((id: string) => ({
      __typename: 'ShoppingListItem',
      id,
    })),
    // Mirror the real reconciler (real classify + mocked revert) so the
    // keep/revert decision under test matches production.
    reconcileShoppingCreate: jest.fn(
      (cache: unknown, listId: string, id: string, result: unknown) => {
        if (
          classifyCreateResult(
            result,
            'addItemsToShoppingList',
            'AddItemsToShoppingListPayload',
          ) === 'rejected'
        ) {
          revertOptimisticShoppingListItem(cache, listId, id);
          return 'reverted';
        }
        return 'kept';
      },
    ),
  };
});

const mockConvertExpiredToWaste = jest.fn();
const mockConvertExpiredBatches = jest.fn();
const mockAdjustQuantity = jest.fn();
const mockCorrectWeight = jest.fn();

jest.mock('#features/pantry/hooks/mutations/useConvertExpiredToWaste', () => ({
  useConvertExpiredToWaste: () => ({
    convertExpiredToWaste: mockConvertExpiredToWaste,
  }),
}));

jest.mock(
  '#features/pantry/hooks/mutations/useConvertExpiredBatchesToWaste',
  () => ({
    useConvertExpiredBatchesToWaste: () => ({
      convertExpiredBatches: mockConvertExpiredBatches,
    }),
  }),
);

jest.mock(
  '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity',
  () => ({
    useAdjustPantryItemQuantity: () => ({ adjustQuantity: mockAdjustQuantity }),
  }),
);

jest.mock(
  '#features/pantry/hooks/mutations/useCorrectPantryItemWeight',
  () => ({
    useCorrectPantryItemWeight: () => ({ correctWeight: mockCorrectWeight }),
  }),
);

beforeEach(() => {
  jest.clearAllMocks();
});

const mockGoBack = jest.fn();
const mockOnAddToShoppingListNeedsList = jest.fn();

const baseItem = {
  id: 'item-1',
  version: 1,
  quantity: 3,
  unit: { id: 'unit-1', name: 'cups', symbol: 'c' },
  item: { id: 'catalog-1' },
  itemName: 'Milk',
  activeBatchCount: 0,
};

function setup(
  overrides: Partial<Parameters<typeof usePantryItemDetailActions>[0]> = {},
  options: { operationMocks?: MockedResponse[] } = {},
) {
  const params = {
    itemId: 'item-1',
    item: baseItem,
    selectedPantryId: 'pantry-1',
    selectedShoppingListId: 'list-1',
    goBack: mockGoBack,
    onAddToShoppingListNeedsList: mockOnAddToShoppingListNeedsList,
    ...overrides,
  };
  return renderHookWithApollo(
    () => usePantryItemDetailActions(params),
    options,
  );
}

describe('usePantryItemDetailActions', () => {
  describe('initial state', () => {
    it('returns idle addToListStatus and modals closed', () => {
      const { result } = setup();

      expect(result.current.addToListStatus).toBe('idle');
      expect(result.current.adjustModalVisible).toBe(false);
      expect(result.current.correctWeightVisible).toBe(false);
    });

    it('exposes modal-state setters', () => {
      const { result } = setup();

      act(() => result.current.setAdjustModalVisible(true));
      expect(result.current.adjustModalVisible).toBe(true);

      act(() => result.current.setCorrectWeightVisible(true));
      expect(result.current.correctWeightVisible).toBe(true);
    });
  });

  describe('handleDelete', () => {
    it('opens a confirmation alert', () => {
      const { result } = setup();

      act(() => result.current.handleDelete());

      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Item',
        'Are you sure you want to delete this item?',
        expect.any(Array),
      );
    });

    it('fires DeletePantryItem and goes back on confirm', async () => {
      const deleteMock = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            __typename: 'PantryItemPayload',
            success: true,
            message: '',
            code: 'SUCCESS',
            pantryItem: { __typename: 'PantryItem', id: 'item-1' },
          },
        },
      });

      const { result } = setup({}, { operationMocks: [deleteMock.mock] });

      act(() => result.current.handleDelete());

      const deleteButton = (alertService.alert as jest.Mock).mock
        .calls[0][2][1];
      await act(async () => {
        deleteButton.onPress();
      });

      await waitFor(() =>
        expect(deleteMock.fired).toContainEqual({ input: { id: 'item-1' } }),
      );
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });
  });

  describe('handleAddToShoppingList', () => {
    it('invokes onAddToShoppingListNeedsList when no list is selected', () => {
      const { result } = setup({ selectedShoppingListId: null });

      act(() => result.current.handleAddToShoppingList());

      expect(mockOnAddToShoppingListNeedsList).toHaveBeenCalled();
    });

    it('fires AddItemToShoppingList with correct variables', async () => {
      const addMock = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              {
                __typename: 'BatchAddShoppingListItemResult',
                index: 0,
                clientId: null,
                success: true,
                quantityIncremented: false,
                error: null,
                item: { __typename: 'ShoppingListItem', id: 'sli-1' },
              },
            ],
          },
        },
      });

      const { result } = setup({}, { operationMocks: [addMock.mock] });

      await act(async () => {
        result.current.handleAddToShoppingList();
      });

      expect(addMock.fired).toContainEqual({
        input: {
          shoppingListId: 'list-1',
          items: [
            {
              // Client-generated cuid2 so a queued create replays idempotently.
              id: expect.stringMatching(
                /^(?:[a-z][0-9a-z]{23,31}|[0-9a-fA-F]{24})$/,
              ),
              item: { itemId: 'catalog-1' },
              quantity: 3,
              unit: { unitId: 'unit-1' },
            },
          ],
        },
      });
    });

    it('falls back to quantity 1 when item has no quantity', async () => {
      const addMock = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              {
                __typename: 'BatchAddShoppingListItemResult',
                index: 0,
                clientId: null,
                success: true,
                quantityIncremented: false,
                error: null,
                item: { __typename: 'ShoppingListItem', id: 'sli-1' },
              },
            ],
          },
        },
      });

      const { result } = setup(
        { item: { ...baseItem, quantity: null } },
        { operationMocks: [addMock.mock] },
      );

      await act(async () => {
        result.current.handleAddToShoppingList();
      });

      expect(addMock.fired).toContainEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            items: [expect.objectContaining({ quantity: 1 })],
          }),
        }),
      );
    });

    it('omits unit when item.unit is null', async () => {
      const addMock = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              {
                __typename: 'BatchAddShoppingListItemResult',
                index: 0,
                clientId: null,
                success: true,
                quantityIncremented: false,
                error: null,
                item: { __typename: 'ShoppingListItem', id: 'sli-1' },
              },
            ],
          },
        },
      });

      const { result } = setup(
        { item: { ...baseItem, unit: null } },
        { operationMocks: [addMock.mock] },
      );

      await act(async () => {
        result.current.handleAddToShoppingList();
      });

      expect(addMock.fired).toContainEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            items: [expect.objectContaining({ unit: undefined })],
          }),
        }),
      );
    });
  });

  describe('handleDiscardExpired', () => {
    it('shows batch-discard alert when activeBatchCount > 0', () => {
      const { result } = setup({
        item: { ...baseItem, activeBatchCount: 2 },
      });

      act(() => result.current.handleDiscardExpired());

      expect(alertService.alert).toHaveBeenCalledWith(
        'Discard Expired Batches',
        expect.any(String),
        expect.any(Array),
      );
    });

    it('shows item-discard alert when no batches', () => {
      const { result } = setup();

      act(() => result.current.handleDiscardExpired());

      expect(alertService.alert).toHaveBeenCalledWith(
        'Discard Expired Item',
        expect.stringContaining('3 cups'),
        expect.any(Array),
      );
    });

    it('calls convertExpiredBatches on batch-discard confirm', () => {
      const { result } = setup({
        item: { ...baseItem, activeBatchCount: 2 },
      });

      act(() => result.current.handleDiscardExpired());

      const discardButton = (alertService.alert as jest.Mock).mock
        .calls[0][2][1];
      act(() => discardButton.onPress());

      expect(mockConvertExpiredBatches).toHaveBeenCalledWith('item-1');
    });

    it('calls convertExpiredToWaste on item-discard confirm', async () => {
      const { result } = setup();

      act(() => result.current.handleDiscardExpired());

      const discardButton = (alertService.alert as jest.Mock).mock
        .calls[0][2][1];
      await act(async () => discardButton.onPress());

      expect(mockConvertExpiredToWaste).toHaveBeenCalledWith('item-1');
    });

    it('does nothing when item is null', () => {
      const { result } = setup({ item: null });

      act(() => result.current.handleDiscardExpired());

      expect(alertService.alert).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmAdjust', () => {
    it('calls adjustQuantity with item id, new quantity, reason, version', () => {
      const { result } = setup();

      act(() => result.current.handleConfirmAdjust(5, 'used some', 250));

      expect(mockAdjustQuantity).toHaveBeenCalledWith(
        'item-1',
        5,
        'used some',
        1,
        250,
      );
    });

    it('does nothing when item is null', () => {
      const { result } = setup({ item: null });

      act(() => result.current.handleConfirmAdjust(5, 'reason'));

      expect(mockAdjustQuantity).not.toHaveBeenCalled();
    });
  });

  describe('handleCorrectWeight', () => {
    it('calls correctWeight with item id, weight, reason, version', () => {
      const { result } = setup();

      act(() => result.current.handleCorrectWeight(500, 'mis-entered', 'g'));

      expect(mockCorrectWeight).toHaveBeenCalledWith(
        'item-1',
        500,
        'mis-entered',
        1,
        'g',
      );
    });

    it('defaults version to 0 when item has no version', () => {
      const { result } = setup({
        item: { ...baseItem, version: null },
      });

      act(() => result.current.handleCorrectWeight(100, 'r'));

      expect(mockCorrectWeight).toHaveBeenCalledWith(
        'item-1',
        100,
        'r',
        0,
        undefined,
      );
    });

    it('does nothing when item is null', () => {
      const { result } = setup({ item: null });

      act(() => result.current.handleCorrectWeight(100, 'r'));

      expect(mockCorrectWeight).not.toHaveBeenCalled();
    });
  });
});
