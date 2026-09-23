import { act, waitFor } from '@testing-library/react-native';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { ApolloClient } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { removePantryItemLocally } from '#features/pantry/cache/items';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { alertService } from '#/services/alertService';
import { revertOptimisticShoppingListItem } from '#features/shoppingList/cache/items';
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

jest.mock('#/services/errorService');

jest.mock('#features/pantry/cache/items', () => ({
  removeFromPantryItemsCache: jest.fn(),
  removePantryItemLocally: jest.fn(),
}));

jest.mock('#features/shoppingList/cache/connections', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#features/shoppingList/cache/items', () => {
  const { settledStatus } = jest.requireActual('#/apollo/utils/settleMutation');
  const revert = jest.fn();
  return {
    revertOptimisticShoppingListItem: revert,
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
        if (settledStatus(result) === 'failed') {
          revert(cache, listId, id);
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
  // Selected by `PantryItemDetail_pantryItem` — the item's own pantry, which is
  // authoritative regardless of which pantry the user currently has selected.
  pantryId: 'pantry-1',
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
            __typename: 'DeletePantryItemPayload',
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
        expect(deleteMock.fired).toContainEqual({
          input: { id: 'item-1' },
          today: expect.any(String),
        }),
      );
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });

    it('withdraws the row even when the delete is only queued', async () => {
      // A DeletePantryItem whose only cache work is an `update:` callback
      // cannot hold here: that callback never runs when the delete is queued
      // offline, so the screen navigates back with the row still in the list.
      // The shared `removeItem` withdraws it before firing, which is why this
      // holds with a queued (no data, no error) result.
      const queuedDelete = recordMock(DeletePantryItemDocument, {});

      const { result } = setup({}, { operationMocks: [queuedDelete.mock] });

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      const deleteButton = alertCalls[alertCalls.length - 1][2][1];
      await act(async () => {
        deleteButton.onPress();
      });

      await waitFor(() =>
        expect(removePantryItemLocally).toHaveBeenCalledWith(
          expect.anything(),
          'pantry-1',
          'item-1',
        ),
      );
    });

    it("evicts from the item's own pantry, not the selected one", async () => {
      // `removeItem` uses this id for cache surgery — which connection loses the
      // edge and whose count drops. They normally match, but a deep link or a
      // notification tap can open an item outside the selected pantry, and then
      // the selected one would decrement the wrong pantry and leave the real
      // one holding a stale edge.
      const deleteMock = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            __typename: 'DeletePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', id: 'item-1' },
          },
        },
      });

      const { result } = setup(
        {
          selectedPantryId: 'pantry-OTHER',
          item: { ...baseItem, pantryId: 'pantry-OWNING' },
        },
        { operationMocks: [deleteMock.mock] },
      );

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() =>
        expect(removePantryItemLocally).toHaveBeenCalledWith(
          expect.anything(),
          'pantry-OWNING',
          'item-1',
        ),
      );
      expect(removePantryItemLocally).not.toHaveBeenCalledWith(
        expect.anything(),
        'pantry-OTHER',
        expect.anything(),
      );
    });

    it('returns to the list when the server answers the delete as already done', async () => {
      // Another member removed the stack first: the payload converges with no
      // item, and the screen treats it as any other completed delete.
      const converged = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            __typename: 'DeletePantryItemPayload',
            converged: true,
            pantryItem: null,
          },
        },
      });

      const restore = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
      const { result } = setup({}, { operationMocks: [converged.mock] });

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(restore).not.toHaveBeenCalled();
      restore.mockRestore();
    });

    it('still deletes when no pantry is selected', async () => {
      // `selectedPantryId` is genuinely nullable — `navigationSlice` starts it
      // at null and `authSlice` resets it on logout. Coercing it to `''` trips
      // the shared `removeItem`'s "no pantry" guard, which returns early while
      // `goBack()` still runs — the screen dismissing with the item untouched
      // on the server.
      const deleteMock = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            __typename: 'DeletePantryItemPayload',
            pantryItem: { __typename: 'PantryItem', id: 'item-1' },
          },
        },
      });

      const { result } = setup(
        { selectedPantryId: null },
        { operationMocks: [deleteMock.mock] },
      );

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() =>
        expect(deleteMock.fired).toContainEqual({
          input: { id: 'item-1' },
          today: expect.any(String),
        }),
      );
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });

    it('does not pretend to delete when no pantry can be resolved at all', async () => {
      const deleteMock = recordMock(DeletePantryItemDocument, {});

      const { result } = setup(
        {
          selectedPantryId: null,
          item: { ...baseItem, pantryId: null },
        },
        { operationMocks: [deleteMock.mock] },
      );

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      // Nothing was deleted, so the screen must not behave as though it was.
      expect(deleteMock.fired).toEqual([]);
      expect(mockGoBack).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(alertService.alert).toHaveBeenLastCalledWith(
          'Error',
          expect.any(String),
        ),
      );
    });

    it('restores the row when the server refuses the delete', async () => {
      // `removeItem` evicts the row and drops the count BEFORE firing, so a
      // refusal has to put both back — that is what `refetch` is for. A no-op
      // `refetch: () => {}` leaves a refused delete gone locally and still
      // present on the server, with nothing to bring it back.
      //
      // A REFUSAL, not a transport failure: `errorPolicy: 'all'` resolves it as
      // DATA — a non-success union member — so it never reaches `onError`, and
      // the check sits on the resolved result. A transport failure is the
      // opposite case and must NOT restore, because the delete is queued for
      // replay (covered below).
      const refused = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            // Not a NotFoundError: a delete answered "not found" is already done.
            __typename: 'ConflictError',
            code: ErrorCode.Conflict,
            message: 'Item is referenced by an active meal plan',
          },
        },
      });

      const restore = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
      const { result } = setup({}, { operationMocks: [refused.mock] });

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() => expect(restore).toHaveBeenCalled());
      restore.mockRestore();
    });

    it('tells the user and stays put when the server refuses the delete', async () => {
      // Restoring the row silently is its own version of the bug this screen
      // keeps hitting: `removeItem` returns normally on a refusal (it is DATA,
      // not an error), so the catch never fires — the screen dismissed as
      // though the delete worked and the row simply reappeared in the list.
      const refused = recordMock(DeletePantryItemDocument, {
        data: {
          deletePantryItem: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
            message: 'You do not have permission to delete this item',
          },
        },
      });

      const restore = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
      const { result } = setup({}, { operationMocks: [refused.mock] });

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() =>
        expect(alertService.alert).toHaveBeenLastCalledWith(
          'Error',
          expect.any(String),
        ),
      );
      expect(mockGoBack).not.toHaveBeenCalled();
      restore.mockRestore();
    });

    it('keeps the local removal when the delete only failed to reach the server', async () => {
      // The offline case: `queueLink` has taken the delete for replay and
      // resolves it with a null payload, so the eviction must STAND. Restoring
      // here would resurrect a row the user already deleted.
      const offline = recordMock(DeletePantryItemDocument, {
        data: { deletePantryItem: null },
        partial: true,
      });

      const restore = jest.spyOn(ApolloClient.prototype, 'refetchQueries');
      const { result } = setup({}, { operationMocks: [offline.mock] });

      act(() => result.current.handleDelete());
      const alertCalls = (alertService.alert as jest.Mock).mock.calls;
      await act(async () => {
        alertCalls[alertCalls.length - 1][2][1].onPress();
      });

      await waitFor(() =>
        expect(removePantryItemLocally).toHaveBeenCalledWith(
          expect.anything(),
          'pantry-1',
          'item-1',
        ),
      );
      // Leaving the screen is the settled outcome; asserting before it passes
      // whether or not the refusal path restores.
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(restore).not.toHaveBeenCalled();
      restore.mockRestore();
    });
  });

  describe('handleAddToShoppingList', () => {
    it('invokes onAddToShoppingListNeedsList when no list is selected', async () => {
      const { result } = setup({ selectedShoppingListId: null });

      await act(async () => {
        await result.current.handleAddToShoppingList();
      });

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
        await result.current.handleAddToShoppingList();
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
        await result.current.handleAddToShoppingList();
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
        await result.current.handleAddToShoppingList();
      });

      expect(addMock.fired).toContainEqual(
        expect.objectContaining({
          input: expect.objectContaining({
            items: [expect.objectContaining({ unit: undefined })],
          }),
        }),
      );
    });

    it('tells the user and discards the row when the server refuses the add', async () => {
      const refused = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        data: {
          addItemsToShoppingList: {
            __typename: 'ForbiddenError',
            code: ErrorCode.Forbidden,
          },
        },
      });
      const { result } = setup({}, { operationMocks: [refused.mock] });

      await act(async () => {
        await result.current.handleAddToShoppingList();
      });

      expect(revertOptimisticShoppingListItem).toHaveBeenCalledWith(
        expect.anything(),
        'list-1',
        expect.any(String),
      );
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
      expect(result.current.addToListStatus).toBe('error');
    });

    it('tells the user when the add resolves with an error', async () => {
      const failed = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        error: new Error('boom'),
      });
      const { result } = setup({}, { operationMocks: [failed.mock] });

      await act(async () => {
        await result.current.handleAddToShoppingList();
      });

      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        expect.any(String),
      );
      expect(result.current.addToListStatus).toBe('error');
    });

    it('keeps a queued add on the list without an alert', async () => {
      const queued = recordMock(AddItemToShoppingListFromPantryItemDocument, {
        data: { addItemsToShoppingList: null },
        partial: true,
      });
      const { result } = setup({}, { operationMocks: [queued.mock] });

      await act(async () => {
        await result.current.handleAddToShoppingList();
      });

      expect(revertOptimisticShoppingListItem).not.toHaveBeenCalled();
      expect(alertService.alert).not.toHaveBeenCalled();
      expect(result.current.addToListStatus).toBe('success');
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

    it('formats the discarded quantity in the item-discard alert', () => {
      const { result } = setup({
        item: {
          ...baseItem,
          quantity: 1.25,
          unit: { ...baseItem.unit, displayAsFraction: true },
        },
      });

      act(() => result.current.handleDiscardExpired());

      expect(alertService.alert).toHaveBeenCalledWith(
        'Discard Expired Item',
        expect.stringContaining('remaining 1 1/4 cups'),
        expect.any(Array),
      );
    });

    it('rounds to three decimals for a unit that opts out of fractions', () => {
      const { result } = setup({
        item: {
          ...baseItem,
          quantity: 1.3333334,
          unit: { ...baseItem.unit, displayAsFraction: false },
        },
      });

      act(() => result.current.handleDiscardExpired());

      expect(alertService.alert).toHaveBeenCalledWith(
        'Discard Expired Item',
        expect.stringContaining('remaining 1.333 cups'),
        expect.any(Array),
      );
    });

    it('calls convertExpiredBatches on batch-discard confirm', async () => {
      const { result } = setup({
        item: { ...baseItem, activeBatchCount: 2 },
      });

      act(() => result.current.handleDiscardExpired());

      const discardButton = (alertService.alert as jest.Mock).mock
        .calls[0][2][1];
      await act(async () => discardButton.onPress());

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

    it('does nothing when item is null', () => {
      const { result } = setup({ item: null });

      act(() => result.current.handleCorrectWeight(100, 'r'));

      expect(mockCorrectWeight).not.toHaveBeenCalled();
    });
  });
});
