import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
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
    itemName: string;
    code: string;
    errorId?: string | null;
  }[];
}) {
  return recordMock(MovePurchasedItemsToPantryDocument, {
    data: {
      movePurchasedItemsToPantry: {
        __typename: 'MovePurchasedItemsToPantryPayload' as const,
        // Every line now in the pantry: the ones this call moved, plus the
        // already-stocked ones the server reports as skipped.
        movedItems: [
          ...payload.movedItemIds.map(id => ({
            __typename: 'MovedItemInfo' as const,
            shoppingListItemId: id,
          })),
          ...Array.from({ length: payload.skippedCount }, (_, i) => ({
            __typename: 'MovedItemInfo' as const,
            shoppingListItemId: `already-${i}`,
          })),
        ],
        failedItems: (payload.failedItems ?? []).map(item => ({
          __typename: 'FailedMoveInfo' as const,
          errorId: null,
          ...item,
        })),
        summary: {
          __typename: 'BulkSummary' as const,
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

/** The purchase record as a reading operation would have cached it. */
const PURCHASED_ROW_SEED = gql`
  fragment PurchasedRowSeed on ShoppingListItem {
    id
    purchaseInfo {
      isPurchased
      movedToPantryAt
      purchaseDate
      purchasedById
      purchasedPrice
      purchasedQuantity
      purchasedBy {
        id
      }
    }
  }
`;

/**
 * The rows the server reports as moved, cached the way the list query would
 * have cached them. `writePurchaseInfo` carries the CACHED record forward, so
 * a row the test never cached gets written back with three of its eight fields
 * — a purchase record no server response could produce.
 */
function cacheWithPurchasedRows(
  ids: string[] = ['item-1', 'item-2', 'item-3'],
) {
  return seedCache(
    ids.map(id => ({
      // The seed is checked against a REAL selection rather than one
      // synthesized from the fixture's own keys — a derived selection can
      // never be incomplete, so it cannot hold the seed to anything.
      fragment: PURCHASED_ROW_SEED,
      fragmentName: 'PurchasedRowSeed',
      data: {
        __typename: 'ShoppingListItem' as const,
        id,
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo' as const,
          isPurchased: true,
          movedToPantryAt: null,
          purchaseDate: null,
          purchasedById: null,
          purchasedPrice: null,
          purchasedQuantity: null,
          purchasedBy: null,
        },
      },
    })),
  );
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      'Those 3 items are already in your pantry',
    );
  });

  // Since the move began stamping the lines it moves, a second press with
  // nothing newly purchased reports every bucket empty. That is the ordinary
  // steady state, not a failure, and must not read like one.
  it('says everything purchased is already stocked when every bucket is empty', async () => {
    const move = moveMock({
      movedCount: 0,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: [],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      'Everything purchased is already in your pantry',
    );
  });

  it('still says nothing moved when lines failed and none moved', async () => {
    const move = moveMock({
      movedCount: 0,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: [],
      failedItems: [{ itemName: 'bread', code: 'VALIDATION_FAILED' }],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
          itemName: 'bread',
          code: 'VALIDATION_FAILED',
          errorId: 'log-42',
        },
      ],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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

  it('records WHY lines failed, which the user is never shown', async () => {
    const { Telemetry } = require('#/services/telemetry');
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
      failedItems: [
        { itemName: 'bread', code: 'VALIDATION_FAILED', errorId: 'log-42' },
        { itemName: 'milk', code: 'INTERNAL_ERROR', errorId: 'log-43' },
        { itemName: 'eggs', code: 'VALIDATION_FAILED', errorId: null },
      ],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // A count cannot tell a refusal from a database fault, and the screen shows
    // neither — so without this the only record of a failed move is a number.
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'batch_move_purchased_to_pantry',
      expect.objectContaining({
        failed_count: 3,
        // Distinct and sorted: three failures, two causes.
        failed_codes: 'INTERNAL_ERROR,VALIDATION_FAILED',
        // Only the ids that exist, so a null cannot become an empty slot.
        failed_error_ids: 'log-42,log-43',
      }),
    );
  });

  it('surfaces an alert and skips onSuccess when the server resolves an error member', async () => {
    const mockOnSuccess = jest.fn();
    const move = recordMock(MovePurchasedItemsToPantryDocument, {
      data: {
        movePurchasedItemsToPantry: {
          __typename: 'ForbiddenError' as const,
          code: ErrorCode.Forbidden,
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
   * meaning is encoded. Treating it as a failure only holds for an online-only
   * move, where a null result can mean nothing else.
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
      { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
     * The batch is local-first, not an offline refusal with a toast: the
     * client mints a pantry-row id per purchased line (`pantryItemIds`), so a
     * replay resolves to the same rows rather than creating a second set.
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
        { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
        { operationMocks: [move.mock], cache: cacheWithPurchasedRows() },
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
   * The hook must not remove the purchased edges eagerly AND let the
   * mutation's `update` callback remove them again on the response. Filtering
   * edges twice is idempotent; subtracting the count twice is not.
   */
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
        __typename: 'ShoppingList' as const,
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
    // them is `deleteShoppingListItems(purchased: true)`, a separate act. A
    // client that filters the edges and subtracts the counts anyway gets the
    // rows back on the next fetch, with the totals disagreeing with them.
    expect(readCounts(cache)).toEqual(
      expect.objectContaining({ totalItems: 10, completedItems: 4 }),
    );
  });

  it('leaves the counters untouched when the server refuses', async () => {
    const cache = seededCache();
    const refused = recordMock(MovePurchasedItemsToPantryDocument, {
      data: {
        movePurchasedItemsToPantry: {
          __typename: 'ValidationError' as const,
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

    // Nothing is written ahead of the response, so there is nothing to restore
    // — which is why this hook needs no restore path.
    expect(readCounts(cache)).toEqual(
      expect.objectContaining({ totalItems: 10, completedItems: 4 }),
    );
  });
});

describe('moved lines are marked stocked in the cache', () => {
  const STOCKED = gql`
    fragment StockedProbe on ShoppingListItem {
      id
      purchaseInfo {
        isPurchased
        movedToPantryAt
        purchaseDate
        purchasedById
        purchasedPrice
        purchasedQuantity
        purchasedBy {
          id
        }
      }
    }
  `;

  function seededCache() {
    const { makeCache } = require('#/apollo/cache');
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingListItem:item-1',
      fragment: STOCKED,
      data: {
        __typename: 'ShoppingListItem' as const,
        id: 'item-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo' as const,
          isPurchased: true,
          movedToPantryAt: null,
          // Present so the merge's clearing behaviour is observable below.
          purchasedQuantity: 3,
          purchasedPrice: null,
          purchaseDate: null,
          purchasedById: null,
          purchasedBy: null,
        },
      },
    });
    return cache;
  }

  const read = (cache: { readFragment: Function }) =>
    cache.readFragment({
      id: 'ShoppingListItem:item-1',
      fragment: STOCKED,
    }) as {
      purchaseInfo: {
        movedToPantryAt: string | null;
        purchasedQuantity: number | null;
      };
    } | null;

  it('stamps the moved line so its row stops offering the action', async () => {
    const cache = seededCache();
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // Without this the row keeps its move-to-pantry button until a refetch,
    // promising an action the server will not act on.
    expect(read(cache)?.purchaseInfo.movedToPantryAt).toEqual(
      expect.any(String),
    );
  });

  it('keeps the server stamp on a line an earlier call already moved', async () => {
    const cache = seededCache();
    const SERVER_STAMP = '2026-08-01T09:00:00.000Z';
    cache.writeFragment({
      id: 'ShoppingListItem:item-1',
      fragment: STOCKED,
      data: {
        __typename: 'ShoppingListItem' as const,
        id: 'item-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo' as const,
          isPurchased: true,
          movedToPantryAt: SERVER_STAMP,
          purchasedQuantity: 3,
          purchasedPrice: null,
          purchaseDate: null,
          purchasedById: null,
          purchasedBy: null,
        },
      },
    });

    // The payload lists every line now in the pantry, including ones an earlier
    // call moved. Those carry the real time they were stocked, so the local
    // placeholder must not replace it — the stamp would otherwise jump forward
    // on every press of a button that did nothing.
    const move = moveMock({
      movedCount: 0,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    expect(read(cache)?.purchaseInfo.movedToPantryAt).toBe(SERVER_STAMP);
  });

  it('leaves the rest of the purchase record alone', async () => {
    const cache = seededCache();
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // `ShoppingListItemPurchaseInfo` clears every omitted field when
    // `isPurchased` CHANGES. This write keeps it true, so the merge takes the
    // mergeObjects path and the amounts survive — the property that makes
    // writing one field of this record safe at all.
    expect(read(cache)?.purchaseInfo.purchasedQuantity).toBe(3);
  });
});

describe('the write-back cannot clear the purchase record', () => {
  const RECORD = gql`
    fragment BatchRecordProbe on ShoppingListItem {
      id
      purchaseInfo {
        isPurchased
        movedToPantryAt
        purchaseDate
        purchasedById
        purchasedPrice
        purchasedQuantity
        purchasedBy {
          id
        }
      }
    }
  `;

  /**
   * The client's cached flag says un-purchased while the server still considers
   * the line purchased and moves it: the user un-checked it offline (queued),
   * or un-checked it while the batch was in flight.
   */
  function seedLocallyUnpurchased() {
    const { makeCache } = require('#/apollo/cache');
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingListItem:item-1',
      fragment: RECORD,
      data: {
        __typename: 'ShoppingListItem' as const,
        id: 'item-1',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo' as const,
          isPurchased: false,
          movedToPantryAt: null,
          purchasedQuantity: 7,
          purchasedPrice: 4.5,
          purchaseDate: null,
          purchasedById: null,
          purchasedBy: null,
        },
      },
    });
    return cache;
  }

  const read = (cache: { readFragment: Function }) =>
    (
      cache.readFragment({
        id: 'ShoppingListItem:item-1',
        fragment: RECORD,
        returnPartialData: true,
      }) as {
        purchaseInfo: {
          purchasedQuantity: number | null;
          purchasedPrice: number | null;
        };
      } | null
    )?.purchaseInfo;

  it('keeps the recorded amounts when the cached flag disagrees with the server', async () => {
    const cache = seedLocallyUnpurchased();
    const move = moveMock({
      movedCount: 1,
      skippedCount: 0,
      targetPantryName: 'My Pantry',
      movedItemIds: ['item-1'],
    });

    const { result } = renderHookWithApollo(
      () =>
        useBatchMoveToPantry({ currentListId: 'list-1', purchasedItems: [] }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.batchMoveToPantry();
    });

    // Asserting `isPurchased: true` over a cached `false` flips it, and the
    // record's merge clears every field the write omits. The quantity and price
    // belong to a purchase the server recorded; losing them is data loss.
    expect(read(cache)?.purchasedQuantity).toBe(7);
    expect(read(cache)?.purchasedPrice).toBe(4.5);
  });
});
