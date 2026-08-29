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
  /** Lines an earlier call had already moved — `summary.skipped`. */
  skippedCount: number;
  targetPantryName: string;
  movedItemIds: string[];
  /** Lines that errored — `summary.failed`, itemised in `failedItems`. */
  failedItems?: {
    shoppingListItemId: string;
    itemName: string;
    reason: string;
  }[];
}) {
  return recordMock(MovePurchasedItemsToPantryDocument, {
    data: {
      movePurchasedItemsToPantry: {
        __typename: 'MovePurchasedItemsToPantryPayload',
        failedItems: (payload.failedItems ?? []).map(item => ({
          __typename: 'FailedMoveInfo',
          ...item,
        })),
        summary: {
          __typename: 'BulkSummary',
          total:
            payload.movedCount +
            payload.skippedCount +
            (payload.failedItems?.length ?? 0),
          succeeded: payload.movedCount,
          failed: payload.failedItems?.length ?? 0,
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

  // `summary.skipped` now means "an earlier call already moved this line", not
  // "this line could not be moved" — the opposite of a problem, so the copy says
  // so instead of calling it skipped.
  it('names already-stocked lines as already there, not skipped', async () => {
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
      'Moved 2 items to pantry (1 was already there)',
    );
  });

  // A repeat call on an unchanged list reports `succeeded: 0` with everything in
  // `skipped`. That is the list already being stocked, not a failure — saying
  // "no items could be moved" would read as something going wrong.
  it('says everything is already stocked when nothing was left to move', async () => {
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
      'Those 3 items are already in your pantry',
    );
  });

  it('still says nothing moved when there was genuinely nothing', async () => {
    const move = moveMock({
      movedCount: 0,
      skippedCount: 0,
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

  it('reports lines that failed, by name, without showing the server reason', async () => {
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
      failedItems: [
        {
          shoppingListItemId: 'item-9',
          itemName: 'bread',
          reason: 'Shopping list item needs a name before it can be moved',
        },
      ],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // The item name is the user's own words; `reason` is an unlocalizable
    // server string and must not reach the screen.
    expect(mockToastError).toHaveBeenCalledWith("Couldn't move bread");
    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining('needs a name'),
    );
    // A partial success still reports what did land.
    expect(mockToastSuccess).toHaveBeenCalledWith('Moved 1 item to pantry');
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
        already_in_pantry_count: 1,
        failed_count: 0,
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
  it('treats a null payload as queued: reports pending, not a count, and succeeds', async () => {
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
    // The client cannot know how many rows the server will move: the input
    // carries only the list id, while `purchasedItems` is the slice on screen.
    // Claiming a count here was right only when the whole list was loaded.
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/back online/i),
    );
    expect(mockToastSuccess).not.toHaveBeenCalledWith(
      expect.stringMatching(/\b1 item\b/i),
    );
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

describe('counters are adjusted exactly once', () => {
  /**
   * Every test above passes `purchasedItems: []`, which takes an early return
   * before reaching the code under test. These pass a real slice.
   *
   * The hook used to remove the purchased edges eagerly AND let the mutation's
   * `update` callback remove them again on the response. Filtering edges twice
   * is idempotent; subtracting the count twice is not.
   */
  const { gql } = require('@apollo/client');
  const COUNTS = gql`
    fragment ShoppingListCounts on ShoppingList {
      id
      totalItems
      completedItems
    }
  `;

  function seededCache() {
    const { makeCache } = require('#/apollo/cache');
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingList:list-1',
      fragment: COUNTS,
      data: {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 10,
        completedItems: 4,
      },
    });
    return cache;
  }

  function readCounts(cache: { readFragment: Function }) {
    return cache.readFragment({
      id: 'ShoppingList:list-1',
      fragment: COUNTS,
    }) as { totalItems: number; completedItems: number } | null;
  }

  const purchased = [
    { id: 'item-1' },
    { id: 'item-2' },
    { id: 'item-3' },
    { id: 'item-4' },
  ];

  it('leaves the list counters alone — the server keeps the lines it moves', async () => {
    const cache = seededCache();
    const move = moveMock({
      movedCount: 4,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1', 'item-2', 'item-3', 'item-4'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          purchasedItems: purchased,
        }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // `movePurchasedItemsToPantry` never removes the lines it moves — clearing
    // them is `deleteShoppingListItems(purchased: true)`, a separate act. The
    // client used to filter the edges and subtract the counts anyway, so the
    // rows came back on the next fetch and the totals disagreed with them.
    expect(readCounts(cache)).toEqual(
      expect.objectContaining({ totalItems: 10, completedItems: 4 }),
    );
  });

  it('leaves the counters untouched when the server refuses', async () => {
    const cache = seededCache();
    const refused = recordMock(MovePurchasedItemsToPantryDocument, {
      data: {
        movePurchasedItemsToPantry: {
          __typename: 'ValidationError',
          message: 'nope',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({
          currentListId: 'list-1',
          purchasedItems: purchased,
        }),
      { operationMocks: [refused.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // Nothing was written ahead of the response, so there is nothing to restore
    // — which is why this hook no longer needs a restore path it did not have.
    expect(readCounts(cache)).toEqual(
      expect.objectContaining({ totalItems: 10, completedItems: 4 }),
    );
  });
});
