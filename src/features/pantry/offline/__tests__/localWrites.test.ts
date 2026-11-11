import type { Unmasked } from '@apollo/client/masking';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import { readFenceOf } from '#/apollo/pendingWrites/readFence';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import type { EntityFieldsInputs } from '#/apollo/pendingWrites/entityFields';
import {
  completeSeed,
  seedFragment,
  seedQuery,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  pantryData,
  type PantryItemFixture,
} from '#/test-utils/fixtures/pantryFixtures';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { errorService } from '#/services/errorService';
import {
  BatchStatus,
  ItemCondition,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import {
  HomePantries_HomeFragmentDoc,
  type HomePantries_HomeFragment,
} from '#features/home/utils/homePantries.generated';
import { LocalRefs_UnitFragmentDoc } from '#features/catalog/cache/localRefs.generated';
import { UseWastePantryItemBatch_PantryItemFragmentDoc } from '#features/pantry/hooks/mutations/useWastePantryItemBatch.generated';
import {
  ConvertExpiredToWasteDocument,
  CreatePantryDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  GetPantryDocument,
  GetPantryItemBatchesDocument,
  RestockPantryItemDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
  type GetPantryQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  addStock,
  createItem,
  createPantry,
  discardExpired,
  drawStock,
  removeItem,
  removePantry,
  setStock,
  updatePantryRow,
  type AddStockInputs,
  type CreateItemInputs,
  type CreatePantryInputs,
  type DiscardExpiredInputs,
  type DrawStockInputs,
  type RemoveItemInputs,
  type RemovePantryInputs,
  type SetStockInputs,
} from '../localWrites';

type Cache = ReturnType<typeof makeCache>;
type HomeEdge =
  Unmasked<HomePantries_HomeFragment>['pantriesConnection']['edges'][number];
type Row = NonNullable<
  Unmasked<GetPantryQuery>['pantry']
>['itemsConnection']['edges'][number]['node'];

const NOW = '2026-10-30T10:00:00.000Z';
const TODAY = '2026-10-30';
const PANTRY_ID = 'pantry-1';
const PANTRY_READ = {
  id: PANTRY_ID,
  itemsFirst: 50,
  storageLocationsFirst: 20,
  today: TODAY,
};
const TABLE = {
  CreatePantryItem: createItem,
  UpdatePantryItemQuantity: setStock,
  DeletePantryItem: removeItem,
  CreatePantryItemUsage: drawStock,
  RestockPantryItem: addStock,
  ConvertExpiredToWaste: discardExpired,
  UpdatePantryItem: updatePantryRow,
  CreatePantry: createPantry,
  DeletePantry: removePantry,
};

const unitOf = (id: string, type: UnitType): Row['unit'] =>
  asAbbreviation({
    __typename: 'Unit',
    id,
    name: id,
    symbol: id,
    type,
    displayAsFraction: false,
    commonFractions: null,
  });

/** What a stack holds, counted as the server counts its whole packages. */
const held = (
  count: number,
  wholePackages = Math.floor(count),
): Pick<Row, 'quantity' | 'heldQuantity' | 'stockBreakdown'> => ({
  quantity: Math.ceil(count),
  heldQuantity: count,
  stockBreakdown: { __typename: 'StockBreakdown', fullPackages: wholePackages },
});

/** The pantry's read: ten of `held`, then `items`, with `held` shaped by `over`. */
function pantryRead(over: Partial<Row>, items: PantryItemFixture[]) {
  const data = pantryData({
    id: PANTRY_ID,
    items: [{ id: 'held', itemName: 'Milk', quantity: 10 }, ...items],
  });
  const [first, ...rest] = data.pantry!.itemsConnection.edges;
  data.pantry!.itemsConnection.edges = [
    { ...first!, node: { ...first!.node, ...over } },
    ...rest,
  ];
  return data;
}

/** The pantry as its screen holds it. */
function stocked(over: Partial<Row> = {}, items: PantryItemFixture[] = []) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryDocument,
    variables: PANTRY_READ,
    data: pantryRead(over, items),
  });
  return { cache, writes: new PendingWrites(cache, TABLE) };
}
type Device = ReturnType<typeof stocked>;

/** A read of the pantry lands, with `held` shaped by `over`. */
const serverReads = ({ cache }: Device, over: Partial<Row>) =>
  seedQuery(cache, {
    query: GetPantryDocument,
    variables: PANTRY_READ,
    data: pantryRead(over, []),
  });

/**
 * A restock's answer naming `id`. Its stack's units are the stack's own: a
 * placeholder id would start a unit the pantry's read finds incomplete.
 */
const restocked = (id: string, extra: Record<string, unknown> = {}) => ({
  restockPantryItem: {
    __typename: 'RestockPantryItemPayload',
    storageLocation: null,
    ...extra,
    pantryItemUsage: {
      id: 'usage-1',
      pantryItem: {
        id,
        version: 2,
        displayAmount: { unit: { id: 'unit-piece' } },
        portionUnit: null,
        netWeightUnit: null,
        packageBreakdown: null,
        quantityBreakdown: null,
      },
    },
  },
});

const pantryOf = ({ cache }: Device, optimistic = true) =>
  cache.readQuery({
    query: GetPantryDocument,
    variables: PANTRY_READ,
    optimistic,
  })?.pantry;

const listed = (device: Device, optimistic = true) => {
  const pantry = pantryOf(device, optimistic);
  return {
    ids: pantry?.itemsConnection.edges.map(({ node }) => node.id),
    total: pantry?.stats.totalItems,
  };
};

const rowOf = (device: Device, optimistic = true, id = 'held') =>
  pantryOf(device, optimistic)?.itemsConnection.edges.find(
    ({ node }) => node.id === id,
  )?.node;

const create = ({ writes }: Device, id: string) =>
  writes.begin(
    CreatePantryItemDocument,
    { input: { id, pantryId: PANTRY_ID } },
    {
      row: { pantryId: PANTRY_ID, itemName: 'Oats', quantity: 2 },
      now: NOW,
    } satisfies CreateItemInputs,
  );

const use = (
  { writes }: Device,
  inputs: Partial<DrawStockInputs>,
  pantryItemId = 'held',
) =>
  writes.begin(CreatePantryItemUsageDocument, { input: { pantryItemId } }, {
    delta: null,
    now: NOW,
    ...inputs,
  } satisfies DrawStockInputs);

const restock = ({ writes }: Device, delta: number | null, id = 'held') =>
  writes.begin(RestockPantryItemDocument, { input: { id } }, {
    delta,
    now: NOW,
    pantryId: PANTRY_ID,
  } satisfies AddStockInputs);

const setTo = (
  { writes }: Device,
  inputs: Omit<SetStockInputs, 'now'>,
  id = 'held',
) =>
  writes.begin(
    UpdatePantryItemQuantityDocument,
    { input: { pantryItemId: id } },
    { now: NOW, ...inputs } satisfies SetStockInputs,
  );

const remove = ({ writes }: Device, id: string) =>
  writes.begin(DeletePantryItemDocument, { input: { id } }, {
    pantryId: PANTRY_ID,
  } satisfies RemoveItemInputs);

const discard = ({ writes }: Device, whole: boolean) =>
  writes.begin(
    ConvertExpiredToWasteDocument,
    { input: { pantryItemId: 'held' } },
    { whole, now: NOW } satisfies DiscardExpiredInputs,
  );

/**
 * The server answers: Apollo writes the answer to the root, then the write
 * commits. With a read in flight it waits for the read; the result lets it land.
 */
function answer(
  { cache, writes }: Device,
  { id, document, variables }: PendingWrite,
  data: Record<string, unknown>,
  { readInFlight = false } = {},
): () => void {
  const land = readInFlight ? readFenceOf(cache).begin() : () => undefined;
  const stated = completeSeed(document, variables, data);
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
  return land;
}

/** Resolves once the pantry, as the server's data holds it, lists `ids`. */
async function rootLists(device: Device, ids: string[]) {
  let stop: (() => void) | undefined;
  await new Promise<void>(resolve => {
    stop = device.cache.watch({
      query: GetPantryDocument,
      variables: PANTRY_READ,
      optimistic: false,
      immediate: true,
      callback: () => {
        const shown = listed(device, false).ids;
        if (JSON.stringify(shown) === JSON.stringify(ids)) resolve();
      },
    });
  });
  stop?.();
}

describe('creating a stack', () => {
  it('shows it and counts it once, however often it is rebuilt', () => {
    const device = stocked();

    create(device, 'minted');
    device.writes.rebuild();
    device.writes.rebuild();

    expect(listed(device)).toEqual({ ids: ['minted', 'held'], total: 2 });
    expect(listed(device, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('goes without a trace when refused', () => {
    const device = stocked();

    device.writes.drop(create(device, 'minted').id);

    expect(listed(device)).toEqual({ ids: ['held'], total: 1 });
    expect(device.cache.extract(true)).not.toHaveProperty([
      'PantryItem:minted',
    ]);
  });

  it('lists the row the server kept, counted by its answer', () => {
    const device = stocked();

    answer(device, create(device, 'minted'), {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { id: 'minted', version: 1 },
        pantry: { id: PANTRY_ID, stats: { totalItems: 2 } },
      },
    });

    expect(listed(device, false)).toEqual({
      ids: ['minted', 'held'],
      total: 2,
    });
  });

  it('leaves one stack when the server joined it to a held one', () => {
    const device = stocked();

    answer(device, create(device, 'minted'), {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { id: 'held', version: 1 },
      },
    });

    expect(listed(device).ids).toEqual(['held']);
    expect(device.cache.extract(true)).not.toHaveProperty([
      'PantryItem:minted',
    ]);
  });
});

describe('setting an amount', () => {
  it('sets it over whatever the server holds, with the net weight left', () => {
    const device = stocked();

    setTo(device, { held: 7, remainingNetWeight: 3.5 });
    serverReads(device, held(12));
    device.writes.rebuild();

    expect(rowOf(device)).toMatchObject({
      quantity: 7,
      heldQuantity: 7,
      remainingNetWeight: 3.5,
    });
  });

  it('shows it as it was given, in the unit the stack shows in', () => {
    const device = stocked();

    setTo(device, {
      held: 12,
      shown: {
        __typename: 'DisplayAmount',
        quantity: 1,
        localizedSymbol: 'doz',
        fraction: null,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'unit-doz',
          symbol: 'doz',
        }),
      },
    });

    expect(rowOf(device)?.displayAmount).toMatchObject({
      quantity: 1,
      unit: { id: 'unit-doz' },
    });
  });

  it('moves nothing, and breaks nothing, for a figure only the server can convert', () => {
    const device = stocked();
    const reported = jest.spyOn(errorService, 'reportError');

    setTo(device, {});

    expect(rowOf(device)).toMatchObject({ quantity: 10, heldQuantity: 10 });
    expect(reported).not.toHaveBeenCalled();
    reported.mockRestore();
  });

  it('writes nothing for a stack the device does not hold', () => {
    const device = stocked();

    setTo(device, { held: 7 }, 'ghost');

    expect(device.cache.extract(true)).not.toHaveProperty(['PantryItem:ghost']);
  });
});

describe('a use', () => {
  const CASE: Partial<Row> = {
    unit: unitOf('case', UnitType.Count),
    portionUnit: unitOf('can', UnitType.Count),
    portionUnitId: 'can',
    portionsPerTrackingUnit: 10,
  };
  const BAG: Partial<Row> = {
    unit: unitOf('bag', UnitType.Count),
    netWeightUnit: unitOf('lb', UnitType.Weight),
    netWeight: 5,
  };
  const oneCase = () => stocked({ ...CASE, ...held(1), remainingPortions: 10 });
  const oneBag = () => stocked({ ...BAG, ...held(1), remainingNetWeight: 5 });

  it('moves the stock it names, and two read as two through a restart', () => {
    const device = stocked();
    const writes = [use(device, { delta: -2 }), use(device, { delta: -3 })];
    expect(rowOf(device)).toMatchObject({ quantity: 5, heldQuantity: 5 });

    const restarted = new PendingWrites(device.cache, TABLE);
    device.writes.clear();
    expect(rowOf(device)).toMatchObject({ quantity: 10 });
    // The queue stores each write as JSON.
    restarted.restore(JSON.parse(JSON.stringify(writes)));

    expect(rowOf(device)).toMatchObject({ quantity: 5, heldQuantity: 5 });
    expect(rowOf(device, false)).toMatchObject({ quantity: 10 });
  });

  it('is a layer: the server data stays, and a refusal puts the stock back', () => {
    const device = stocked();

    const write = use(device, { delta: -2 });
    expect(rowOf(device, false)).toMatchObject({ quantity: 10 });
    device.writes.drop(write.id);

    expect(rowOf(device)).toMatchObject({ quantity: 10, heldQuantity: 10 });
  });

  it.each<[string, () => Device, Partial<DrawStockInputs>, Partial<Row>]>([
    [
      '9 cans when a can is used, offline included',
      oneCase,
      { stated: { amount: 1, unitId: 'can' } },
      {
        remainingPortions: 9,
        amountLeft: expect.objectContaining({
          value: 9,
          unitId: 'can',
          imperial: expect.objectContaining({ symbol: 'can' }),
        }),
      },
    ],
    [
      '4 lb when a pound is used from a 5 lb bag',
      oneBag,
      { stated: { amount: 1, unitId: 'lb' } },
      {
        remainingNetWeight: 4,
        amountLeft: expect.objectContaining({ value: 4, unitId: 'lb' }),
      },
    ],
    [
      '9 cans when a whole case of 1.9 goes',
      () => stocked({ ...CASE, ...held(1.9, 1), remainingPortions: 19 }),
      { delta: -1 },
      {
        remainingPortions: 9,
        amountLeft: expect.objectContaining({ value: 9, unitId: 'can' }),
      },
    ],
    // 0.7 and 0.8 of a bag: half a bag drawn leaves a bag's worth in two.
    [
      'two part-used bags by what is in them',
      () => stocked({ ...BAG, ...held(1.5, 0), remainingNetWeight: 7.5 }),
      { delta: -0.5 },
      {
        stockBreakdown: { __typename: 'StockBreakdown', fullPackages: 0 },
        amountLeft: expect.objectContaining({ value: 5, unitId: 'lb' }),
      },
    ],
    [
      'whole bags as bags after a whole one goes',
      () => stocked({ ...BAG, ...held(2), remainingNetWeight: 10 }),
      { delta: -1 },
      { amountLeft: expect.objectContaining({ value: 1, unitId: 'bag' }) },
    ],
    [
      'part of a box of nothing stated as a fraction',
      () => stocked({ unit: unitOf('box', UnitType.Count), ...held(1) }),
      { delta: -0.5 },
      { amountLeft: expect.objectContaining({ value: 0.5, unitId: 'box' }) },
    ],
  ])('reads %s', (_case, start, inputs, reads) => {
    const device = start();

    use(device, inputs);

    expect(rowOf(device)).toMatchObject(reads);
  });

  it.each<[string, () => Device, Partial<DrawStockInputs>]>([
    [
      'a unit only the server can convert',
      oneBag,
      { stated: { amount: 4, unitId: 'oz' } },
    ],
    [
      'a net weight on a stack that reads portions',
      () =>
        stocked({
          ...CASE,
          ...BAG,
          unit: CASE.unit,
          ...held(1),
          remainingPortions: 10,
          remainingNetWeight: 75,
        }),
      { stated: { amount: 1, unitId: 'lb' } },
    ],
    ['an amount only the server can convert', stocked, {}],
  ])('leaves the row for %s', (_case, start, inputs) => {
    const device = start();
    const before = rowOf(device)?.amountLeft;

    use(device, inputs);

    expect(rowOf(device)?.amountLeft).toStrictEqual(before);
  });

  it('remembers the unit it states, and waste leaves it alone', () => {
    const used = oneBag();
    const wasted = oneBag();
    // The ounce, as the device holds a unit it was shown.
    seedFragment(used.cache, {
      fragment: LocalRefs_UnitFragmentDoc,
      data: { __typename: 'Unit', id: 'oz', name: 'ounce', symbol: 'oz' },
    });

    use(used, { stated: { amount: 4, unitId: 'oz' }, usedUnitId: 'oz' });
    use(wasted, { stated: { amount: 1, unitId: 'lb' }, usedUnitId: null });

    expect(rowOf(used)?.consumeUnit).toMatchObject({ id: 'oz' });
    expect(rowOf(used, false)?.consumeUnit).toBeNull();
    expect(rowOf(wasted)?.consumeUnit).toBeNull();
  });

  it('adds nothing on top of an answer a read holds back', () => {
    const device = stocked();

    answer(
      device,
      use(device, { delta: -2 }),
      {
        createPantryItemUsage: {
          __typename: 'CreatePantryItemUsagePayload',
          pantryItemUsage: {
            id: 'usage-1',
            pantryItem: {
              id: 'held',
              version: 2,
              quantity: 8,
              heldQuantity: 8,
            },
          },
        },
      },
      { readInFlight: true },
    );

    expect(rowOf(device)).toMatchObject({ quantity: 8, heldQuantity: 8 });
  });
});

describe('a restock', () => {
  it('adds its stock as a batch of its own', () => {
    const device = stocked();

    restock(device, 4);

    expect(rowOf(device)).toMatchObject({
      quantity: 14,
      heldQuantity: 14,
      activeBatchCount: 1,
    });
  });

  it('reads 19 cans after a case joins 9', () => {
    const device = stocked({
      unit: unitOf('case', UnitType.Count),
      portionUnit: unitOf('can', UnitType.Count),
      portionUnitId: 'can',
      portionsPerTrackingUnit: 10,
      quantity: 1,
      heldQuantity: 0.9,
      remainingPortions: 9,
    });

    restock(device, 1);

    expect(rowOf(device)?.amountLeft).toMatchObject({
      value: 19,
      unitId: 'can',
    });
  });

  it('keeps a restocked bag whole beside a whole one', () => {
    const device = stocked({
      unit: unitOf('bag', UnitType.Count),
      netWeightUnit: unitOf('lb', UnitType.Weight),
      netWeight: 5,
      ...held(1),
      remainingNetWeight: 5,
    });

    restock(device, 1);

    expect(rowOf(device)).toMatchObject({
      stockBreakdown: { fullPackages: 2 },
      amountLeft: { value: 2, unitId: 'bag' },
    });
  });

  // Held from the expiring view: the list does not show an empty stack.
  it('lists an answered stack the pantry’s list did not hold', () => {
    const device = stocked();
    seedQuery(device.cache, {
      query: GetPantryDocument,
      variables: { ...PANTRY_READ, itemsFilter: { expiringSoon: true } },
      data: pantryData({ id: PANTRY_ID, items: [{ id: 'emptied' }] }),
    });

    answer(device, restock(device, 1, 'emptied'), restocked('emptied'));

    expect(listed(device, false).ids).toContain('emptied');
  });
});

describe('a write the server landed on the survivor of a merge', () => {
  const merged = { id: PANTRY_ID, stats: { totalItems: 1 } };

  it.each<[string, (device: Device) => PendingWrite, Record<string, unknown>]>([
    [
      'a use',
      device => use(device, { delta: -2 }),
      {
        createPantryItemUsage: {
          __typename: 'CreatePantryItemUsagePayload',
          pantry: merged,
          pantryItemUsage: {
            id: 'usage-1',
            pantryItem: { id: 'survivor', version: 2 },
          },
        },
      },
    ],
    [
      'a restock',
      device => restock(device, 1),
      restocked('survivor', { pantry: merged }),
    ],
  ])(
    'lists the survivor alone, counted by the answer, for %s',
    (_write, write, data) => {
      const device = stocked({}, [{ id: 'survivor' }]);

      answer(device, write(device), data);

      expect(listed(device, false)).toEqual({ ids: ['survivor'], total: 1 });
      expect(device.cache.extract()).not.toHaveProperty(['PantryItem:held']);
    },
  );

  // Held from the expiring view: another device's stack the list never showed.
  it('lists a survivor the list did not hold', () => {
    const device = stocked();
    seedQuery(device.cache, {
      query: GetPantryDocument,
      variables: { ...PANTRY_READ, itemsFilter: { expiringSoon: true } },
      data: pantryData({ id: PANTRY_ID, items: [{ id: 'survivor' }] }),
    });

    answer(device, use(device, { delta: -2 }), {
      createPantryItemUsage: {
        __typename: 'CreatePantryItemUsagePayload',
        pantry: merged,
        pantryItemUsage: {
          id: 'usage-1',
          pantryItem: { id: 'survivor', version: 2 },
        },
      },
    });

    expect(listed(device, false).ids).toEqual(['survivor']);
  });
});

describe('removing a stack', () => {
  it('hides it and counts it out once, however often it is rebuilt', () => {
    const device = stocked();

    remove(device, 'held');
    device.writes.rebuild();

    expect(listed(device)).toEqual({ ids: [], total: 0 });
    expect(listed(device, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('brings it back when refused', () => {
    const device = stocked();

    device.writes.drop(remove(device, 'held').id);

    expect(listed(device)).toEqual({ ids: ['held'], total: 1 });
  });

  it('leaves no row behind the answer that names it, counted by the answer', () => {
    const device = stocked({}, [{ id: 'other' }]);

    answer(device, remove(device, 'held'), {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        pantryItem: { id: 'held' },
        pantry: { id: PANTRY_ID, stats: { totalItems: 1 } },
      },
    });

    expect(listed(device, false)).toEqual({ ids: ['other'], total: 1 });
    expect(device.cache.extract()).not.toHaveProperty(['PantryItem:held']);
  });

  it('counts nothing for a row a realtime event already took', () => {
    const device = stocked();

    answer(device, remove(device, 'gone'), {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        converged: true,
        pantryItem: null,
      },
    });

    expect(listed(device, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('counts it out once while a read holds the answer', async () => {
    const device = stocked();
    const land = answer(
      device,
      remove(device, 'held'),
      {
        deletePantryItem: {
          __typename: 'DeletePantryItemPayload',
          pantryItem: { id: 'held' },
          pantry: { id: PANTRY_ID, stats: { totalItems: 0 } },
        },
      },
      { readInFlight: true },
    );
    expect(listed(device)).toEqual({ ids: [], total: 0 });

    land();
    await rootLists(device, []);

    expect(listed(device, false)).toEqual({ ids: [], total: 0 });
  });
});

describe('dating a stack', () => {
  /** The detail's batch page: one batch held, one used up. */
  function withBatches() {
    const device = stocked();
    seedQuery(device.cache, {
      query: GetPantryItemBatchesDocument,
      variables: { pantryItemId: 'held' },
      data: {
        pantryItemBatchesConnection: {
          __typename: 'PantryItemBatchConnection',
          totalCount: 2,
          pageInfo: { __typename: 'PageInfo', hasNextPage: false },
          edges: [
            {
              __typename: 'PantryItemBatchEdge',
              node: {
                __typename: 'PantryItemBatch',
                id: 'active',
                status: BatchStatus.Active,
                expiresOn: '2026-10-01',
                expiresAtIsManual: false,
              },
            },
            {
              __typename: 'PantryItemBatchEdge',
              node: {
                __typename: 'PantryItemBatch',
                id: 'used',
                status: BatchStatus.Depleted,
                expiresOn: '2026-09-01',
                expiresAtIsManual: false,
              },
            },
          ],
        },
      },
    });
    return device;
  }

  const batches = ({ cache }: Device, optimistic = true) =>
    cache
      .readQuery({
        query: GetPantryItemBatchesDocument,
        variables: { pantryItemId: 'held' },
        optimistic,
      })
      ?.pantryItemBatchesConnection.edges.map(({ node }) => ({
        id: node.id,
        expiresOn: node.expiresOn,
        expiresAtIsManual: node.expiresAtIsManual,
      }));

  const update = (
    { writes }: Device,
    fields: { expiresOn?: string | null; tags?: string[] },
  ) =>
    writes.begin(
      UpdatePantryItemDocument,
      { input: { id: 'held', version: 1, ...fields }, today: TODAY },
      {
        entity: { __typename: 'PantryItem', id: 'held' },
        fields,
      } satisfies EntityFieldsInputs,
    );

  /** The server's page, without the used-up batch, and the active one as `expiresOn`. */
  const restatedPage = (
    expiresOn: string | null,
  ): NonNullable<
    MockDataFor<
      typeof GetPantryItemBatchesDocument
    >['pantryItemBatchesConnection']
  > => ({
    __typename: 'PantryItemBatchConnection',
    totalCount: 1,
    pageInfo: { __typename: 'PageInfo', hasNextPage: false },
    edges: [
      {
        __typename: 'PantryItemBatchEdge',
        node: {
          __typename: 'PantryItemBatch',
          id: 'active',
          status: BatchStatus.Active,
          expiresOn,
          expiresAtIsManual: true,
        },
      },
    ],
  });

  it('shows the date, and moves every active batch to it, at once', () => {
    const device = withBatches();
    // What a batch write answers of its stack, the list's own figures among it.
    const EARLIEST = {
      fragment: UseWastePantryItemBatch_PantryItemFragmentDoc,
      id: 'PantryItem:held',
    };
    seedFragment(device.cache, {
      ...EARLIEST,
      data: {
        __typename: 'PantryItem',
        id: 'held',
        earliestBatchExpiresOn: '2026-10-01',
        displayAmount: { unit: { id: 'unit-piece' } },
      },
    });

    update(device, { expiresOn: '2027-01-15' });

    expect(rowOf(device)?.expiresOn).toBe('2027-01-15');
    expect(
      device.cache.readFragment({ ...EARLIEST, optimistic: true })
        ?.earliestBatchExpiresOn,
    ).toBe('2027-01-15');
    expect(batches(device)).toEqual([
      { id: 'active', expiresOn: '2027-01-15', expiresAtIsManual: true },
      { id: 'used', expiresOn: '2026-09-01', expiresAtIsManual: false },
    ]);
  });

  // Only the commit's write of the page can drop the used-up batch.
  it('clears them, and the answer restates the batch page', () => {
    const device = withBatches();
    const write = update(device, { expiresOn: null });
    expect(batches(device)?.[0]?.expiresOn).toBeNull();

    answer(device, write, {
      updatePantryItem: {
        __typename: 'UpdatePantryItemPayload',
        pantryItem: { id: 'held', version: 2 },
        batchesConnection: restatedPage(null),
      },
    } satisfies MockDataFor<typeof UpdatePantryItemDocument>);

    expect(batches(device, false)).toEqual([
      { id: 'active', expiresOn: null, expiresAtIsManual: true },
    ]);
  });

  it('leaves the batches alone when the date is not edited', () => {
    const device = withBatches();

    update(device, { tags: ['x'] });

    expect(batches(device)?.[0]?.expiresOn).toBe('2026-10-01');
  });

  it('drops the batch page a restock makes stale', () => {
    const device = withBatches();

    answer(device, restock(device, 1), restocked('held'));

    expect(batches(device, false)).toBeUndefined();
  });

  it('takes the batch page a discard restates', () => {
    const device = withBatches();

    answer(device, discard(device, false), {
      convertExpiredToWaste: {
        __typename: 'ConvertExpiredToWastePayload',
        pantryItem: { id: 'held', version: 2 },
        batchesConnection: restatedPage('2026-10-01'),
      },
    });

    expect(batches(device, false)).toEqual([
      { id: 'active', expiresOn: '2026-10-01', expiresAtIsManual: true },
    ]);
  });
});

describe('discarding what expired', () => {
  it('empties a stack with no batches until the server answers', () => {
    const device = stocked();

    discard(device, true);

    expect(rowOf(device)).toMatchObject({
      quantity: 0,
      heldQuantity: 0,
      condition: ItemCondition.Spoiled,
    });
  });

  it('leaves a batched stack for the server to recompute', () => {
    const device = stocked();

    discard(device, false);

    expect(rowOf(device)).toMatchObject({ quantity: 10 });
  });

  it('puts an emptied stack back when refused', () => {
    const device = stocked();

    device.writes.drop(discard(device, true).id);

    expect(rowOf(device)).toMatchObject({
      quantity: 10,
      condition: ItemCondition.Good,
    });
  });
});

describe('a pantry', () => {
  /** Homes as the app reads their pantries; home-1 holds one. */
  function homes() {
    const cache = makeCache();
    for (const [id, pantries] of [
      ['home-1', ['held-pantry']],
      ['home-2', []],
    ] as const) {
      seedFragment(cache, {
        fragment: HomePantries_HomeFragmentDoc,
        data: {
          __typename: 'Home',
          id,
          pantriesConnection: {
            __typename: 'PantryConnection',
            edges: pantries.map(
              (pantryId): HomeEdge => ({
                __typename: 'PantryEdge',
                node: { __typename: 'Pantry', id: pantryId, isDefault: false },
              }),
            ),
          },
        },
      });
    }
    return { cache, writes: new PendingWrites(cache, TABLE) };
  }

  const pantriesOf = (
    { cache }: { cache: Cache },
    home = 'home-1',
    optimistic = true,
  ) =>
    cache
      .readFragment({
        fragment: HomePantries_HomeFragmentDoc,
        id: `Home:${home}`,
        optimistic,
      })
      ?.pantriesConnection.edges.map(({ node }) => node.id);

  const make = ({ writes }: ReturnType<typeof homes>) => {
    const inputs: CreatePantryInputs = {
      pantry: { id: 'minted', homeId: 'home-1', name: 'Garage' },
      today: TODAY,
    };
    return writes.begin(
      CreatePantryDocument,
      { input: inputs.pantry, today: inputs.today },
      inputs,
    );
  };

  const drop = ({ writes }: ReturnType<typeof homes>) =>
    writes.begin(DeletePantryDocument, { input: { id: 'held-pantry' } }, {
      homeId: 'home-1',
    } satisfies RemovePantryInputs);

  it('shows a new one under its home, however often it is rebuilt', () => {
    const device = homes();

    make(device);
    device.writes.rebuild();

    expect(pantriesOf(device)).toEqual(['held-pantry', 'minted']);
    expect(pantriesOf(device, 'home-1', false)).toEqual(['held-pantry']);
  });

  it('leaves nothing of a refused one', () => {
    const device = homes();

    device.writes.drop(make(device).id);

    expect(pantriesOf(device)).toEqual(['held-pantry']);
    expect(device.cache.extract(true)).not.toHaveProperty(['Pantry:minted']);
  });

  it('lists an answered one under the home the server names', () => {
    const device = homes();
    const write = make(device);
    const stated = completeSeed(write.document, write.variables, {
      createPantry: {
        __typename: 'CreatePantryPayload',
        pantry: { id: 'minted', version: 1, homeId: 'home-2' },
      },
    });
    seedQuery(device.cache, {
      id: 'ROOT_MUTATION',
      query: write.document,
      variables: write.variables,
      data: stated,
    });

    device.writes.confirm(write.id, stated);
    device.writes.rebuild();

    expect(pantriesOf(device, 'home-2', false)).toEqual(['minted']);
  });

  it('hides a deleted one, and brings it back when refused', () => {
    const device = homes();

    const { id } = drop(device);
    expect(pantriesOf(device)).toEqual([]);
    expect(pantriesOf(device, 'home-1', false)).toEqual(['held-pantry']);

    device.writes.drop(id);
    expect(pantriesOf(device)).toEqual(['held-pantry']);
  });

  it('takes an answered deletion out of the server data', () => {
    const device = homes();

    device.writes.confirm(drop(device).id, {
      deletePantry: {
        __typename: 'DeletePantryPayload',
        pantryId: 'held-pantry',
      },
    });
    device.writes.rebuild();

    expect(pantriesOf(device, 'home-1', false)).toEqual([]);
  });
});
