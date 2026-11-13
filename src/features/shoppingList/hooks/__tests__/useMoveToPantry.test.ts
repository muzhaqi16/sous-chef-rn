import { act } from '@testing-library/react-native';
import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  seedFragment,
  type MockDataFor,
  type RecordedMock,
} from '#/test-utils/apolloMockProvider';
import {
  displayedLine,
  listLine,
  listLineIds,
  seedListLines,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { MoveShoppingItemToPantryDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  ErrorCode,
  PriceSource,
  StorageState,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { onTutorialEvent } from '#domain/tutorialEvents';
import { alertService } from '#/services/alertService';
import { Telemetry } from '#services/telemetry';
import { t } from '#/i18n';
import { cacheShows } from '#/test-utils/cacheWaits';
import { useMoveToPantry, type MoveToPantryInput } from '../useMoveToPantry';

type Answer = MockDataFor<
  typeof MoveShoppingItemToPantryDocument
>['moveShoppingItemToPantry'];

/** A bought line, as the list hands it to the move sheet. */
const BOUGHT = displayedLine({
  purchaseInfo: {
    __typename: 'ShoppingListItemPurchaseInfo',
    isPurchased: true,
    movedToPantryAt: null,
  },
});

const MOVE: MoveToPantryInput = {
  pantryId: 'pantry-1',
  amount: { measured: { quantity: 2 } },
  removeFromList: true,
};

/** The server's answer, echoing the pantry row the move minted. */
const echoed =
  ({ expiresOn }: { expiresOn?: string } = {}) =>
  (
    variables: Record<string, unknown>,
  ): MockDataFor<typeof MoveShoppingItemToPantryDocument> => ({
    moveShoppingItemToPantry: {
      __typename: 'MoveShoppingItemToPantryPayload',
      pantryItem: {
        __typename: 'PantryItem',
        id: String(inputOf(variables).pantryItemId),
        ...(expiresOn && { expiresOn }),
      },
    },
  });

const REFUSED: Answer = {
  __typename: 'ConflictError',
  code: ErrorCode.Conflict,
  message: 'Pantry item was modified',
};

/** What a pantry holds: 63 stacks counted, none of them on the page. */
const PANTRY = gql`
  fragment MovePantryProbe on Pantry {
    id
    stats {
      totalItems
    }
    itemsConnection {
      edges {
        node {
          id
        }
      }
    }
  }
`;

function pantryWith63(cache: InMemoryCache) {
  seedFragment(cache, {
    fragment: PANTRY,
    data: {
      __typename: 'Pantry',
      id: 'pantry-1',
      stats: { __typename: 'PantryStats', totalItems: 63 },
      itemsConnection: { __typename: 'PantryItemConnection', edges: [] },
    },
  });
}

const pantryTotal = (cache: InMemoryCache) =>
  cache.readFragment<{ stats: { totalItems: number } }>({
    id: 'Pantry:pantry-1',
    fragment: PANTRY,
    optimistic: true,
  })?.stats.totalItems;

const rowOf = <T>(
  cache: InMemoryCache,
  id: string,
  fragment: ReturnType<typeof gql>,
) =>
  cache.readFragment<T>({
    id: cache.identify({ __typename: 'PantryItem', id }),
    fragment,
    optimistic: true,
  });

const isCached = (cache: InMemoryCache, typename: string, id: string) =>
  `${typename}:${id}` in cache.extract(true);

/** A stack as the pantry shows it, its expiry included. */
const STACK = gql`
  fragment MoveStackProbe on PantryItem {
    id
    expiresOn
  }
`;

/**
 * Resolves once the stack reads as `ok` says. An answer reaches what the
 * pantry shows when the move's layer is next rebuilt.
 */
const stackShows = (
  cache: InMemoryCache,
  id: string,
  ok: (stack: { expiresOn: string | null } | null) => boolean,
) =>
  cacheShows(
    cache,
    { fragment: STACK, from: `PantryItem:${id}` },
    () => rowOf<{ expiresOn: string | null }>(cache, id, STACK),
    ok,
  );

interface Move {
  /** The answer, or a function of what was sent; `null` is a queued move. */
  answer?:
    | Answer
    | ((
        variables: Record<string, unknown>,
      ) => MockDataFor<typeof MoveShoppingItemToPantryDocument>);
  error?: Error;
  held?: boolean;
  line?: ShoppingListItemDisplayFragment;
  input?: Partial<MoveToPantryInput>;
  cache?: InMemoryCache;
}

function renderMove({
  answer = echoed(),
  error,
  held = false,
  cache = makeCache(),
}: Move = {}) {
  const sent: RecordedMock = error
    ? recordMock(MoveShoppingItemToPantryDocument, { error, held })
    : typeof answer === 'function'
    ? recordMock(MoveShoppingItemToPantryDocument, { dataFor: answer, held })
    : recordMock(MoveShoppingItemToPantryDocument, {
        data: { moveShoppingItemToPantry: answer },
        held,
      });
  const onSuccess = jest.fn();
  const { result } = renderHookWithApollo(
    () => useMoveToPantry({ currentListId: 'list-1', onSuccess }),
    { cache, operationMocks: [sent.mock] },
  );
  return { mover: result, sent, onSuccess, cache };
}

/** Moves a line once and lets the answer settle. */
async function moveLine(move: Move = {}) {
  const rendered = renderMove(move);
  let moved: boolean | undefined;
  await act(async () => {
    moved = await rendered.mover.current.moveToPantry(move.line ?? BOUGHT, {
      ...MOVE,
      ...move.input,
    });
  });
  return { ...rendered, moved };
}

function mintedId({ fired }: RecordedMock): string {
  const [first] = fired;
  if (!first) throw new Error('nothing was moved');
  return String(inputOf(first).pantryItemId);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('moving a line to the pantry', () => {
  it('sends the line, the pantry, what was bought and the day, under a pantry id of its own', async () => {
    const { sent, moved } = await moveLine();

    expect(moved).toBe(true);
    const [variables] = sent.fired;
    expect(variables).toEqual({
      today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      input: expect.objectContaining({
        shoppingListItemId: 'line-1',
        pantryId: 'pantry-1',
        pantryItemId: expect.any(String),
        idempotencyKey: expect.any(String),
        amount: { measured: { quantity: 2 } },
        removeFromList: true,
        // Kept by a queued replay, so an expiry counts from the day of the move.
        today: variables?.today,
      }),
    });
  });

  it('sends everything else that was said about it', async () => {
    const { sent } = await moveLine({
      input: {
        amount: { packages: { count: 2 } },
        measurementProfile: { portionsPerTrackingUnit: 10 },
        storageState: StorageState.Frozen,
        expiresOn: '2024-12-31',
        removeFromList: false,
        totalCost: 5.99,
        notes: 'Keep frozen',
        receipt: { purchasedOn: '2024-12-01', storeId: 'store-1' },
        priceSource: PriceSource.ReceiptScan,
      },
    });

    expect(sent.fired[0]?.input).toMatchObject({
      amount: { packages: { count: 2 } },
      measurementProfile: { portionsPerTrackingUnit: 10 },
      storageState: StorageState.Frozen,
      expiresOn: '2024-12-31',
      removeFromList: false,
      totalCost: 5.99,
      notes: 'Keep frozen',
      receipt: { purchasedOn: '2024-12-01', storeId: 'store-1' },
      priceSource: PriceSource.ReceiptScan,
    });
  });

  it('closes, tells the guide, and records it once it is done', async () => {
    const heard = jest.fn();
    const stop = onTutorialEvent(heard);

    const { onSuccess } = await moveLine();
    stop();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith('list.movedToPantry');
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'shopping_item_moved_to_pantry',
      {
        shopping_list_id: 'list-1',
        pantry_id: 'pantry-1',
        remove_from_list: true,
      },
    );
  });

  // The sheet closes on `onSuccess`, so a refusal keeps what was typed. A
  // conflict is a state refusal, not a stale version: one alert, by its code.
  it('keeps the sheet open on a refusal, saying why in its own words', async () => {
    const { moved, onSuccess } = await moveLine({ answer: REFUSED });

    expect(moved).toBe(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'Pantry item was modified',
    );
  });

  it('reads as not done when it cannot be sent', async () => {
    const { moved } = await moveLine({ error: new Error('network down') });

    expect(moved).toBe(false);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      expect.any(String),
    );
  });

  // A detail read on an id the server has not seen yet 404s.
  it('holds the new stack back from detail reads until the server has it', async () => {
    const { mover, sent } = renderMove({ held: true });

    let moving: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      moving = mover.current.moveToPantry(BOUGHT, MOVE);
    });
    const minted = mintedId(sent);
    expect(unconfirmedCreates.has(minted)).toBe(true);

    await act(async () => {
      sent.release();
      await moving;
    });
    expect(unconfirmedCreates.has(minted)).toBe(false);
  });
});

describe('the pantry, as the move shows it', () => {
  it('counts the stack it adds, under the id it sent', async () => {
    const cache = makeCache();
    pantryWith63(cache);

    const { sent } = await moveLine({ cache, answer: null });

    expect(pantryTotal(cache)).toBe(64);
    expect(isCached(cache, 'PantryItem', mintedId(sent))).toBe(true);
  });

  it('shows the stack as a detail screen reads it, offline', async () => {
    const cache = makeCache();
    pantryWith63(cache);

    const { sent } = await moveLine({
      cache,
      answer: null,
      input: { amount: { measured: { quantity: 5 } }, totalCost: 0.59 },
    });

    expect(
      rowOf<{ acquisitionMethod: string }>(
        cache,
        mintedId(sent),
        gql`
          fragment MoveDetailProbe on PantryItem {
            acquisitionMethod
          }
        `,
      ),
    ).toMatchObject({ acquisitionMethod: 'SHOPPING_LIST' });
  });

  // Only the server converts a package of a weighed line.
  it.each([
    ['that many of a counted line', UnitType.Count, 2],
    ["a weighed line's own amount", UnitType.Weight, 1],
  ])(
    'shows two packages as %s until the server answers',
    async (_, type, shown) => {
      const cache = makeCache();
      pantryWith63(cache);

      const { sent } = await moveLine({
        cache,
        answer: null,
        line: displayedLine({
          quantity: 1,
          unit: asAbbreviation({
            __typename: 'Unit',
            id: 'unit-line',
            name: 'line unit',
            symbol: 'lu',
            type,
          }),
        }),
        input: { amount: { packages: { count: 2 } }, totalCost: 3.98 },
      });

      expect(
        rowOf<{ quantity: number; unit: { id: string } }>(
          cache,
          mintedId(sent),
          gql`
            fragment MovePackagesProbe on PantryItem {
              quantity
              unit {
                id
              }
            }
          `,
        ),
      ).toMatchObject({ quantity: shown, unit: { id: 'unit-line' } });
    },
  );

  it('takes back the stack and its count when refused', async () => {
    const cache = makeCache();
    pantryWith63(cache);

    const { sent } = await moveLine({ cache, answer: REFUSED });

    expect(pantryTotal(cache)).toBe(63);
    expect(isCached(cache, 'PantryItem', mintedId(sent))).toBe(false);
  });

  // A different id means the server restocked a stack it held.
  it('drops the stack it showed, and takes the count from the answer, when the server restocks another', async () => {
    const cache = makeCache();
    pantryWith63(cache);

    const { sent } = await moveLine({
      cache,
      answer: {
        __typename: 'MoveShoppingItemToPantryPayload',
        pantryItem: { __typename: 'PantryItem', id: 'held-stack' },
        pantry: {
          __typename: 'Pantry',
          id: 'pantry-1',
          stats: { __typename: 'PantryStats', totalItems: 63 },
        },
      },
    });

    await expect(
      stackShows(cache, mintedId(sent), stack => stack === null),
    ).resolves.toBeUndefined();
    expect(pantryTotal(cache)).toBe(63);
  });

  it("shows the server's default expiry once the answer lands", async () => {
    const { sent, cache } = await moveLine({
      answer: echoed({ expiresOn: '2026-10-12' }),
      input: { removeFromList: false },
    });

    await expect(
      stackShows(
        cache,
        mintedId(sent),
        stack => stack?.expiresOn === '2026-10-12',
      ),
    ).resolves.toBeUndefined();
  });
});

describe('the list, as the move shows it', () => {
  /** The list holding the line, ticked or not, on its two pages. */
  function listWith(bought: boolean) {
    const cache = makeCache();
    seedListLines(cache, 'list-1', [listLine('line-1', 'Milk', { bought })]);
    return cache;
  }

  // Offline neither an answer nor a replay takes the line off; the move does,
  // and keeps the row so a refused replay can put it back.
  it('takes the line off at once, keeping its row', async () => {
    const cache = listWith(true);

    await moveLine({ cache, answer: null });

    expect(listLineIds(cache, 'list-1', true)).toEqual([]);
    expect(isCached(cache, 'ShoppingListItem', 'line-1')).toBe(true);
  });

  // The API marks a kept line bought and stamps it, whatever its state; the
  // stamp stops the row offering the move. A refusal leaves it where it was.
  it.each([
    ['an open line', false, 'done', echoed(), true],
    ['an open line', false, 'queued', null, true],
    ['a bought line', true, 'done', echoed(), true],
    ['a bought line', true, 'queued', null, true],
    ['a bought line', true, 'refused', REFUSED, false],
    ['an open line', false, 'refused', REFUSED, false],
  ] as const)(
    'keeps %s on the list once %s',
    async (_, bought, _how, answer, stamped) => {
      const cache = listWith(bought);
      const lands = stamped || bought;

      await moveLine({
        cache,
        answer,
        line: displayedLine({
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: bought,
            movedToPantryAt: null,
          },
        }),
        input: { removeFromList: false },
      });

      expect(listLineIds(cache, 'list-1', lands)).toEqual(['line-1']);
      expect(listLineIds(cache, 'list-1', !lands)).toEqual([]);
      expect(
        cache.readFragment<{
          purchaseInfo: { movedToPantryAt: string | null };
        }>({
          id: 'ShoppingListItem:line-1',
          fragment: gql`
            fragment MoveStampProbe on ShoppingListItem {
              purchaseInfo {
                movedToPantryAt
              }
            }
          `,
          optimistic: true,
        })?.purchaseInfo.movedToPantryAt,
      ).toEqual(stamped ? expect.any(String) : null);
    },
  );
});
