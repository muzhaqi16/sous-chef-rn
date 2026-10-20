import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  seedCache,
  type MockDataFor,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  ErrorCode,
  StorageState,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import {
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
} from '#features/shoppingList/cache/moveToPantry';
import { useStore } from '#store';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { useMoveToPantry, type MoveToPantryInput } from '../useMoveToPantry';

jest.mock('#features/shoppingList/cache/moveToPantry', () => ({
  ...jest.requireActual('#features/shoppingList/cache/moveToPantry'),
  removeItemFromShoppingListForMoveToPantry: jest.fn(),
  restoreItemToShoppingListAfterMoveToPantry: jest.fn(),
}));

const { gql } = require('@apollo/client');

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

const MOVE_INPUT: MoveToPantryInput = {
  pantryId: 'pantry-1',
  amount: { measured: { quantity: 2 } },
  removeFromList: true,
};

const moveMock = () =>
  recordMock(MoveShoppingItemToPantryDocument, {
    data: {
      moveShoppingItemToPantry: {
        __typename: 'MoveShoppingItemToPantryPayload',
        pantryItem: { id: 'pantry-item-1' },
      },
    },
  });

// Queued: no response lands, so what the screens read is the local write.
const queuedMoveMock = () =>
  recordMock(MoveShoppingItemToPantryDocument, {
    data: { moveShoppingItemToPantry: null },
  });

const conflictMock = () =>
  recordMock(MoveShoppingItemToPantryDocument, {
    data: {
      moveShoppingItemToPantry: {
        __typename: 'ConflictError',
        message: 'Pantry item was modified',
        code: ErrorCode.Conflict,
      },
    },
  });

const refusedMock = () =>
  recordMock(MoveShoppingItemToPantryDocument, {
    data: { moveShoppingItemToPantry: { __typename: 'ValidationError' } },
  });

interface MoveWith {
  cache?: InMemoryCache;
  item?: ShoppingListItemDisplayFragment;
  input?: Partial<MoveToPantryInput>;
}

/** Renders the hook over `move` and moves `item` once. */
async function moveWith(
  move: RecordedMock,
  { cache, item = createItem(), input }: MoveWith = {},
) {
  const { result } = renderHookWithApollo(
    () => useMoveToPantry({ currentListId: 'list-1' }),
    { operationMocks: [move.mock], cache },
  );
  return act(() =>
    result.current.moveToPantry(item, { ...MOVE_INPUT, ...input }),
  );
}

function mintedIdOf({ fired }: RecordedMock): string {
  const [first] = fired;
  if (!first) throw new Error('The move never fired');
  return String(inputOf(first).pantryItemId);
}

describe('useMoveToPantry', () => {
  it('calls mutation with correct variables', async () => {
    const move = moveMock();

    const outcome = await moveWith(move);

    expect(move.fired).toContainEqual({
      // objectContaining: the input also carries a minted `pantryItemId` and an
      // `idempotencyKey`, both generated, both asserted separately below.
      input: expect.objectContaining({
        shoppingListItemId: 'item-1',
        pantryId: 'pantry-1',
        amount: { measured: { quantity: 2, unitId: undefined } },
        storageState: undefined,
        expiresOn: undefined,
        removeFromList: true,
        totalCost: undefined,
        notes: undefined,
      }),
      today: expect.any(String),
    });
    expect(outcome).toBe(true);
  });

  it('passes optional fields to mutation', async () => {
    const move = moveMock();

    // Seeded because the row being moved is one the list query already
    // cached; `writePurchaseInfo` carries the cached record forward, so an
    // unseeded cache makes it write a purchase record with three of its
    // eight fields.
    await moveWith(move, {
      cache: seedCache([createItem()]),
      input: {
        amount: { measured: { quantity: 3, unitId: 'unit-2' } },
        storageState: StorageState.Frozen,
        expiresOn: '2024-12-31',
        removeFromList: false,
        totalCost: 5.99,
        notes: 'Keep frozen',
      },
    });

    expect(move.fired).toContainEqual({
      input: expect.objectContaining({
        amount: { measured: { quantity: 3, unitId: 'unit-2' } },
        storageState: 'FROZEN',
        expiresOn: '2024-12-31',
        removeFromList: false,
        totalCost: 5.99,
        notes: 'Keep frozen',
      }),
      today: expect.any(String),
    });
  });

  it('sends the day of the move on the input, for its default expiry', async () => {
    const move = moveMock();

    await moveWith(move);

    const [fired] = move.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fired?.input).toMatchObject({ today: fired?.today });
  });

  // `errorPolicy: 'all'` resolves a transport failure with `error` set rather
  // than rejecting, so this drives the outcome the app actually gets.
  it('returns false when the move fails', async () => {
    const failing = recordMock(MoveShoppingItemToPantryDocument, {
      error: new Error('network down'),
    });

    expect(await moveWith(failing)).toBe(false);
  });

  it('tells the shopper when the server refuses the move', async () => {
    // A refusal resolves 200 with no `error`, so nothing else surfaces it — and
    // a target whose unit changed mid-move now comes back exactly this way.
    const alert = jest.mocked(alertService.alert);

    expect(await moveWith(conflictMock())).toBe(false);
    // `CONFLICT` is a state refusal, not a stale version: one alert, described
    // by its code rather than as "changed somewhere else".
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(t('labels.error'), expect.any(String));
    expect(alert).not.toHaveBeenCalledWith(
      expect.anything(),
      getVersionConflictMessage(),
    );
    expect(alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'Pantry item was modified',
    );
  });

  it('tracks telemetry event on successful move', async () => {
    const { Telemetry } = require('#/services/telemetry');

    await moveWith(moveMock());

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
      const move = moveMock();

      await moveWith(move);

      expect(move.fired).toHaveLength(1);
      expect(jest.mocked(toastService.error)).not.toHaveBeenCalledWith(
        'Not available offline',
      );
    });

    it('mints the pantry row id and opts into the offline queue', async () => {
      const move = moveMock();

      await moveWith(move);

      const [fired] = move.fired;
      // Without a client-minted id the optimistic row and the server row would
      // be two different entities, which is what kept this online-only.
      expect(fired && inputOf(fired)).toMatchObject({
        pantryItemId: expect.any(String),
        idempotencyKey: expect.any(String),
      });
    });

    it('unlinks the shopping row eagerly, without evicting it', async () => {
      // Offline neither the mutation's `update` callback nor the replay runs
      // one, so a removal left to `update` never happened: the server deleted
      // the line while the client kept rendering it in the list and in both
      // counters until a full refetch. It has to be unlinked here — and NOT
      // evicted, because a permanently-refused replay has to put it back.
      useStore.setState({ apiReachable: false });

      await moveWith(moveMock());

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

      await moveWith(moveMock(), {
        cache: seedCache([createItem()]),
        input: { removeFromList: false },
      });

      expect(removeItemFromShoppingListForMoveToPantry).not.toHaveBeenCalled();
    });

    it('fires the mutation normally when online', async () => {
      const move = moveMock();

      await moveWith(move);

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
  const STATS_FRAGMENT = gql`
    fragment PantryStatsProbe on Pantry {
      id
      stats {
        totalItems
      }
    }
  `;

  // The rows the count describes: a row is counted when it joins them.
  const ROWS_FRAGMENT = gql`
    fragment PantryRowsProbe on Pantry {
      id
      itemsConnection {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  function seededCache(): InMemoryCache {
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
    cache.writeFragment({
      id: 'Pantry:pantry-1',
      fragment: ROWS_FRAGMENT,
      data: {
        __typename: 'Pantry',
        id: 'pantry-1',
        itemsConnection: { __typename: 'PantryItemConnection', edges: [] },
      },
    });
    return cache;
  }

  function readTotal(cache: InMemoryCache) {
    return cache.readFragment<{ stats: { totalItems: number } }>({
      id: 'Pantry:pantry-1',
      fragment: STATS_FRAGMENT,
    })?.stats.totalItems;
  }

  function isCached(cache: InMemoryCache, id: string) {
    const key = cache.identify({ __typename: 'PantryItem', id });
    if (!key) throw new Error('A PantryItem must normalize');
    return cache.extract()[key] !== undefined;
  }

  /**
   * Echoes the client-minted id, which is the ordinary case: the server accepted
   * the row we published. When it answers with a DIFFERENT id it restocked an
   * existing stack instead, and the hook evicts its optimistic row — that path
   * has its own expectation below.
   */
  const echoingMoveMock = () =>
    recordMock(MoveShoppingItemToPantryDocument, {
      dataFor: (
        vars,
      ): MockDataFor<typeof MoveShoppingItemToPantryDocument> => ({
        moveShoppingItemToPantry: {
          __typename: 'MoveShoppingItemToPantryPayload',
          pantryItem: {
            id: String(inputOf(vars).pantryItemId),
          },
        },
      }),
    });

  it('increments the pantry item count alongside the row it adds', async () => {
    const cache = seededCache();

    await moveWith(echoingMoveMock(), { cache });

    expect(readTotal(cache)).toBe(64);
  });

  it('detail-shapes the row it publishes, so it reads offline', async () => {
    const cache = seededCache();
    const move = queuedMoveMock();

    await moveWith(move, {
      cache,
      input: { amount: { measured: { quantity: 5 } }, totalCost: 0.59 },
    });

    const DETAIL_FRAGMENT = gql`
      fragment PantryDetailProbe on PantryItem {
        id
        acquisitionMethod
        costPerUnit
        totalCost
      }
    `;
    // The row's own arithmetic is pinned in writeLocalPantryItem.test.ts.
    expect(
      cache.readFragment({
        id: `PantryItem:${mintedIdOf(move)}`,
        fragment: DETAIL_FRAGMENT,
      }),
    ).toMatchObject({ acquisitionMethod: 'SHOPPING_LIST' });
  });

  describe('a count of packages', () => {
    const ROW_FRAGMENT = gql`
      fragment PackagesRowProbe on PantryItem {
        id
        quantity
        unit {
          id
        }
        costPerUnit
      }
    `;

    async function moveTwoPackages(unitType: UnitType) {
      const cache = seededCache();
      const move = queuedMoveMock();

      await moveWith(move, {
        cache,
        item: createItem({
          quantity: 1,
          unit: {
            __typename: 'Unit',
            id: 'unit-line',
            name: 'line unit',
            symbol: 'lu',
            type: unitType,
          },
        }),
        input: { amount: { packages: { count: 2 } }, totalCost: 3.98 },
      });

      expect(move.fired[0]?.input).toMatchObject({
        amount: { packages: { count: 2 } },
        totalCost: 3.98,
      });
      return cache.readFragment({
        id: `PantryItem:${mintedIdOf(move)}`,
        fragment: ROW_FRAGMENT,
      });
    }

    it('stands as that many of a counted line until the server answers', async () => {
      expect(await moveTwoPackages(UnitType.Count)).toMatchObject({
        quantity: 2,
        unit: { id: 'unit-line' },
        costPerUnit: null,
      });
    });

    it("stands as a weighed line's own amount, which only the server converts", async () => {
      expect(await moveTwoPackages(UnitType.Weight)).toMatchObject({
        quantity: 1,
        unit: { id: 'unit-line' },
        costPerUnit: null,
      });
    });
  });

  it('withdraws the count when the move is refused', async () => {
    const cache = seededCache();

    await moveWith(refusedMock(), { cache });

    expect(readTotal(cache)).toBe(63);
  });

  it('puts the shopping row back when the move is refused', async () => {
    // Both sides were written before firing, so both are undone. The row was
    // unlinked rather than evicted, which is what leaves an entity to re-link.
    await moveWith(refusedMock(), { cache: seededCache() });

    // The removal is stubbed here, so it records no counter change to pass on.
    expect(restoreItemToShoppingListAfterMoveToPantry).toHaveBeenCalledWith(
      expect.anything(),
      'item-1',
      undefined,
    );
  });

  it('evicts the pantry row it published when the move is refused', async () => {
    const cache = seededCache();
    const rejected = refusedMock();

    await moveWith(rejected, { cache });

    // An unlinked but cached row is persisted and read back by any detail query.
    expect(isCached(cache, mintedIdOf(rejected))).toBe(false);
  });

  it('evicts the pantry row it published when the server restocks another', async () => {
    const cache = seededCache();
    const move = moveMock();

    await moveWith(move, { cache });

    expect(isCached(cache, mintedIdOf(move))).toBe(false);
  });

  it('re-reads when the list counters moved while the refused move was in flight', async () => {
    const { ApolloClient } = require('@apollo/client');
    const refetchQueries = jest
      .spyOn(ApolloClient.prototype, 'refetchQueries')
      .mockReturnValue(Promise.resolve([]));
    jest
      .mocked(restoreItemToShoppingListAfterMoveToPantry)
      .mockReturnValueOnce(false);

    await moveWith(refusedMock(), { cache: seededCache() });

    expect(refetchQueries).toHaveBeenCalled();
    refetchQueries.mockRestore();
  });

  it('takes the count from the response when the server restocks another row', async () => {
    const cache = seededCache();
    // A different id means the server restocked an existing stack; the hook
    // evicts the row it published, and the response states the pantry's count.
    const move = recordMock(MoveShoppingItemToPantryDocument, {
      data: {
        moveShoppingItemToPantry: {
          __typename: 'MoveShoppingItemToPantryPayload',
          pantryItem: { id: 'pantry-item-1' },
          pantry: { id: 'pantry-1', stats: { totalItems: 63 } },
        },
      },
    });

    await moveWith(move, { cache });

    expect(readTotal(cache)).toBe(63);
  });
});

describe('useMoveToPantry keeping the row on the list', () => {
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
  const purchased = createItem();

  function seededList(row: ShoppingListItemDisplayFragment): InMemoryCache {
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

  const read = (cache: InMemoryCache, isPurchased: boolean) =>
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

  // The API marks a kept line purchased and stamps it, whatever its state. The
  // stamp is what stops the row offering the move; a queued move runs no
  // `update`, so the stamp is part of the local-first write. A refusal puts the
  // row back where it was, unstamped.
  it.each([
    ['an unpurchased', 'online', true, true, moveMock],
    ['an unpurchased', 'queued', true, true, queuedMoveMock],
    ['a purchased', 'online', true, true, moveMock],
    ['a purchased', 'queued', true, true, queuedMoveMock],
    ['a purchased', 'refused', true, false, conflictMock],
    ['an unpurchased', 'refused', false, false, conflictMock],
  ])(
    'keeps %s row on the list, %s: purchased=%s, stamped=%s',
    async (state, _how, landsPurchased, stamped, mock) => {
      const row = state === 'a purchased' ? purchased : unpurchased;
      const cache = seededList(row);

      await moveWith(mock(), {
        cache,
        item: row,
        input: { removeFromList: false },
      });

      const list = read(cache, landsPurchased).shoppingList;
      expect(list.itemsConnection.edges.map(e => e.node.id)).toEqual([
        'item-1',
      ]);
      expect(list.itemsConnection.edges[0]?.node.purchaseInfo).toMatchObject({
        isPurchased: landsPurchased,
        movedToPantryAt: stamped ? expect.any(String) : null,
      });
      expect(list.completedItems).toBe(landsPurchased ? 1 : 0);
      expect(
        read(cache, !landsPurchased).shoppingList.itemsConnection.edges,
      ).toEqual([]);
    },
  );
});

describe('useMoveToPantry default expiry', () => {
  const EXPIRY = gql`
    fragment MovedRowExpiryProbe on PantryItem {
      id
      expiresOn
    }
  `;

  it("shows the server's default expiry on the moved row once the response lands", async () => {
    const { makeCache } = require('#/apollo/cache');
    const cache: InMemoryCache = makeCache();
    const move = recordMock(MoveShoppingItemToPantryDocument, {
      dataFor: (
        vars,
      ): MockDataFor<typeof MoveShoppingItemToPantryDocument> => ({
        moveShoppingItemToPantry: {
          __typename: 'MoveShoppingItemToPantryPayload',
          pantryItem: {
            id: String(inputOf(vars).pantryItemId),
            expiresOn: '2026-10-12',
          },
        },
      }),
    });

    await moveWith(move, { cache });

    expect(
      cache.readFragment<{ expiresOn: string | null }>({
        id: `PantryItem:${mintedIdOf(move)}`,
        fragment: EXPIRY,
      })?.expiresOn,
    ).toBe('2026-10-12');
  });
});
