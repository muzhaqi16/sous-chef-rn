import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MovePurchasedItemsToPantryDocument } from '../useBatchMoveToPantry.generated';
import { useStore } from '#store';
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

jest.mock('#/utils/compilerSafeWrappers');

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
        result: {
          __typename: 'MovePurchasedItemsResult',
          movedCount: payload.movedCount,
          skippedCount: payload.skippedCount,
          targetPantryName: payload.targetPantryName,
          movedItems: payload.movedItemIds.map(id => ({
            __typename: 'MovedItemInfo',
            shoppingListItemId: id,
          })),
        },
      },
    },
  });
}

describe('useBatchMoveToPantry', () => {
  it('returns batchMoveToPantry function and loading state', () => {
    const { result } = renderHookWithApollo(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.batchMoveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('shows error toast when no list is selected', async () => {
    const { result } = renderHookWithApollo(() =>
      useBatchMoveToPantry({ currentListId: undefined }),
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
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
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
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 3 items to My Pantry');
  });

  it('shows success toast with singular item text', async () => {
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 1 item to My Pantry');
  });

  it('includes skipped count in toast when items were skipped', async () => {
    const move = moveMock({
      movedCount: 2,
      skippedCount: 1,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2'],
    });

    const { result } = renderHookWithApollo(
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 2 items to My Pantry (1 skipped)',
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
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
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
      () => useBatchMoveToPantry({ currentListId: 'list-1' }),
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

  it('does not call onSuccess when mutation returns no data', async () => {
    const mockOnSuccess = jest.fn();
    const move = recordMock(MovePurchasedItemsToPantryDocument, {
      data: { movePurchasedItemsToPantry: null },
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          onSuccess: mockOnSuccess,
        }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    it('exposes isApiUnavailable, toasts, and does not fire the mutation', async () => {
      useStore.setState({ apiReachable: false });
      const move = moveMock({
        movedCount: 1,
        skippedCount: 0,
        targetPantryName: 'My Pantry',
        movedItemIds: ['item-1'],
      });

      const { result } = renderHookWithApollo(
        () => useBatchMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(true);

      await act(async () => {
        await result.current.batchMoveToPantry();
      });

      expect(mockToastError).toHaveBeenCalledWith('Not available offline');
      expect(move.fired).toHaveLength(0);
    });

    it('fires the mutation normally when online', async () => {
      const move = moveMock({
        movedCount: 1,
        skippedCount: 0,
        targetPantryName: 'My Pantry',
        movedItemIds: ['item-1'],
      });

      const { result } = renderHookWithApollo(
        () => useBatchMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      expect(result.current.isApiUnavailable).toBe(false);

      await act(async () => {
        await result.current.batchMoveToPantry();
      });

      expect(move.fired).toHaveLength(1);
    });
  });
});
