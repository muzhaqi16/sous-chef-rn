import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import {
  pantryData,
  type PantryItemFixture,
} from '#/test-utils/fixtures/pantryFixtures';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import {
  AcquisitionMethod,
  ErrorCode,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import {
  CreatePantryItemDocument,
  GetPantryDocument,
} from '#features/pantry/graphql/pantry.generated';
import { PantryDetailInfo_PantryItemFragmentDoc } from '#features/pantry/components/PantryDetailInfo.generated';
import { usePantryIntake } from '../usePantryIntake';

type Cache = ReturnType<typeof makeCache>;
type Input = Parameters<ReturnType<typeof usePantryIntake>['addItem']>[1];
type Options = Parameters<ReturnType<typeof usePantryIntake>['addItem']>[2];

const PANTRY_ID = 'p-1';
const PANTRY_READ = {
  id: PANTRY_ID,
  itemsFirst: 50,
  storageLocationsFirst: 20,
  today: todayKey(),
};
const MILK: Input = { item: { id: 'item-milk' }, quantity: 1 };

/** The pantry as its screen holds it. */
function pantryHolding(items: PantryItemFixture[] = []) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryDocument,
    variables: PANTRY_READ,
    data: pantryData({ id: PANTRY_ID, items }),
  });
  return cache;
}

const rows = (cache: Cache) =>
  cache
    .readQuery({
      query: GetPantryDocument,
      variables: PANTRY_READ,
      optimistic: true,
    })
    ?.pantry?.itemsConnection.edges.map(edge => edge.node) ?? [];

/** The row the add published: the one the pantry did not hold. */
const addedRow = (cache: Cache) => {
  const [row] = rows(cache).filter(node => node.id !== 'pi-1');
  if (!row) throw new Error('the add published no row');
  return row;
};

/**
 * Resolves once the pantry's rows, as the cache shows them, satisfy `ok`. A
 * confirmed write's layer is rebuilt after a short window, not on its answer.
 */
async function rowsSettle(
  cache: Cache,
  ok: (shown: ReturnType<typeof rows>) => boolean,
) {
  let stop: (() => void) | undefined;
  await act(async () => {
    await new Promise<void>(resolve => {
      stop = cache.watch({
        query: GetPantryDocument,
        variables: PANTRY_READ,
        optimistic: true,
        immediate: true,
        callback: () => {
          if (ok(rows(cache))) resolve();
        },
      });
    });
  });
  stop?.();
}

/** The id the create was sent under. */
const sentId = (variables: Record<string, unknown>) => {
  const { input } = variables;
  return typeof input === 'object' &&
    input !== null &&
    'id' in input &&
    typeof input.id === 'string'
    ? input.id
    : '';
};

/** The server's answer: the add's own row, unless it `joined` a held stack. */
const created = ({
  joined,
  matchedItem,
  held,
}: { joined?: string; matchedItem?: string; held?: boolean } = {}) =>
  recordMock(CreatePantryItemDocument, {
    dataFor: (variables): MockDataFor<typeof CreatePantryItemDocument> => ({
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: {
          id: joined ?? sentId(variables),
          version: 1,
          ...(matchedItem ? { item: { id: matchedItem, version: 1 } } : {}),
        },
      },
    }),
    held,
  });

const refused = (field: string) =>
  recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'The server’s own words',
        field,
      },
    },
  });

let log = operationLog();

function renderIntake(
  cache: Cache,
  answers: ReturnType<typeof recordMock>[],
  { pantryId }: { pantryId: string | undefined } = { pantryId: PANTRY_ID },
) {
  const { result } = renderHookWithApollo(() => usePantryIntake(pantryId), {
    cache,
    links: [log.link],
    operationMocks: answers.map(answer => answer.mock),
  });
  /** Adds and waits for the outcome, as a caller does. */
  const add = async (name: string, input: Input, options?: Options) => {
    let outcome: Awaited<ReturnType<typeof result.current.addItem>> | undefined;
    await act(async () => {
      outcome = await result.current.addItem(name, input, options);
    });
    return outcome;
  };
  /** Starts an add whose answer is held, and returns its settling. */
  const start = async (name: string, input: Input, options?: Options) => {
    let added: Promise<unknown> = Promise.resolve();
    await act(async () => {
      added = result.current.addItem(name, input, options);
      await log.requested(CreatePantryItemDocument);
    });
    return () =>
      act(async () => {
        await added;
      });
  };
  return { result, add, start };
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
});

describe('an add', () => {
  it('is sent forced, for the day it was made, under the id its row shows', async () => {
    const cache = pantryHolding();
    const create = created({ held: true });
    const { start } = renderIntake(cache, [create]);

    await start('Milk', MILK);

    expect(create.fired[0]).toMatchObject({
      input: {
        id: addedRow(cache).id,
        pantryId: PANTRY_ID,
        forceAdd: true,
        today: todayKey(),
      },
      today: todayKey(),
    });
  });

  it('holds its row back from a detail read until the server has it', async () => {
    const cache = pantryHolding();
    const create = created({ held: true });
    const { start } = renderIntake(cache, [create]);

    const settle = await start('Milk', MILK);
    const { id } = addedRow(cache);
    expect(unconfirmedCreates.has(id)).toBe(true);

    create.release();
    await settle();
    expect(unconfirmedCreates.has(id)).toBe(false);
  });

  it('shows its row with what the caller knows beyond the input', async () => {
    const cache = pantryHolding();
    const { start } = renderIntake(cache, [created({ held: true })]);

    await start(
      'Oats',
      { item: { variation: 'esm-1' }, quantity: 1 },
      {
        local: {
          itemId: 'item-oats',
          unitId: 'unit-bag',
          acquisitionMethod: AcquisitionMethod.BarcodeScan,
        },
      },
    );

    const row = addedRow(cache);
    expect(row).toMatchObject({
      itemName: 'Oats',
      item: { id: 'item-oats' },
      unit: { id: 'unit-bag' },
    });
    expect(
      cache.readFragment({
        fragment: PantryDetailInfo_PantryItemFragmentDoc,
        id: `PantryItem:${row.id}`,
        optimistic: true,
      })?.acquisitionMethod,
    ).toBe(AcquisitionMethod.BarcodeScan);
  });

  it('shows what a package holds as a count until the server answers', async () => {
    const cache = pantryHolding();
    const { start } = renderIntake(cache, [created({ held: true })]);

    await start('Diet Coke Mini', {
      item: { id: 'item-soda' },
      amount: { packages: { count: 1, unitId: 'unit-case' } },
      measurementProfile: {
        portionUnitId: 'unit-can',
        portionsPerTrackingUnit: 10,
      },
    });

    expect(addedRow(cache)).toMatchObject({
      portionUnitId: 'unit-can',
      remainingPortions: 10,
    });
  });

  it('is refused, sending nothing, with no pantry', async () => {
    const create = created();
    const { add } = renderIntake(makeCache(), [create], {
      pantryId: undefined,
    });

    expect(await add('Milk', MILK)).toEqual({
      status: 'rejected',
      reason: t('errors.addItemFailedRetry'),
    });
    expect(create.fired).toEqual([]);
  });
});

describe('a typed item', () => {
  const PEPPER: Input = {
    item: { inline: { name: 'Cubanelle pepper', brand: 'Farm' } },
    quantity: 1,
  };

  it('is sent under an id of its own, which the row names at once', async () => {
    const cache = pantryHolding();
    const create = created({ held: true });
    const { start } = renderIntake(cache, [create]);

    await start('Cubanelle pepper', PEPPER);

    const itemId = addedRow(cache).item?.id;
    expect(itemId).toEqual(expect.any(String));
    expect(create.fired[0]).toMatchObject({
      input: {
        item: {
          inline: { id: itemId, name: 'Cubanelle pepper', brand: 'Farm' },
        },
      },
    });
  });

  it('keeps an item id the caller already minted', async () => {
    const create = created();
    const { add } = renderIntake(pantryHolding(), [create]);

    await add('Mayonnaise', {
      item: { inline: { id: 'item-receipt', name: 'Mayonnaise' } },
      quantity: 1,
    });

    expect(create.fired[0]).toMatchObject({
      input: { item: { inline: { id: 'item-receipt' } } },
    });
  });

  it('shows the item the server matched it to, and leaves no other', async () => {
    const cache = pantryHolding();
    const create = created({ matchedItem: 'item-held', held: true });
    const { start } = renderIntake(cache, [create]);
    const settle = await start('Cubanelle pepper', PEPPER);
    const mintedItem = addedRow(cache).item?.id;

    create.release();
    await settle();
    await rowsSettle(cache, ([row]) => row?.item?.id === 'item-held');

    expect(cache.extract(true)).not.toHaveProperty(`Item:${mintedItem}`);
  });
});

describe('the server’s answer', () => {
  it('drops the row when it joins the add to a stack the pantry holds', async () => {
    const cache = pantryHolding([{ id: 'pi-1' }]);
    const { add } = renderIntake(cache, [created({ joined: 'pi-1' })]);

    expect(await add('Milk', MILK)).toEqual({ status: 'added' });
    await rowsSettle(cache, shown => shown.length === 1);

    expect(rows(cache).map(row => row.id)).toEqual(['pi-1']);
  });

  it('keeps the row under its own id when it stands the add apart', async () => {
    const cache = pantryHolding([{ id: 'pi-1' }]);
    const create = created();
    const { add } = renderIntake(cache, [create]);

    expect(await add('Milk', MILK)).toEqual({ status: 'added' });

    expect(rows(cache).map(row => row.id)).toContain(sentId(create.fired[0]!));
  });
});

describe('a refusal', () => {
  // The server's `message` is English only.
  it('is reported by the field it names, in the app’s words, and told to no one', async () => {
    const { add } = renderIntake(pantryHolding(), [refused('quantity')]);

    expect(await add('Milk', MILK)).toEqual({
      status: 'rejected',
      reason: t('errors.field.quantity'),
      field: 'quantity',
    });
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('is told to the user when the caller asks', async () => {
    const { add } = renderIntake(pantryHolding(), [refused('quantity')]);

    await add('Milk', MILK, { present: 'alert' });

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.field.quantity'),
    );
  });

  it('reads the caller’s copy when the app has no words for its field', async () => {
    const { add } = renderIntake(pantryHolding(), [refused('shelfLife')]);

    expect(
      await add('Milk', MILK, { fallback: t('errors.addItemFailed') }),
    ).toMatchObject({ reason: t('errors.addItemFailed') });
  });
});

it('names the unit the pantry holds an item in, and none for one it does not', () => {
  const { result } = renderIntake(pantryHolding([{ id: 'bananas' }]), []);

  expect(result.current.heldUnitOf('item-bananas')).toMatchObject({
    id: 'unit-piece',
    type: UnitType.Count,
  });
  expect(result.current.heldUnitOf('item-milk')).toBeNull();
});
