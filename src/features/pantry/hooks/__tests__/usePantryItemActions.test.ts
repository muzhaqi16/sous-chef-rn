'use no memo';

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import {
  ConsumptionUnitsForPantryItemDocument,
  CreatePantryItemUsageDocument,
  GetPantryItemBatchesDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  ErrorCode,
  UnitType,
  UsagePurpose,
  WasteReason,
} from '#/graphql/generated/schemaTypes';
import type { RestockContents } from '#domain/stockAmount';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { Telemetry } from '#services/telemetry';
import { getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { t } from '#/i18n';
import { changeLanguage } from '#/i18n/config';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { todayKey } from '#/utils/dateUtils';
import { usePantryItemActions } from '../usePantryItemActions';
import {
  InTrackingUnit_EnteredUnitFragmentDoc,
  InTrackingUnit_PantryItemFragmentDoc,
  WriteHeldStock_InsideFragmentDoc,
  WriteHeldStock_PantryItemFragmentDoc,
  WriteHeldStock_ShownInFragmentDoc,
} from '#features/pantry/cache/stock.generated';
import { UsePantryItemActions_IdFragmentDoc } from '../usePantryItemActions.generated';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#/utils/isNetworkError', () => ({
  isNetworkError: jest.fn(() => false),
}));

jest.mock('#/services/errorService');

/** What a stock write moves and a refusal restores. */
const STOCK = gql`
  fragment _ItemActionsStockProbe on PantryItem {
    id
    quantity
    heldQuantity
    remainingPortions
    consumeUnit {
      id
    }
    displayAmount {
      quantity
      unit {
        id
        symbol
      }
    }
  }
`;

/** The fragments the hook reads back, so a fixture is held to each selection. */
const ITEM_FRAGMENTS = [
  UsePantryItemActions_IdFragmentDoc,
  STOCK,
  InTrackingUnit_PantryItemFragmentDoc,
  WriteHeldStock_PantryItemFragmentDoc,
];

const seedPantryItems = (ids: string[] = ['item-1', 'item-2'], quantity = 5) =>
  seedCache(
    ids.flatMap(id => {
      const unit = asAbbreviation({
        __typename: 'Unit',
        id: 'unit-1',
        symbol: 'ea',
        displayAsFraction: false,
      });
      const data = {
        __typename: 'PantryItem',
        id,
        quantity,
        heldQuantity: quantity,
        consumeUnit: null,
        displayAmount: {
          __typename: 'DisplayAmount',
          quantity,
          localizedSymbol: 'ea',
          fraction: null,
          unit,
        },
        unit,
      };
      return ITEM_FRAGMENTS.map(fragment => ({ fragment, data }));
    }),
  );

type Cache = ReturnType<typeof seedPantryItems>;

const cachedItem = (cache: Cache, id = 'item-1') =>
  cache.readFragment<{
    quantity: number;
    remainingPortions: number | null;
    consumeUnit: { id: string } | null;
  }>({
    optimistic: true,
    id: cache.identify({ __typename: 'PantryItem', id }),
    fragment: STOCK,
    returnPartialData: true,
  });

const PIECE = asAbbreviation({
  __typename: 'Unit',
  id: 'pc',
  symbol: 'pc',
  displayAsFraction: false,
});
const DOZEN = asAbbreviation({
  __typename: 'Unit',
  id: 'doz',
  symbol: 'doz',
  type: UnitType.Count,
  hasStandardCountFactor: true,
  baseUnitId: 'pc',
  conversionFactor: 12,
  commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
  displayAsFraction: true,
});

/** A stack of eggs counted in pieces and shown in dozens, as the server holds one. */
const seedEggs = (held: number) => {
  const data = {
    __typename: 'PantryItem',
    id: 'eggs',
    quantity: held,
    heldQuantity: held,
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: held / 12,
      localizedSymbol: 'doz',
      fraction: null,
      unit: DOZEN,
    },
    unit: PIECE,
    displayUnit: DOZEN,
  };
  return seedCache([
    ...ITEM_FRAGMENTS.map(fragment => ({ fragment, data })),
    { fragment: WriteHeldStock_ShownInFragmentDoc, data },
    { fragment: InTrackingUnit_EnteredUnitFragmentDoc, data: DOZEN },
  ]);
};

/** Two cans of soup, 18 servings in all: a serving does not convert to a can. */
const seedSoup = () => {
  const can = asAbbreviation({
    __typename: 'Unit',
    id: 'can',
    symbol: 'can',
    type: UnitType.Count,
    commonFractions: [],
    displayAsFraction: false,
  });
  const data = {
    __typename: 'PantryItem',
    id: 'item-1',
    quantity: 2,
    heldQuantity: 2,
    consumeUnit: null,
    displayAmount: {
      __typename: 'DisplayAmount',
      quantity: 2,
      localizedSymbol: 'can',
      fraction: null,
      unit: can,
    },
    unit: can,
    netWeight: null,
    remainingNetWeight: null,
    netWeightUnit: null,
    portionsPerTrackingUnit: 9,
    remainingPortions: 18,
    portionUnit: { __typename: 'Unit', id: 'serving' },
    stockBreakdown: null,
  };
  return seedCache([
    ...ITEM_FRAGMENTS.map(fragment => ({ fragment, data })),
    { fragment: WriteHeldStock_InsideFragmentDoc, data },
  ]);
};

const createOptions = () => ({
  pantryId: 'p-1',
  removeItem: jest.fn().mockResolvedValue(undefined),
  navigateTo: {
    pantryItem: jest.fn(),
  },
});

type Answer = ReturnType<typeof recordMock>;
type Hook = { current: ReturnType<typeof usePantryItemActions> };

/** The hook over seeded items, served `answers`; `options` holds its callbacks. */
function renderActions(
  answers: Answer[] = [],
  cache: Cache = seedPantryItems(),
) {
  const options = createOptions();
  const { result } = renderHookWithApollo(() => usePantryItemActions(options), {
    cache,
    operationMocks: answers.map(answer => answer.mock),
  });
  return { result, cache, options };
}

/** Opens the consume modal on the item and confirms it. */
async function consume(
  result: Hook,
  {
    quantity = 1,
    purpose = UsagePurpose.Cooking,
    notes = '',
    unitId,
    itemId = 'item-1',
  }: {
    quantity?: number;
    purpose?: UsagePurpose;
    notes?: string;
    unitId?: string;
    itemId?: string;
  } = {},
) {
  act(() => {
    result.current.handleConsumeItem(itemId);
  });
  await act(async () => {
    await result.current.handleConfirmConsume(
      quantity,
      String(quantity),
      purpose,
      notes,
      unitId,
    );
  });
}

/** Opens the waste modal on the item and confirms it. */
async function waste(
  result: Hook,
  {
    quantity = 1,
    reason = WasteReason.Expired,
    composted = false,
    recycled = false,
    notes = '',
    unitId,
    itemId = 'item-1',
  }: {
    quantity?: number;
    reason?: WasteReason;
    composted?: boolean;
    recycled?: boolean;
    notes?: string;
    unitId?: string;
    itemId?: string;
  } = {},
) {
  act(() => {
    result.current.handleWasteItem(itemId);
  });
  await act(async () => {
    await result.current.handleConfirmWaste(
      quantity,
      reason,
      composted,
      recycled,
      notes,
      unitId,
    );
  });
}

/** Opens the restock modal on the item and confirms it; returns its refusal. */
async function restock(
  result: Hook,
  {
    quantity = 1,
    notes = '',
    unitId,
    costPerUnit,
    totalCost,
    expiresAt = null,
    contents,
  }: {
    quantity?: number;
    notes?: string;
    unitId?: string;
    costPerUnit?: number;
    totalCost?: number;
    expiresAt?: Date | null;
    contents?: RestockContents;
  } = {},
) {
  act(() => {
    result.current.handleRestockItem('item-1');
  });
  let refusal: string | null = null;
  await act(async () => {
    refusal = await result.current.handleConfirmRestock(
      quantity,
      String(quantity),
      notes,
      unitId,
      costPerUnit,
      totalCost,
      expiresAt,
      contents,
    );
  });
  return refusal;
}

type UsageAnswer = MockDataFor<
  typeof CreatePantryItemUsageDocument
>['createPantryItemUsage'];
type RestockAnswer = MockDataFor<
  typeof RestockPantryItemDocument
>['restockPantryItem'];

/** A use answered as `payload`; by default, item-1's, completed from the SDL. */
function consumeMock(
  payload: UsageAnswer = {
    __typename: 'CreatePantryItemUsagePayload',
    pantryItemUsage: {
      __typename: 'PantryItemUsage',
      id: 'usage-1',
      pantryItem: { __typename: 'PantryItem', id: 'item-1' },
    },
  },
) {
  return recordMock(CreatePantryItemUsageDocument, {
    data: { createPantryItemUsage: payload },
  });
}

/** A restock answered as `payload`; by default, item-1's, completed from the SDL. */
function restockMock(
  payload: RestockAnswer = {
    __typename: 'RestockPantryItemPayload',
    pantryItemUsage: {
      __typename: 'PantryItemUsage',
      id: 'usage-1',
      pantryItem: { __typename: 'PantryItem', id: 'item-1' },
    },
  },
) {
  return recordMock(RestockPantryItemDocument, {
    data: { restockPantryItem: payload },
  });
}

/** What the offline queue answers: the payload field null, and no error. */
const queuedUsage = () => consumeMock(null);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('opening a modal', () => {
  it('starts with every modal closed', () => {
    const { result } = renderActions();

    for (const modal of [
      result.current.consumeModal,
      result.current.wasteModal,
      result.current.restockModal,
    ]) {
      expect(modal).toMatchObject({ visible: false, itemId: null });
    }
  });

  it.each([
    ['handleConsumeItem', 'consumeModal'],
    ['handleWasteItem', 'wasteModal'],
    ['handleRestockItem', 'restockModal'],
  ] as const)(
    '%s opens %s on a held item, and not on an unknown one',
    (open, modal) => {
      const { result } = renderActions();

      act(() => {
        result.current[open]('unknown');
      });
      expect(result.current[modal].visible).toBe(false);

      act(() => {
        result.current[open]('item-2');
      });
      expect(result.current[modal]).toMatchObject({
        visible: true,
        itemId: 'item-2',
      });
    },
  );

  it('opens the restock form with no reason by default', () => {
    const { result } = renderActions();

    act(() => {
      result.current.handleRestockItem('item-1');
    });

    expect(result.current.restockModal.reason).toBeUndefined();
  });

  it('keeps one modal open at a time, and closes it', () => {
    const { result } = renderActions();

    act(() => {
      result.current.handleConsumeItem('item-1');
    });
    act(() => {
      result.current.handleWasteItem('item-2');
    });
    expect(result.current.consumeModal.visible).toBe(false);
    expect(result.current.wasteModal.visible).toBe(true);

    act(() => {
      result.current.wasteModal.close();
    });
    expect(result.current.wasteModal.visible).toBe(false);
  });

  describe('asking for the restock amount', () => {
    const REASON = "We don't know how much one package of this holds.";

    it('opens the restock modal with the reason it asks', () => {
      const { result } = renderActions();

      let opened;
      act(() => {
        opened = result.current.openRestockAsking('item-1', REASON);
      });

      expect(opened).toBe(true);
      expect(result.current.restockModal).toMatchObject({
        visible: true,
        itemId: 'item-1',
        reason: REASON,
      });
    });

    it('says it could not for an item the cache does not hold', () => {
      const { result } = renderActions();

      let opened;
      act(() => {
        opened = result.current.openRestockAsking('item-unknown', REASON);
      });

      expect(opened).toBe(false);
      expect(result.current.restockModal.visible).toBe(false);
    });
  });
});

describe('editing and deleting', () => {
  it('opens the item to edit it', () => {
    const { result, options } = renderActions();

    act(() => {
      result.current.handleEditItem('item-1');
    });

    expect(options.navigateTo.pantryItem).toHaveBeenCalledWith({
      itemId: 'item-1',
    });
  });

  it('removes the item and records it', async () => {
    const { result, options } = renderActions();

    await act(async () => {
      await result.current.handleDeleteItem('item-1');
    });

    expect(options.removeItem).toHaveBeenCalledWith('item-1');
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'delete_pantry_item_success',
      { item_id: 'item-1' },
    );
  });

  it('reports a delete that fails, and records no success', async () => {
    const { result, options } = renderActions();
    const failure = new Error('gone');
    options.removeItem.mockRejectedValueOnce(failure);

    await act(async () => {
      await result.current.handleDeleteItem('item-1');
    });

    expect(errorService.reportError).toHaveBeenCalledWith(
      failure,
      expect.anything(),
    );
    expect(Telemetry.trackEvent).not.toHaveBeenCalled();
  });
});

describe('using some', () => {
  it('sends the use and closes the modal', async () => {
    const m = consumeMock();
    const { result } = renderActions([m]);

    await consume(result, { quantity: 2, notes: 'For dinner' });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: {
        pantryItemId: 'item-1',
        amount: { quantity: 2 },
        purpose: UsagePurpose.Cooking,
        notes: 'For dinner',
        usageUnitId: undefined,
        today: todayKey(),
        idempotencyKey: expect.any(String),
      },
    });
    expect(result.current.consumeModal.visible).toBe(false);
  });

  it('sends no notes when none were typed', async () => {
    const m = consumeMock();
    const { result } = renderActions([m]);

    await consume(result);

    expect(m.fired[0]?.input).toMatchObject({ notes: undefined });
  });

  it('does nothing when no modal is open', async () => {
    const m = consumeMock();
    const { result } = renderActions([m]);

    await act(async () => {
      await result.current.handleConfirmConsume(
        1,
        '1',
        UsagePurpose.Cooking,
        '',
      );
    });

    expect(m.fired).toEqual([]);
  });

  // `errorPolicy: 'all'` resolves a transport failure with `error` set rather
  // than rejecting, so this drives the outcome the app actually gets.
  it('puts the amount back and says so when the write fails', async () => {
    const failing = recordMock(CreatePantryItemUsageDocument, {
      error: new Error('network down'),
    });
    const { result, cache } = renderActions([failing]);

    await consume(result, { quantity: 2 });

    expect(cachedItem(cache)).toMatchObject({ quantity: 5, heldQuantity: 5 });
    expect(result.current.consumeModal.visible).toBe(true);
    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      expect.any(String),
    );
    expect(errorService.reportError).toHaveBeenCalledWith(expect.any(Error), {
      operation: operationNameOf(CreatePantryItemUsageDocument),
    });
  });

  it('keeps a queued use, closes the modal and says nothing', async () => {
    const queued = queuedUsage();
    const { result, cache } = renderActions([queued]);

    await consume(result, { quantity: 2 });

    expect(cachedItem(cache)).toMatchObject({
      quantity: 3,
      heldQuantity: 3,
      // The amount as shown moves with it, in the unit the stack counts in.
      displayAmount: { quantity: 3, unit: { id: 'unit-1', symbol: 'ea' } },
    });
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(result.current.consumeModal.visible).toBe(false);
  });

  it.each([
    {
      write: 'a use remembers it',
      record: (result: Hook) =>
        consume(result, { purpose: UsagePurpose.General, unitId: 'unit-1' }),
      remembered: 'unit-1',
    },
    {
      write: 'waste does not',
      record: (result: Hook) => waste(result, { unitId: 'unit-1' }),
      remembered: null,
    },
  ])(
    'the unit a write is stated in: $write',
    async ({ record, remembered }) => {
      const { result, cache } = renderActions([queuedUsage()]);

      await record(result);

      expect(cachedItem(cache)?.consumeUnit?.id ?? null).toBe(remembered);
    },
  );

  it('draws portions stated in a unit that does not convert to the stack', async () => {
    const { result, cache } = renderActions([queuedUsage()], seedSoup());

    await consume(result, { quantity: 2, unitId: 'serving' });

    expect(cachedItem(cache)).toMatchObject({
      quantity: 2,
      remainingPortions: 16,
    });
  });
});

describe('wasting some', () => {
  it('sends a waste use and closes the modal', async () => {
    const m = consumeMock();
    const { result } = renderActions([m]);

    await waste(result, { composted: true, notes: 'Past date' });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: {
        pantryItemId: 'item-1',
        amount: { quantity: 1 },
        purpose: UsagePurpose.Waste,
        notes: 'Past date',
        usageUnitId: undefined,
        wasteReason: WasteReason.Expired,
        isComposted: true,
        isRecycled: false,
        today: todayKey(),
        idempotencyKey: expect.any(String),
      },
    });
    expect(result.current.wasteModal.visible).toBe(false);
  });

  it('keeps a queued waste, closes the modal and says nothing', async () => {
    const queued = queuedUsage();
    const { result, cache } = renderActions([queued]);

    await waste(result);

    expect(queued.fired).toHaveLength(1);
    expect(cachedItem(cache)).toMatchObject({ quantity: 4, heldQuantity: 4 });
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(result.current.wasteModal.visible).toBe(false);
  });

  it('keeps the modal open and says so when the write fails', async () => {
    const failing = recordMock(CreatePantryItemUsageDocument, {
      error: new Error('Server error'),
    });
    const { result, cache } = renderActions([failing]);

    await waste(result);

    expect(cachedItem(cache)).toMatchObject({
      quantity: 5,
      heldQuantity: 5,
      displayAmount: { quantity: 5 },
    });
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(result.current.wasteModal.visible).toBe(true);
  });
});

describe('on a stack of pieces shown in dozens', () => {
  it('shows what is left in pieces when it is no common fraction of a dozen', async () => {
    const { result, cache } = renderActions([queuedUsage()], seedEggs(36));

    await consume(result, { quantity: 25, unitId: 'pc', itemId: 'eggs' });

    expect(cachedItem(cache, 'eggs')).toMatchObject({
      heldQuantity: 11,
      displayAmount: { quantity: 11, unit: { id: 'pc', symbol: 'pc' } },
    });
  });

  it('shows what is left in dozens when it is a common fraction of one', async () => {
    const { result, cache } = renderActions([queuedUsage()], seedEggs(36));

    await consume(result, { quantity: 4, unitId: 'pc', itemId: 'eggs' });

    expect(cachedItem(cache, 'eggs')).toMatchObject({
      heldQuantity: 32,
      displayAmount: { quantity: 32 / 12, unit: { id: 'doz' } },
    });
  });

  it('moves the stock by the pieces a dozen entry names', async () => {
    const { result, cache } = renderActions([queuedUsage()], seedEggs(36));

    // ⅓ doz typed to three decimals is 4 eggs, as the server reads it.
    await waste(result, { quantity: 0.333, unitId: 'doz', itemId: 'eggs' });

    expect(cachedItem(cache, 'eggs')).toMatchObject({
      heldQuantity: 32,
      displayAmount: { quantity: 32 / 12, unit: { id: 'doz' } },
    });
  });
});

describe('restocking', () => {
  it('sends the restock and closes the modal', async () => {
    const m = restockMock();
    const { result } = renderActions([m]);

    await restock(result, { quantity: 3, notes: 'Bought more' });

    expect(m.fired).toContainEqual({
      today: expect.any(String),
      input: {
        id: 'item-1',
        amount: { measured: { quantity: 3, unitId: undefined } },
        notes: 'Bought more',
        costPerUnit: undefined,
        totalCost: undefined,
        expiresOn: null,
        idempotencyKey: expect.any(String),
        today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
    });
    // The input's day is the one the stats are read on: the day of the restock.
    const [fired] = m.fired;
    expect(fired?.input).toMatchObject({ today: fired?.today });
    expect(result.current.restockModal.visible).toBe(false);
  });

  it('sends its unit, costs and expiry', async () => {
    const m = restockMock();
    const { result } = renderActions([m]);

    await restock(result, {
      quantity: 5,
      unitId: 'unit-kg',
      costPerUnit: 2.5,
      totalCost: 12.5,
      expiresAt: new Date(2026, 11, 31),
    });

    expect(m.fired[0]?.input).toMatchObject({
      amount: { measured: { quantity: 5, unitId: 'unit-kg' } },
      costPerUnit: 2.5,
      totalCost: 12.5,
      expiresOn: '2026-12-31',
    });
  });

  it('sends a stated size as packages of it', async () => {
    const m = restockMock();
    const { result } = renderActions([m]);

    await restock(result, {
      quantity: 2,
      unitId: 'case',
      contents: { packageSize: { netWeight: 3, netWeightUnitId: 'lb' } },
    });

    expect(m.fired[0]?.input).toMatchObject({
      amount: {
        packages: {
          count: 2,
          unitId: 'case',
          size: { netWeight: 3, netWeightUnitId: 'lb' },
        },
      },
    });
    expect(result.current.restockModal.visible).toBe(false);
  });

  it('sends portions stated for this batch with its amount', async () => {
    const m = restockMock();
    const { result } = renderActions([m]);

    await restock(result, {
      unitId: 'case',
      contents: { packageSize: null, packagePortions: 12 },
    });

    expect(m.fired[0]?.input).toMatchObject({
      amount: { measured: { quantity: 1, unitId: 'case' } },
      packagePortions: 12,
    });
  });

  it('answers a refused size for its field, with no alert', async () => {
    const refused = recordMock(RestockPantryItemDocument, {
      data: {
        restockPantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          field: 'amount.packages.size',
        },
      },
    });
    const { result } = renderActions([refused]);

    const refusal = await restock(result, {
      unitId: 'case',
      contents: { packageSize: { netWeight: 500, netWeightUnitId: 'g' } },
    });

    expect(refusal).toBe(t('errors.field.packageSize'));
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(result.current.restockModal.visible).toBe(true);
  });

  it('keeps the cached batches when the restock is queued offline', async () => {
    // This mutation runs `localFirst`, so offline `queueLink` resolves it with
    // a NULL result. Evicting there drops a field only a server response can
    // refill — and offline there is no response, so the batch section stays
    // empty for the rest of the session and the emptied field persists.
    const cache = seedPantryItems();
    seedQuery(cache, {
      query: GetPantryItemBatchesDocument,
      variables: { pantryItemId: 'item-1' },
      data: {
        __typename: 'Query',
        pantryItemBatchesConnection: {
          __typename: 'PantryItemBatchConnection',
          totalCount: 1,
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          edges: [],
        },
      },
    });
    const batches = () =>
      cache.readQuery({
        optimistic: true,
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: 'item-1' },
      });
    const before = batches();
    expect(before).not.toBeNull();
    const data: MockDataFor<typeof RestockPantryItemDocument> = {
      restockPantryItem: null,
    };
    const { result } = renderActions(
      [recordMock(RestockPantryItemDocument, { data })],
      cache,
    );

    await restock(result, { quantity: 3 });

    expect(batches()).toEqual(before);
    expect(cachedItem(cache)).toMatchObject({ quantity: 8, heldQuantity: 8 });
    expect(result.current.restockModal.visible).toBe(false);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('keeps the modal open and says so when the write fails', async () => {
    const failing = recordMock(RestockPantryItemDocument, {
      error: new Error('Server error'),
    });
    const { result, cache } = renderActions([failing]);

    await restock(result, { quantity: 2 });

    expect(cachedItem(cache)).toMatchObject({ quantity: 5, heldQuantity: 5 });
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(result.current.restockModal.visible).toBe(true);
  });
});

// A local write is a layer the answer replaces, so a figure the answer leaves
// out goes back to the old read.
describe('what the answer leaves on the row', () => {
  const ANSWERED = gql`
    fragment UsePantryItemActionsAnswered on PantryItem {
      remainingPortions
      amountLeft {
        value
      }
      consumeUnit {
        id
      }
    }
  `;
  const answered = (cache: Cache) =>
    cache.readFragment<{
      remainingPortions: number;
      amountLeft: { value: number };
      consumeUnit: { id: string } | null;
    }>({
      id: 'PantryItem:item-1',
      fragment: ANSWERED,
      returnPartialData: true,
    });

  it('takes the amount and the last unit from a use', async () => {
    const m = consumeMock({
      __typename: 'CreatePantryItemUsagePayload',
      pantryItemUsage: {
        __typename: 'PantryItemUsage',
        id: 'usage-1',
        pantryItem: {
          __typename: 'PantryItem',
          id: 'item-1',
          remainingPortions: 18,
          amountLeft: { __typename: 'Measure', value: 18 },
          consumeUnit: { __typename: 'Unit', id: 'can' },
        },
      },
    });
    const { result, cache } = renderActions([m]);

    await consume(result, { purpose: UsagePurpose.General, unitId: 'can' });

    expect(answered(cache)).toMatchObject({
      remainingPortions: 18,
      amountLeft: { value: 18 },
      consumeUnit: { id: 'can' },
    });
  });

  it('takes the amount from a restock', async () => {
    const m = restockMock({
      __typename: 'RestockPantryItemPayload',
      pantryItemUsage: {
        __typename: 'PantryItemUsage',
        id: 'usage-1',
        pantryItem: {
          __typename: 'PantryItem',
          id: 'item-1',
          remainingPortions: 18,
          amountLeft: { __typename: 'Measure', value: 18 },
        },
      },
    });
    const { result, cache } = renderActions([m]);

    await restock(result);

    expect(answered(cache)).toMatchObject({
      remainingPortions: 18,
      amountLeft: { value: 18 },
    });
  });
});

describe('a refused write', () => {
  /** A cached ranked unit list, which a unit refusal leaves wrong. */
  const withRankedUnits = () => {
    const cache = seedPantryItems();
    seedQuery(cache, {
      query: ConsumptionUnitsForPantryItemDocument,
      variables: { pantryItemId: 'item-1' },
      data: { consumptionUnitsForPantryItem: [] },
    });
    return cache;
  };
  const holdsRankedUnits = (cache: Cache) =>
    Object.keys(cache.extract().ROOT_QUERY ?? {}).some(key =>
      key.startsWith('consumptionUnitsForPantryItem'),
    );

  const usageUnitRefusal = () =>
    consumeMock({
      __typename: 'ValidationError',
      code: ErrorCode.UnitInvalid,
      message: "Cannot use in 'jar'",
      field: 'usageUnitId',
    });
  const unitRefusals: {
    write: string;
    answer: () => Answer;
    confirm: (result: Hook) => Promise<unknown>;
    modal: 'consumeModal' | 'wasteModal' | 'restockModal';
  }[] = [
    {
      write: 'a use',
      answer: usageUnitRefusal,
      confirm: consume,
      modal: 'consumeModal',
    },
    {
      write: 'a waste',
      answer: usageUnitRefusal,
      confirm: waste,
      modal: 'wasteModal',
    },
    {
      write: 'a restock',
      answer: () =>
        restockMock({
          __typename: 'ValidationError',
          code: ErrorCode.UnitInvalid,
          message: "Cannot restock in 'slice'",
          field: 'unitId',
        }),
      confirm: restock,
      modal: 'restockModal',
    },
  ];

  it.each(unitRefusals)(
    'for its unit: $write says so in the app’s words, stays open and drops the ranked units',
    async ({ answer, confirm, modal }) => {
      const cache = withRankedUnits();
      expect(holdsRankedUnits(cache)).toBe(true);
      const { result } = renderActions([answer()], cache);

      await confirm(result);

      // The refusal's own message is unlocalizable English, so the copy is ours.
      expect(alertService.alert).toHaveBeenCalledWith(
        'Invalid Unit',
        'That unit cannot be used here.',
      );
      expect(result.current[modal].visible).toBe(true);
      expect(holdsRankedUnits(cache)).toBe(false);
    },
  );

  it('describes a CONFLICT by its code, not as a stale version', async () => {
    const { result } = renderActions([
      consumeMock({
        __typename: 'ConflictError',
        code: ErrorCode.Conflict,
        message: 'Version conflict: expected 3, found 4',
      }),
    ]);

    await consume(result);

    // One alert in the app's words; the payload's `message` is server English.
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      getVersionConflictMessage(),
    );
    expect(alertService.alert).not.toHaveBeenCalledWith(
      expect.anything(),
      'Version conflict: expected 3, found 4',
    );
  });

  // The API emits VERSION_CONFLICT (not CONFLICT) for optimistic-lock failures;
  // matching only CONFLICT drops it into the generic Error alert.
  it('says a VERSION_CONFLICT changed elsewhere', async () => {
    const { result } = renderActions([
      consumeMock({
        __typename: 'ConflictError',
        code: ErrorCode.VersionConflict,
        message: 'Item was updated by another device',
      }),
    ]);

    await consume(result);

    expect(alertService.alert).toHaveBeenCalledWith(
      'Changed Elsewhere',
      getVersionConflictMessage(),
    );
  });

  it('names the refused input in its own copy, never the message', async () => {
    const { result } = renderActions([
      consumeMock({
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'Cannot use more than available quantity',
        field: 'amount',
      }),
    ]);

    await consume(result, { quantity: 100 });

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      t('errors.field.amount'),
    );
  });

  describe('in a language other than English', () => {
    const englishConflictCopy = getVersionConflictMessage();
    const englishFallback = t('errors.recordUsageFailedRetry');

    beforeEach(async () => {
      await changeLanguage('es');
    });
    afterEach(async () => {
      await changeLanguage('en');
    });

    const shownCopy = () => {
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      const [title, message] =
        jest.mocked(alertService.alert).mock.calls[0] ?? [];
      return `${title} ${message}`;
    };

    it('shows the app copy for a version conflict, never the server text', async () => {
      const { result } = renderActions([
        consumeMock({
          __typename: 'ConflictError',
          code: ErrorCode.VersionConflict,
          message: 'Item was updated by another device',
        }),
      ]);
      await consume(result);

      const copy = shownCopy();
      expect(getVersionConflictMessage()).not.toBe(englishConflictCopy);
      expect(copy).toContain(getVersionConflictMessage());
      expect(copy).not.toContain('updated by another device');
    });

    it('shows the action copy for an unmapped thrown error, never the server text', async () => {
      const { result } = renderActions([
        recordMock(CreatePantryItemUsageDocument, {
          error: new Error('pantry_usage_item_fk violated'),
        }),
      ]);
      await consume(result);

      const copy = shownCopy();
      expect(t('errors.recordUsageFailedRetry')).not.toBe(englishFallback);
      expect(copy).toContain(t('errors.recordUsageFailedRetry'));
      expect(copy).not.toContain('pantry_usage_item_fk');
    });
  });
});
