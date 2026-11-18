import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { cacheShows } from '#/test-utils/cacheWaits';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import {
  listLine,
  listLineIds,
  purchaseRecordOf,
  purchaseRecordWatch,
  seedListLines,
  seedPurchaseRecord,
  type ListLine,
} from '#/test-utils/fixtures/shoppingListFixtures';
import type { ShoppingListItemPurchaseInfoFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useToggleShoppingItem } from '../useToggleShoppingItem';

type Answer = MockDataFor<
  typeof UpdateShoppingListItemDocument
>['updateShoppingListItem'];

/** A line on the list at version 3. */
const line = (bought: boolean, movedToPantryAt: string | null = null) => ({
  ...listLine('line-1', 'Milk', { bought, movedToPantryAt }),
  version: 3,
});

/** The server's answer for the line, now in `bought`'s state. */
const applied = (bought: boolean): Answer => ({
  __typename: 'UpdateShoppingListItemPayload',
  shoppingListItem: {
    __typename: 'ShoppingListItem',
    id: 'line-1',
    version: 4,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: bought,
      movedToPantryAt: null,
    },
  },
});

/** A purchase the line cannot be recorded against: it has no name. */
const NAMELESS: Answer = {
  __typename: 'ValidationError',
  code: ErrorCode.ValidationFailed,
  // Server English; the app shows its own copy for the field.
  message: 'This item has no name to record a purchase against.',
  field: 'itemName',
};

interface Setup {
  /** The lines the list's two tabs hold; none seeds nothing. */
  lines?: ListLine[];
  /** The line's purchase record beyond what the list reads. */
  record?: Partial<ShoppingListItemPurchaseInfoFragment>;
  totals?: { toBuy?: number; bought?: number };
  answer?: Answer;
  /** The answer comes only once the test releases it. */
  held?: boolean;
  listId?: string | null;
}

function renderToggle({
  lines = [line(false)],
  record,
  totals,
  answer = applied(true),
  held = false,
  listId = 'list-1',
}: Setup = {}) {
  const cache = makeCache();
  seedListLines(cache, 'list-1', lines, totals);
  const [first] = lines;
  if (record && first) {
    seedPurchaseRecord(cache, 'line-1', {
      isPurchased: first.purchaseInfo?.isPurchased ?? false,
      movedToPantryAt: first.purchaseInfo?.movedToPantryAt ?? null,
      ...record,
    });
  }
  const sent = recordMock(UpdateShoppingListItemDocument, {
    data: { updateShoppingListItem: answer },
    held,
  });
  const refetch = jest.fn().mockResolvedValue(undefined);
  const { result } = renderHookWithApollo(
    () => useToggleShoppingItem({ listId, refetch }),
    { cache, operationMocks: [sent.mock] },
  );
  return { hook: result, cache, sent, refetch };
}

const shownIn = (cache: InMemoryCache, isPurchased: boolean) =>
  listLineIds(cache, 'list-1', isPurchased);

const purchaseSent = (sent: ReturnType<typeof renderToggle>['sent']) =>
  sent.fired.map(variables => variables.input);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('a tick', () => {
  it('sends the flag alone at the cached version, and moves the line to the bought', async () => {
    const { hook, cache, sent } = renderToggle();

    let ticked: unknown;
    await act(async () => {
      ticked = await hook.current.toggleItem('line-1');
    });

    expect(purchaseSent(sent)).toEqual([
      {
        idempotencyKey: expect.any(String),
        id: 'line-1',
        version: 3,
        purchaseTracking: { isPurchased: true },
      },
    ]);
    expect(ticked).toMatchObject({ id: 'line-1' });
    expect(shownIn(cache, false)).toEqual([]);
    expect(shownIn(cache, true)).toEqual(['line-1']);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  // The server refuses amounts beside an un-tick.
  it('un-ticks a bought line with nothing beside the flag', async () => {
    const { hook, cache, sent } = renderToggle({
      lines: [line(true)],
      record: { purchasedQuantity: 3, purchasedPrice: 4.5 },
      answer: applied(false),
    });

    await act(async () => {
      await hook.current.toggleItem('line-1');
    });

    expect(purchaseSent(sent)).toEqual([
      expect.objectContaining({ purchaseTracking: { isPurchased: false } }),
    ]);
    expect(shownIn(cache, false)).toEqual(['line-1']);
  });

  it.each([
    [
      'names the product a tick bought',
      false,
      { isPurchased: true, purchasedItem: { variation: 'var-1' } },
    ],
    ['never on an un-tick', true, { isPurchased: false }],
  ])('%s', async (_, bought, tracked) => {
    const { hook, sent } = renderToggle({
      lines: [line(bought)],
      answer: applied(!bought),
    });

    await act(async () => {
      await hook.current.toggleItem('line-1', { variation: 'var-1' });
    });

    expect(purchaseSent(sent)).toEqual([
      expect.objectContaining({ purchaseTracking: tracked }),
    ]);
  });

  it('keeps a queued tick, and says it went', async () => {
    const { hook, cache } = renderToggle({ answer: null });

    let ticked: unknown;
    await act(async () => {
      ticked = await hook.current.toggleItem('line-1');
    });

    expect(ticked).toBe(true);
    expect(shownIn(cache, true)).toEqual(['line-1']);
  });

  it('drops a refused tick, saying why on the field it names', async () => {
    const { hook, cache } = renderToggle({ answer: NAMELESS });

    let ticked: unknown;
    await act(async () => {
      ticked = await hook.current.toggleItem('line-1');
    });

    expect(ticked).toBe(false);
    expect(shownIn(cache, false)).toEqual(['line-1']);
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.anything(),
      t('errors.field.itemName'),
    );
  });

  // The page a tick empties may not be all the tab holds.
  it.each([
    ['the tab it emptied, which holds more', 1, 5, true],
    ['not a tab it emptied that holds nothing more', 1, 1, false],
    ['not a tab with lines left', 2, 5, false],
  ])('reads again %s', async (_, onPage, total, readAgain) => {
    const lines: ListLine[] = [line(false)];
    if (onPage > 1) lines.push(listLine('line-2', 'Eggs'));
    const { hook, refetch } = renderToggle({ lines, totals: { toBuy: total } });

    await act(async () => {
      await hook.current.toggleItem('line-1');
    });

    expect(refetch).toHaveBeenCalledTimes(readAgain ? 1 : 0);
  });
});

describe("store mode's claim", () => {
  it('puts an open line in the cart, naming the product bought', async () => {
    const { hook, cache, sent } = renderToggle();

    await act(async () => {
      await hook.current.claimPurchased('line-1', { variation: 'var-1' });
    });

    expect(purchaseSent(sent)).toEqual([
      expect.objectContaining({
        purchaseTracking: {
          isPurchased: true,
          purchasedItem: { variation: 'var-1' },
        },
      }),
    ]);
    expect(shownIn(cache, true)).toEqual(['line-1']);
  });

  // Another member may have ticked it: a claim never takes it back out.
  it('keeps a line already in the cart there, counted once however often it is sent', async () => {
    const { hook, cache, sent } = renderToggle({ lines: [line(true)] });

    await act(async () => {
      await hook.current.claimPurchased('line-1');
    });
    await act(async () => {
      await hook.current.claimPurchased('line-1');
    });

    expect(purchaseSent(sent)).toEqual([
      expect.objectContaining({ purchaseTracking: { isPurchased: true } }),
      expect.objectContaining({ purchaseTracking: { isPurchased: true } }),
    ]);
    expect(shownIn(cache, true)).toEqual(['line-1']);
    expect(shownIn(cache, false)).toEqual([]);
  });
});

describe('a recorded purchase', () => {
  it('sends the amounts and the product, and shows the line bought at once', async () => {
    const { hook, cache, sent } = renderToggle();

    let recorded: unknown;
    await act(async () => {
      recorded = await hook.current.recordPurchase(
        'line-1',
        { purchasedQuantity: 2, purchasedPrice: 4.5 },
        { variation: 'var-1' },
      );
    });

    expect(recorded).toBe(true);
    expect(purchaseSent(sent)).toEqual([
      {
        idempotencyKey: expect.any(String),
        id: 'line-1',
        version: 3,
        purchaseTracking: {
          isPurchased: true,
          purchasedQuantity: 2,
          purchasedPrice: 4.5,
          purchasedItem: { variation: 'var-1' },
        },
      },
    ]);
    expect(shownIn(cache, true)).toEqual(['line-1']);
  });

  it('shows the line bought while it is sent', async () => {
    const { hook, cache, sent } = renderToggle({ held: true });

    let recording: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      recording = hook.current.recordPurchase('line-1', {
        purchasedQuantity: 1,
        purchasedPrice: null,
      });
    });

    expect(shownIn(cache, true)).toEqual(['line-1']);
    await act(async () => {
      sent.release();
      await recording;
    });
  });

  it('keeps the amounts the server recorded', async () => {
    const { hook, cache } = renderToggle({
      record: {},
      answer: {
        __typename: 'UpdateShoppingListItemPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: 'line-1',
          version: 4,
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
            movedToPantryAt: null,
            purchasedQuantity: 2,
            purchasedPrice: 4.5,
          },
        },
      },
    });

    await act(async () => {
      await hook.current.recordPurchase('line-1', {
        purchasedQuantity: 2,
        purchasedPrice: 4.5,
      });
    });

    // The write's layer gives way to the answer once it is rebuilt.
    await expect(
      cacheShows(
        cache,
        purchaseRecordWatch('line-1'),
        () => purchaseRecordOf(cache, 'line-1'),
        record =>
          record?.purchasedQuantity === 2 && record.purchasedPrice === 4.5,
      ),
    ).resolves.toBeUndefined();
  });

  it('sends no price when none was paid, and drops a refused record, saying why', async () => {
    const { hook, cache, sent } = renderToggle({ answer: NAMELESS });

    let recorded: unknown;
    await act(async () => {
      recorded = await hook.current.recordPurchase('line-1', {
        purchasedQuantity: 2,
        purchasedPrice: null,
      });
    });

    expect(recorded).toBe(false);
    expect(purchaseSent(sent)).toEqual([
      expect.objectContaining({
        purchaseTracking: { isPurchased: true, purchasedQuantity: 2 },
      }),
    ]);
    expect(shownIn(cache, false)).toEqual(['line-1']);
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.anything(),
      t('errors.field.itemName'),
    );
  });
});

describe('a change it cannot send', () => {
  const unsendable: [string, 'toggleItem' | 'recordPurchase', Setup][] = [
    ['a tick with no list', 'toggleItem', { listId: null }],
    ['a tick of a line it does not hold', 'toggleItem', { lines: [] }],
    ['a record with no list', 'recordPurchase', { listId: null }],
    ['a record of a line it does not hold', 'recordPurchase', { lines: [] }],
  ];
  it.each(unsendable)(
    'says so for %s, sending nothing',
    async (_, change, setup) => {
      const { hook, sent } = renderToggle(setup);

      let done: unknown;
      await act(async () => {
        done =
          change === 'toggleItem'
            ? await hook.current.toggleItem('line-1')
            : await hook.current.recordPurchase('line-1', {
                purchasedQuantity: 1,
                purchasedPrice: 3,
              });
      });

      expect(done).toBe(false);
      expect(sent.fired).toEqual([]);
      expect(alertService.alert).toHaveBeenCalledWith(
        t('labels.error'),
        t('errors.updateItemFailed'),
      );
    },
  );
});

describe('the stocked stamp', () => {
  // The server clears it on an un-tick, and the bulk move acts on the line.
  it('goes when the line is un-ticked, and stays gone when it is ticked again', async () => {
    const { hook, cache } = renderToggle({
      lines: [line(true, '2026-08-28T10:00:00.000Z')],
      record: { purchasedQuantity: 3 },
      answer: null,
    });

    await act(async () => {
      await hook.current.toggleItem('line-1');
    });
    await act(async () => {
      await hook.current.toggleItem('line-1');
    });

    expect(purchaseRecordOf(cache, 'line-1')).toMatchObject({
      isPurchased: true,
      movedToPantryAt: null,
      // Not this write's to discard.
      purchasedQuantity: 3,
    });
  });
});
