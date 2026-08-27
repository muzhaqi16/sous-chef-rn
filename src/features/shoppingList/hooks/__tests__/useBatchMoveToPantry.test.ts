import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MovePurchasedItemsToPantryDocument } from '../useBatchMoveToPantry.generated';
import { useBatchMoveToPantry } from '../useBatchMoveToPantry';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

const mockAlert = jest.fn();
jest.mock('#/services/alertService', () => ({
  alertService: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('#/utils/finallyHelpers');

beforeEach(() => {
  jest.clearAllMocks();
});

function moveMock(payload: {
  movedCount: number;
  skippedCount: number;
  targetPantryName: string;
  movedItemIds: string[];
}) {
  return recordMock(MovePurchasedItemsToPantryDocument, {
    data: {
      movePurchasedItemsToPantry: {
        __typename: 'MovePurchasedItemsToPantryPayload',
        movedItems: payload.movedItemIds.map(id => ({
          __typename: 'MovedItemInfo',
          shoppingListItemId: id,
          pantryItemId: `pantry-${id}`,
          itemName: id,
          quantity: 1,
        })),
        summary: {
          __typename: 'BulkSummary',
          total: payload.movedCount + payload.skippedCount,
          succeeded: payload.movedCount,
          failed: 0,
          skipped: payload.skippedCount,
        },
      },
    },
  });
}

describe('useBatchMoveToPantry', () => {
  it('returns batchMoveToPantry function and loading state', () => {
    const { result } = renderHookWithApollo(() =>
      useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
    );

    expect(typeof result.current.batchMoveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('shows error toast when no list is selected', async () => {
    const { result } = renderHookWithApollo(() =>
      useBatchMoveToPantry({ currentListId: undefined, purchasedItems: [] }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastError).toHaveBeenCalledWith('No shopping list selected');
  });

  it('calls mutation with correct variables', async () => {
    const move = moveMock({
      movedCount: 3,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2', 'item-3'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(move.fired).toContainEqual({ input: { shoppingListId: 'list-1' } });
  });

  it('shows success toast with moved count', async () => {
    const move = moveMock({
      movedCount: 3,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2', 'item-3'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 3 items to pantry');
  });

  it('shows success toast with singular item text', async () => {
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 1 item to pantry');
  });

  it('includes skipped count in toast when items were skipped', async () => {
    const move = moveMock({
      movedCount: 2,
      skippedCount: 1,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 2 items to pantry (1 skipped)',
    );
  });

  it('shows info toast when no items could be moved', async () => {
    const move = moveMock({
      movedCount: 0,
      skippedCount: 3,
      targetPantryName: 'My Pantry',
      movedItemIds: [],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      'No items could be moved to pantry',
    );
  });

  it('calls onSuccess callback after successful move', async () => {
    const mockOnSuccess = jest.fn();
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          purchasedItems: [],
          onSuccess: mockOnSuccess,
        }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('tracks telemetry event', async () => {
    const { Telemetry } = require('#/services/telemetry');
    const move = moveMock({
      movedCount: 2,
      skippedCount: 1,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'batch_move_purchased_to_pantry',
      expect.objectContaining({
        shopping_list_id: 'list-1',
        moved_count: 2,
        skipped_count: 1,
      }),
    );
  });

  it('surfaces an alert and skips onSuccess when the server resolves an error member', async () => {
    const mockOnSuccess = jest.fn();
    const move = recordMock(MovePurchasedItemsToPantryDocument, {
      data: {
        movePurchasedItemsToPantry: {
          __typename: 'ForbiddenError',
          code: 'FORBIDDEN',
          message: 'Not allowed',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          purchasedItems: [],
          onSuccess: mockOnSuccess,
        }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockAlert).toHaveBeenCalled();
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  /**
   * A null payload with no error is how the offline queue reports a QUEUED
   * mutation, not a failure — `classifyCreateResult` is the single place that
   * meaning is encoded. This used to assert the opposite, which was right when
   * the batch move was online-only and a null result could only mean something
   * had gone wrong.
   */
  it('treats a null payload as queued: reports the local count and succeeds', async () => {
    const mockOnSuccess = jest.fn();
    const move = recordMock(MovePurchasedItemsToPantryDocument, {
      data: { movePurchasedItemsToPantry: null },
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          purchasedItems: [{ id: 'item-1' }],
          onSuccess: mockOnSuccess,
        }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  describe('when the API is unavailable', () => {
    /**
     * Used to refuse with a toast. The batch is local-first now: the client
     * mints a pantry-row id per purchased line (`pantryItemIds`), so a replay
     * resolves to the same rows rather than creating a second set.
     */
    it('still fires the mutation, so the queue can replay it', async () => {
      const move = moveMock({
        movedCount: 1,
        skippedCount: 0,
        targetPantryName: 'My Pantry',
        movedItemIds: ['item-1'],
      });

      const { result } = renderHookWithApollo(
        () =>
          useBatchMoveToPantry({
            currentListId: 'list-1',
            purchasedItems: [{ id: 'item-1' }],
          }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.batchMoveToPantry();
      });

      expect(move.fired).toHaveLength(1);
      expect(mockToastError).not.toHaveBeenCalledWith('Not available offline');
    });

    it('sends one client-minted id hint per purchased line', async () => {
      const move = moveMock({
        movedCount: 2,
        skippedCount: 0,
        targetPantryName: 'My Pantry',
        movedItemIds: ['item-1', 'item-2'],
      });

      const { result } = renderHookWithApollo(
        () =>
          useBatchMoveToPantry({
            currentListId: 'list-1',
            purchasedItems: [{ id: 'item-1' }, { id: 'item-2' }],
          }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.batchMoveToPantry();
      });

      const input = move.fired[0]?.input as {
        pantryItemIds?: { shoppingListItemId: string; pantryItemId: string }[];
      };
      expect(input.pantryItemIds).toHaveLength(2);
      expect(input.pantryItemIds?.map(h => h.shoppingListItemId)).toEqual([
        'item-1',
        'item-2',
      ]);
      // Distinct ids — one row per line, not one row reused.
      expect(new Set(input.pantryItemIds?.map(h => h.pantryItemId)).size).toBe(
        2,
      );
    });
  });
});
