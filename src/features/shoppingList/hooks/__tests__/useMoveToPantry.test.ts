import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { StorageState } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useStore } from '#store';
import { useMoveToPantry } from '../useMoveToPantry';

jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackEvent: jest.fn(),
    // errorService.reportError routes through this on the failure path.
    trackError: jest.fn(),
  },
}));

// Spread the real module: a partial factory silently omits whatever the hook
// imports NEXT — the local-first move added two more updaters, and a trimmed
// mock fails at import time with "is not a function" rather than at the
// assertion. See the module's other consumers before narrowing this.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/shoppingListCacheUpdaters'),
  removeItemFromShoppingListForMoveToPantry: jest.fn(),
  restoreItemToShoppingListAfterMoveToPantry: jest.fn(),
}));

jest.mock('#/utils/finallyHelpers');

beforeEach(() => {
  jest.clearAllMocks();
});

function createItem(
  overrides: Partial<ShoppingListItemDisplayFragment> = {},
): ShoppingListItemDisplayFragment {
  return {
    __typename: 'ShoppingListItem' as const,
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    // Complete, because production is: the list query caches the whole
    // purchase record, and `writePurchaseInfo` carries forward exactly what
    // the cache holds. Seeding only `isPurchased` makes the carry-forward
    // write a partial record no server response could produce.
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
    version: 1,
    ...overrides,
  } as Partial<ShoppingListItemDisplayFragment> as ShoppingListItemDisplayFragment;
}

function moveMock() {
  return recordMock(MoveShoppingItemToPantryDocument, {
    data: {
      moveShoppingItemToPantry: {
        __typename: 'MoveShoppingItemToPantryPayload' as const,
        pantryItem: { __typename: 'PantryItem' as const, id: 'pantry-item-1' },
      },
    },
  });
}

describe('useMoveToPantry', () => {
  it('returns moveToPantry function and loading state', () => {
    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.moveToPantry).toBe('function');
    expect(result.current.loading).toBe(false);
  });

  it('calls mutation with correct variables', async () => {
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    let moveResult: boolean = false;
    await act(async () => {
      moveResult = await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(move.fired).toContainEqual({
      // objectContaining: the input also carries a minted `pantryItemId` and an
      // `idempotencyKey`, both generated, both asserted separately above.
      input: expect.objectContaining({
        shoppingListItemId: 'item-1',
        pantryId: 'pantry-1',
        actualQuantity: 2,
        actualUnitId: undefined,
        storageState: undefined,
        expiresAt: undefined,
        removeFromList: true,
        actualPrice: undefined,
        notes: undefined,
      }),
    });
    expect(moveResult).toBe(true);
  });

  it('passes optional fields to mutation', async () => {
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      // Seeded because the row being moved is one the list query already
      // cached; `writePurchaseInfo` carries the cached record forward, so an
      // unseeded cache makes it write a purchase record with three of its
      // eight fields.
      { operationMocks: [move.mock], cache: seedCache([createItem()]) },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 3,
        actualUnitId: 'unit-2',
        storageState: StorageState.Frozen,
        expiresAt: '2024-12-31',
        removeFromList: false,
        actualPrice: 5.99,
        notes: 'Keep frozen',
      });
    });

    expect(move.fired).toContainEqual({
      input: expect.objectContaining({
        actualUnitId: 'unit-2',
        storageState: 'FROZEN',
        expiresAt: '2024-12-31',
        removeFromList: false,
        actualPrice: 5.99,
        notes: 'Keep frozen',
      }),
    });
  });

  // `errorPolicy: 'all'` resolves a transport failure with `error` set rather
  // than rejecting, so this drives the outcome the app actually gets.
  it('returns false when the move fails', async () => {
    const failing = recordMock(MoveShoppingItemToPantryDocument, {
      error: new Error('network down'),
    });

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [failing.mock] },
    );

    let moveResult: boolean = false;
    await act(async () => {
      moveResult = await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 1,
        removeFromList: true,
      });
    });

    expect(moveResult).toBe(false);
  });

  it('accepts onSuccess callback', () => {
    const mockOnSuccess = jest.fn();
    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1', onSuccess: mockOnSuccess }),
    );

    expect(typeof result.current.moveToPantry).toBe('function');
  });

  it('tracks telemetry event on successful move', async () => {
    const { Telemetry } = require('#/services/telemetry');
    const move = moveMock();

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock] },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 1,
        removeFromList: true,
      });
    });

    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'shopping_item_moved_to_pantry',
      expect.objectContaining({
        shopping_list_id: 'list-1',
        pantry_id: 'pantry-1',
        remove_from_list: true,
      }),
    );
  });

  describe('when the API is unavailable', () => {
    afterEach(() => {
      useStore.setState({ apiReachable: true, isOnline: true });
    });

    /**
     * The move used to refuse offline with a toast. It is local-first now: the
     * client mints `input.pantryItemId`, so the row it writes to the cache and
     * the row the server writes are the same entity, and the queue can replay.
     */
    it('still fires the mutation, so the queue can replay it', async () => {
      useStore.setState({ apiReachable: false });
      const errorSpy = jest.spyOn(toastService, 'error');
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      expect(move.fired).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalledWith('Not available offline');
    });

    it('mints the pantry row id and opts into the offline queue', async () => {
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      const input = move.fired[0]?.input as {
        pantryItemId?: string;
        idempotencyKey?: string;
      };
      // Without a client-minted id the optimistic row and the server row would
      // be two different entities, which is what kept this online-only.
      expect(input.pantryItemId).toEqual(expect.any(String));
      expect(input.idempotencyKey).toEqual(expect.any(String));
    });

    it('unlinks the shopping row eagerly, without evicting it', async () => {
      // Offline neither the mutation's `update` callback nor the replay runs
      // one, so a removal left to `update` never happened: the server deleted
      // the line while the client kept rendering it in the list and in both
      // counters until a full refetch. It has to be unlinked here — and NOT
      // evicted, because a permanently-refused replay has to put it back.
      useStore.setState({ apiReachable: false });
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      expect(removeItemFromShoppingListForMoveToPantry).toHaveBeenCalledWith(
        expect.anything(),
        'list-1',
        'item-1',
        expect.any(Boolean),
        { evictEntity: false },
      );
    });

    it('leaves the row alone when the move keeps it on the list', async () => {
      useStore.setState({ apiReachable: false });
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock], cache: seedCache([createItem()]) },
      );

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: false,
        });
      });

      expect(removeItemFromShoppingListForMoveToPantry).not.toHaveBeenCalled();
    });

    it('fires the mutation normally when online', async () => {
      const move = moveMock();
      const { result } = renderHookWithApollo(
        () => useMoveToPantry({ currentListId: 'list-1' }),
        { operationMocks: [move.mock] },
      );

      await act(async () => {
        await result.current.moveToPantry(createItem(), {
          pantryId: 'pantry-1',
          actualQuantity: 2,
          removeFromList: true,
        });
      });

      expect(move.fired).toHaveLength(1);
    });
  });
});

describe('useMoveToPantry pantry item count', () => {
  /**
   * The eager write publishes a pantry row before the server answers. The count
   * beside those rows has to move with it: offline the mutation's `update`
   * callback never runs, so nothing else will correct it and the header then
   * contradicts the rows underneath. `usePantryScreen` also branches on this
   * value to choose server vs client sorting.
   */
  const { gql } = require('@apollo/client');
  const STATS_FRAGMENT = gql`
    fragment PantryStatsProbe on Pantry {
      id
      stats {
        totalItems
      }
    }
  `;

  function seededCache() {
    const { makeCache } = require('#/apollo/cache');
    const cache = makeCache();
    cache.writeFragment({
      id: 'Pantry:pantry-1',
      fragment: STATS_FRAGMENT,
      data: {
        __typename: 'Pantry' as const,
        id: 'pantry-1',
        stats: { __typename: 'PantryStats' as const, totalItems: 63 },
      },
    });
    return cache;
  }

  function readTotal(cache: { readFragment: Function }) {
    return (
      cache.readFragment({
        id: 'Pantry:pantry-1',
        fragment: STATS_FRAGMENT,
      }) as { stats: { totalItems: number } } | null
    )?.stats.totalItems;
  }

  /**
   * Echoes the client-minted id, which is the ordinary case: the server accepted
   * the row we published. When it answers with a DIFFERENT id it restocked an
   * existing stack instead, and the hook evicts its optimistic row — that path
   * has its own expectation below.
   */
  function echoingMoveMock() {
    return recordMock(MoveShoppingItemToPantryDocument, {
      data: (vars: Record<string, unknown>) => ({
        moveShoppingItemToPantry: {
          __typename: 'MoveShoppingItemToPantryPayload' as const,
          pantryItem: {
            __typename: 'PantryItem' as const,
            id: (vars.input as { pantryItemId: string }).pantryItemId,
          },
        },
      }),
    });
  }

  it('increments the pantry item count alongside the row it adds', async () => {
    const cache = seededCache();
    const move = echoingMoveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(readTotal(cache)).toBe(64);
  });

  it('withdraws the count when the move is refused', async () => {
    const cache = seededCache();
    const rejected = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ValidationError' as const,
          message: 'nope',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [rejected.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(readTotal(cache)).toBe(63);
  });

  it('puts the shopping row back when the move is refused', async () => {
    // Both sides were written before firing, so both are undone. The row was
    // unlinked rather than evicted, which is what leaves an entity to re-link.
    const cache = seededCache();
    const rejected = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ValidationError' as const,
          message: 'nope',
          field: 'shoppingListItemId',
        },
      },
    });

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [rejected.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(restoreItemToShoppingListAfterMoveToPantry).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
    );
  });

  it('withdraws the count when the server supersedes the optimistic row', async () => {
    const cache = seededCache();
    // A different id means the server restocked an existing stack; the hook
    // evicts the row it published, so the count it added must go with it.
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(readTotal(cache)).toBe(63);
  });
});
