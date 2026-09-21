import { act } from '@testing-library/react-native';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
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
} from '#features/shoppingList/cache/moveToPantry';
import { useStore } from '#store';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { useMoveToPantry } from '../useMoveToPantry';

// Spread the real module: a partial factory silently omits whatever the hook
// imports NEXT — the local-first move added two more updaters, and a trimmed
// mock fails at import time with "is not a function" rather than at the
// assertion. See the module's other consumers before narrowing this.
jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#features/shoppingList/cache/moveToPantry', () => ({
  ...jest.requireActual('#features/shoppingList/cache/moveToPantry'),
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
    __typename: 'ShoppingListItem',
    id: 'item-1',
    itemName: 'Milk',
    quantity: 2,
    // Complete, because production is: the list query caches the whole
    // purchase record, and `writePurchaseInfo` carries forward exactly what
    // the cache holds. Seeding only `isPurchased` makes the carry-forward
    // write a partial record no server response could produce.
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
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
        __typename: 'MoveShoppingItemToPantryPayload',
        pantryItem: { __typename: 'PantryItem', id: 'pantry-item-1' },
      },
    },
  });
}

describe('useMoveToPantry', () => {
  it('returns moveToPantry function', () => {
    const { result } = renderHookWithApollo(() =>
      useMoveToPantry({ currentListId: 'list-1' }),
    );

    expect(typeof result.current.moveToPantry).toBe('function');
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

  it('tells the shopper when the server refuses the move', async () => {
    // A refusal resolves 200 with no `error`, so nothing else surfaces it — and
    // a target whose unit changed mid-move now comes back exactly this way.
    const conflicted = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ConflictError',
          message: 'Pantry item was modified',
          code: ErrorCode.Conflict,
        },
      },
    });
    const alertSpy = jest.spyOn(alertService, 'alert');

    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [conflicted.mock] },
    );

    let moveResult: boolean = true;
    await act(async () => {
      moveResult = await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 1,
        removeFromList: true,
      });
    });

    expect(moveResult).toBe(false);
    // `CONFLICT` is a state refusal, not a stale version: one alert, described
    // by its code rather than as "updated by another user".
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith(
      t('labels.error'),
      expect.any(String),
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      getVersionConflictMessage(),
    );
    expect(alertSpy).not.toHaveBeenCalledWith(
      expect.anything(),
      'Pantry item was modified',
    );
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
     * The move is local-first, not an offline refusal with a toast: the client
     * mints `input.pantryItemId`, so the row it writes to the cache and the row
     * the server writes are the same entity, and the queue can replay.
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
        __typename: 'Pantry',
        id: 'pantry-1',
        stats: { __typename: 'PantryStats', totalItems: 63 },
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
      dataFor: (
        vars: Record<string, unknown>,
      ): MockDataFor<typeof MoveShoppingItemToPantryDocument> => ({
        moveShoppingItemToPantry: {
          __typename: 'MoveShoppingItemToPantryPayload',
          pantryItem: {
            __typename: 'PantryItem',
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

  it('detail-shapes the row it publishes, so it reads offline', async () => {
    const cache = seededCache();
    const move = echoingMoveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 5,
        actualPrice: 0.59,
        removeFromList: true,
      });
    });

    const mintedId = (move.fired[0]!.input as { pantryItemId: string })
      .pantryItemId;
    const DETAIL_FRAGMENT = gql`
      fragment PantryDetailProbe on PantryItem {
        id
        acquisitionMethod
        costPerUnit
        totalCost
      }
    `;
    // `acquisitionMethod` is NOT in the mutation's response fragment, so its
    // presence is the stub's signature: the detail screen reads from cache
    // instead of dead-ending, which offline is the only thing that runs.
    // The stub's own arithmetic is pinned in writePantryItemDetailStub.test.ts.
    expect(
      cache.readFragment({
        id: `PantryItem:${mintedId}`,
        fragment: DETAIL_FRAGMENT,
      }),
    ).toMatchObject({ acquisitionMethod: 'SHOPPING_LIST' });
  });

  it('withdraws the count when the move is refused', async () => {
    const cache = seededCache();
    const rejected = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ValidationError',
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
          __typename: 'ValidationError',
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

    // The removal is stubbed here, so it records no counter change to pass on.
    expect(restoreItemToShoppingListAfterMoveToPantry).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
      undefined,
    );
  });

  it('evicts the pantry row it published when the move is refused', async () => {
    const cache = seededCache();
    const rejected = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ValidationError',
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

    const mintedId = (rejected.fired[0]!.input as { pantryItemId: string })
      .pantryItemId;
    // An unlinked but cached row is persisted and read back by any detail query.
    expect(
      cache.identify({ __typename: 'PantryItem', id: mintedId }) ?? '',
    ).not.toBe('');
    expect(
      cache.extract()[
        cache.identify({ __typename: 'PantryItem', id: mintedId })!
      ],
    ).toBeUndefined();
  });

  it('evicts the pantry row it published when the server restocks another', async () => {
    const cache = seededCache();
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

    const mintedId = (move.fired[0]!.input as { pantryItemId: string })
      .pantryItemId;
    expect(
      cache.extract()[
        cache.identify({ __typename: 'PantryItem', id: mintedId })!
      ],
    ).toBeUndefined();
  });

  it('re-reads when the list counters moved while the refused move was in flight', async () => {
    const { ApolloClient } = require('@apollo/client');
    const refetchQueries = jest
      .spyOn(ApolloClient.prototype, 'refetchQueries')
      .mockReturnValue(Promise.resolve([]));
    (
      restoreItemToShoppingListAfterMoveToPantry as jest.Mock
    ).mockReturnValueOnce(false);
    const rejected = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ValidationError',
          message: 'nope',
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [rejected.mock], cache: seededCache() },
    );

    await act(async () => {
      await result.current.moveToPantry(createItem(), {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: true,
      });
    });

    expect(refetchQueries).toHaveBeenCalled();
    refetchQueries.mockRestore();
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

describe('useMoveToPantry keeping the row on the list', () => {
  const { gql } = require('@apollo/client');
  const LIST_QUERY = gql`
    query KeepOnListSeed($listId: ID!, $isPurchased: Boolean) {
      shoppingList(id: $listId) {
        __typename
        id
        totalItems
        completedItems
        itemsConnection(filters: { isPurchased: $isPurchased }) {
          __typename
          totalCount
          edges {
            __typename
            cursor
            node {
              __typename
              id
              purchaseInfo {
                __typename
                isPurchased
                movedToPantryAt
                purchaseDate
                purchasedById
                purchasedPrice
                purchasedQuantity
                purchasedBy {
                  __typename
                  id
                }
              }
            }
          }
        }
      }
    }
  `;

  const unpurchased = createItem({
    purchaseInfo: { ...createItem().purchaseInfo, isPurchased: false },
  });

  const purchasedRow = createItem();

  function seededList(row: ShoppingListItemDisplayFragment = unpurchased) {
    const { makeCache } = require('#/apollo/cache');
    const cache = makeCache();
    const rowIsPurchased = row.purchaseInfo?.isPurchased === true;
    const edge = {
      __typename: 'ShoppingListItemEdge',
      cursor: row.id,
      node: {
        __typename: 'ShoppingListItem',
        id: row.id,
        purchaseInfo: row.purchaseInfo,
      },
    };
    const write = (isPurchased: boolean, edges: unknown[]) =>
      cache.writeQuery({
        query: LIST_QUERY,
        variables: { listId: 'list-1', isPurchased },
        data: {
          shoppingList: {
            __typename: 'ShoppingList',
            id: 'list-1',
            totalItems: 1,
            completedItems: rowIsPurchased ? 1 : 0,
            itemsConnection: {
              __typename: 'ShoppingListItemConnection',
              totalCount: edges.length,
              edges,
            },
          },
        },
      });
    write(false, rowIsPurchased ? [] : [edge]);
    write(true, rowIsPurchased ? [edge] : []);
    return cache;
  }

  const queuedMoveMock = () =>
    recordMock(MoveShoppingItemToPantryDocument, {
      data: { moveShoppingItemToPantry: null },
    });

  const refusedMoveMock = () =>
    recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'ConflictError',
          message: 'Pantry item was modified',
          code: ErrorCode.Conflict,
        },
      },
    });

  async function keepOnList(
    cache: ReturnType<typeof seededList>,
    mock: ReturnType<typeof moveMock>['mock'],
    row: ShoppingListItemDisplayFragment,
  ) {
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [mock], cache },
    );
    await act(async () => {
      await result.current.moveToPantry(row, {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: false,
      });
    });
  }

  const read = (cache: { readQuery: Function }, isPurchased: boolean) =>
    cache.readQuery({
      query: LIST_QUERY,
      variables: { listId: 'list-1', isPurchased },
    }) as {
      shoppingList: {
        completedItems: number;
        itemsConnection: {
          edges: {
            node: {
              id: string;
              purchaseInfo: {
                isPurchased: boolean;
                movedToPantryAt: string | null;
              };
            };
          }[];
        };
      };
    };

  // The API marks a kept line purchased and stamps it, whatever its state.
  it('marks an unpurchased row purchased and stamped, in the purchased counts', async () => {
    const cache = seededList();
    const move = moveMock();
    const { result } = renderHookWithApollo(
      () => useMoveToPantry({ currentListId: 'list-1' }),
      { operationMocks: [move.mock], cache },
    );

    await act(async () => {
      await result.current.moveToPantry(unpurchased, {
        pantryId: 'pantry-1',
        actualQuantity: 2,
        removeFromList: false,
      });
    });

    const purchased = read(cache, true).shoppingList;
    expect(purchased.itemsConnection.edges.map(e => e.node.id)).toEqual([
      'item-1',
    ]);
    const [edge] = purchased.itemsConnection.edges;
    expect(edge?.node.purchaseInfo.isPurchased).toBe(true);
    expect(edge?.node.purchaseInfo.movedToPantryAt).toEqual(expect.any(String));
    expect(purchased.completedItems).toBe(1);
    expect(read(cache, false).shoppingList.itemsConnection.edges).toEqual([]);
  });
  // The stamp is what stops the row offering the move; a queued move runs no
  // `update`, so the stamp is part of the local-first write.
  it.each([
    ['online', moveMock],
    ['queued', queuedMoveMock],
  ])(
    'leaves an already-purchased row purchased and stamped (%s)',
    async (_label, mockFor) => {
      const cache = seededList(purchasedRow);

      await keepOnList(cache, mockFor().mock, purchasedRow);

      const list = read(cache, true).shoppingList;
      expect(list.itemsConnection.edges.map(e => e.node.id)).toEqual([
        'item-1',
      ]);
      const [edge] = list.itemsConnection.edges;
      expect(edge?.node.purchaseInfo.isPurchased).toBe(true);
      expect(edge?.node.purchaseInfo.movedToPantryAt).toEqual(
        expect.any(String),
      );
      expect(list.completedItems).toBe(1);
      expect(read(cache, false).shoppingList.itemsConnection.edges).toEqual([]);
    },
  );

  it('moves a queued unpurchased row into the purchased counts', async () => {
    const cache = seededList();

    await keepOnList(cache, queuedMoveMock().mock, unpurchased);

    const list = read(cache, true).shoppingList;
    expect(list.itemsConnection.edges.map(e => e.node.id)).toEqual(['item-1']);
    expect(
      list.itemsConnection.edges[0]?.node.purchaseInfo.movedToPantryAt,
    ).toEqual(expect.any(String));
    expect(list.completedItems).toBe(1);
  });

  it('clears the stamp from an already-purchased row when the move is refused', async () => {
    const cache = seededList(purchasedRow);

    await keepOnList(cache, refusedMoveMock().mock, purchasedRow);

    const list = read(cache, true).shoppingList;
    const [edge] = list.itemsConnection.edges;
    expect(edge?.node.purchaseInfo.isPurchased).toBe(true);
    expect(edge?.node.purchaseInfo.movedToPantryAt).toBeNull();
    expect(list.completedItems).toBe(1);
  });

  it('puts a refused unpurchased row back in the unpurchased counts', async () => {
    const cache = seededList();

    await keepOnList(cache, refusedMoveMock().mock, unpurchased);

    const open = read(cache, false).shoppingList;
    expect(open.itemsConnection.edges.map(e => e.node.id)).toEqual(['item-1']);
    expect(open.itemsConnection.edges[0]?.node.purchaseInfo).toMatchObject({
      isPurchased: false,
      movedToPantryAt: null,
    });
    expect(open.completedItems).toBe(0);
    expect(read(cache, true).shoppingList.itemsConnection.edges).toEqual([]);
  });
});
