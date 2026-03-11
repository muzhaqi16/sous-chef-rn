import { renderHook, act } from '@testing-library/react-native';
import { useBatchMoveToPantry } from '../useBatchMoveToPantry';

// --- Mocks ---

const mockMovePurchasedMutation = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useMovePurchasedItemsToPantryMutation: () => [
    mockMovePurchasedMutation,
    { loading: false },
  ],
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
    info: (...args: any[]) => mockToastInfo(...args),
  },
}));

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBatchMoveToPantry', () => {
  it('returns batchMoveToPantry function and loading state', () => {
    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.batchMoveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('shows error toast when no list is selected', async () => {
    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: undefined }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastError).toHaveBeenCalledWith('No shopping list selected');
    expect(mockMovePurchasedMutation).not.toHaveBeenCalled();
  });

  it('calls mutation with correct variables', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 3,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
            { shoppingListItemId: 'item-3' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockMovePurchasedMutation).toHaveBeenCalledWith({
      variables: { shoppingListId: 'list-1' },
    });
  });

  it('shows success toast with moved count', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 3,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
            { shoppingListItemId: 'item-3' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 3 items to My Pantry',
    );
  });

  it('shows success toast with singular item text', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 1,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [{ shoppingListItemId: 'item-1' }],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 1 item to My Pantry',
    );
  });

  it('includes skipped count in toast when items were skipped', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 2,
          skippedCount: 1,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Moved 2 items to My Pantry (1 skipped)',
    );
  });

  it('shows info toast when no items could be moved', async () => {
    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 0,
          skippedCount: 3,
          targetPantryName: 'My Pantry',
          movedItems: [],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
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

    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 1,
          skippedCount: 0,
          targetPantryName: 'My Pantry',
          movedItems: [{ shoppingListItemId: 'item-1' }],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({
        currentListId: 'list-1',
        onSuccess: mockOnSuccess,
      }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('tracks telemetry event', async () => {
    const { Telemetry } = require('#/services/telemetry');

    mockMovePurchasedMutation.mockResolvedValue({
      data: {
        movePurchasedItemsToPantry: {
          movedCount: 2,
          skippedCount: 1,
          targetPantryName: 'My Pantry',
          movedItems: [
            { shoppingListItemId: 'item-1' },
            { shoppingListItemId: 'item-2' },
          ],
        },
      },
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({ currentListId: 'list-1' }),
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

  it('does not call onSuccess when mutation returns no data', async () => {
    const mockOnSuccess = jest.fn();

    mockMovePurchasedMutation.mockResolvedValue({
      data: null,
    });

    const { result } = renderHook(() =>
      useBatchMoveToPantry({
        currentListId: 'list-1',
        onSuccess: mockOnSuccess,
      }),
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });
});
