import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { pantryRows, seedPantry } from '#/test-utils/fixtures/pantryFixtures';
import { useStore } from '#store';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import {
  AcquisitionMethod,
  ErrorCode,
  ItemCondition,
  StorageState,
  StorageType,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { addPantryItemDefaults } from '#features/pantry/components/modals/AddToPantrySheet/addPantryItemFormConfig';
import type { AddPantryItemFormData } from '#features/pantry/types';
import { usePantryItemSubmission } from '../usePantryItemSubmission';

const PANTRY_ID = 'pantry-1';
/** Two of milk in a picked unit: the form as the sheet hands it over valid. */
const form = (
  over: Partial<AddPantryItemFormData> = {},
): AddPantryItemFormData => ({
  ...addPantryItemDefaults('Milk'),
  quantityInput: '2',
  unit: 'cups',
  unitId: 'unit-cup',
  ...over,
});

/** The pantry as its screen holds it, with one location to pick. */
function pantryHolding() {
  const cache = makeCache();
  seedPantry(cache, {
    id: PANTRY_ID,
    storageLocations: [
      { id: 'loc-1', name: 'Chest freezer', type: StorageType.Freezer },
    ],
  });
  return cache;
}

const addedRow = (cache: ReturnType<typeof makeCache>) => {
  const [row] = pantryRows(cache, PANTRY_ID);
  if (!row) throw new Error('the add published no row');
  return row;
};

const created = (held = false) =>
  recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { id: 'pi-new', version: 1 },
      },
    },
    held,
  });

let log = operationLog();
let onSuccess = jest.fn();

function renderSubmission(
  answers: ReturnType<typeof recordMock>[],
  {
    cache = pantryHolding(),
    pantryId = PANTRY_ID,
  }: { cache?: ReturnType<typeof makeCache>; pantryId?: string | null } = {},
) {
  const { result } = renderHookWithApollo(
    () =>
      usePantryItemSubmission({ pantryId: pantryId ?? undefined, onSuccess }),
    { cache, links: [log.link], operationMocks: answers.map(a => a.mock) },
  );
  /** Submits the form and waits for the add to settle. */
  const confirm = (values: AddPantryItemFormData) =>
    act(async () => {
      await result.current.handleConfirm(values);
    });
  return { cache, confirm, result };
}

/** What a submitted form sends as the create's input. */
async function sent(values: AddPantryItemFormData) {
  const create = created();
  await renderSubmission([create]).confirm(values);
  return create.fired[0]?.input;
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  onSuccess = jest.fn();
  useStore.setState({ budgetAndPrices: true });
});

describe('what is sent', () => {
  it.each<[string, Partial<AddPantryItemFormData>, Record<string, unknown>]>([
    [
      'the amount, in the unit picked, for the pantry, today',
      { quantityInput: '1 1/2' },
      {
        pantryId: PANTRY_ID,
        quantity: 1.5,
        unit: { id: 'unit-cup' },
        today: todayKey(),
      },
    ],
    ['a unit typed by its name', { unitId: null }, { unit: { name: 'cups' } }],
    ['no unit for none', { unit: '', unitId: null }, { unit: undefined }],
    [
      'the item by its trimmed name, brand and category',
      { itemName: ' Milk ', brand: ' Organic Valley ', category: 'Dairy' },
      {
        item: {
          inline: {
            name: 'Milk',
            brand: 'Organic Valley',
            category: { name: 'Dairy' },
          },
        },
      },
    ],
    [
      'no brand for one of spaces',
      { brand: '  ' },
      { item: { inline: { brand: undefined } } },
    ],
    [
      'how it is kept',
      { storageState: StorageState.Frozen, condition: ItemCondition.Fair },
      {
        storage: {
          storageState: StorageState.Frozen,
          condition: ItemCondition.Fair,
        },
      },
    ],
    [
      'a picked location by its id',
      { selectedStorageLocationId: 'loc-1', storageLocation: 'Chest freezer' },
      { storage: { location: { id: 'loc-1' } } },
    ],
    [
      'a typed location by its name',
      { storageLocation: 'Top shelf' },
      { storage: { location: { name: 'Top shelf' } } },
    ],
    [
      'trimmed notes',
      { storageNotes: ' Keep cool ' },
      { storage: { storageNotes: 'Keep cool' } },
    ],
    [
      'the expiry picked, as that day',
      { expirationDate: new Date(2026, 5, 15, 23, 30) },
      { expiresOn: '2026-06-15' },
    ],
    [
      'each tag once trimmed, and no empty one',
      { tags: ' dairy, organic ,, ' },
      { tags: ['dairy', 'organic'] },
    ],
    [
      'both thresholds',
      { minQuantity: '1', restockQuantity: '5' },
      { thresholds: { minQuantity: 1, restockQuantity: 5 } },
    ],
    [
      'a restock amount alone',
      { restockQuantity: '5' },
      { thresholds: { minQuantity: undefined, restockQuantity: 5 } },
    ],
    [
      'a measure inside a package as its size',
      { sizeInput: '500', sizeUnitId: 'unit-g', sizeUnitType: UnitType.Weight },
      { netWeight: { netWeight: 500, netWeightUnitId: 'unit-g' } },
    ],
    [
      'a count inside a package as what it is used by',
      {
        unitId: 'unit-case',
        unitType: UnitType.Count,
        sizeInput: '10',
        sizeUnitId: 'unit-can',
        sizeUnitType: UnitType.Count,
      },
      {
        netWeight: undefined,
        measurementProfile: {
          portionUnitId: 'unit-can',
          portionsPerTrackingUnit: 10,
        },
      },
    ],
    [
      'nothing inside an amount in a measure',
      {
        unitType: UnitType.Weight,
        sizeInput: '5',
        sizeUnitId: 'unit-lb',
        sizeUnitType: UnitType.Weight,
      },
      { netWeight: undefined, measurementProfile: undefined },
    ],
  ])('%s', async (_what, over, input) => {
    expect(await sent(form(over))).toMatchObject(input);
  });
});

describe('what was paid', () => {
  it.each<[string, boolean, Partial<AddPantryItemFormData>]>([
    ['a plain add', true, {}],
    ['a cost of nothing', true, { costPerUnit: '0' }],
    ['a cost with prices off', false, { costPerUnit: '4.99' }],
  ])('is not stated for %s', async (_what, prices, over) => {
    useStore.setState({ budgetAndPrices: prices });

    expect(await sent(form(over))).toMatchObject({ purchase: undefined });
  });

  it.each<[string, boolean, Partial<AddPantryItemFormData>, object]>([
    [
      'the cost typed, with prices on',
      true,
      { costPerUnit: '4.99' },
      { costPerUnit: 4.99, acquisitionMethod: AcquisitionMethod.Purchased },
    ],
    [
      'only the store picked, with prices off',
      false,
      { costPerUnit: '4.99', storeId: 'store-1' },
      { storeId: 'store-1', acquisitionMethod: AcquisitionMethod.Purchased },
    ],
    [
      'how it came, when not bought',
      true,
      { acquisitionMethod: AcquisitionMethod.Gifted },
      { acquisitionMethod: AcquisitionMethod.Gifted },
    ],
  ])('states %s', async (_what, prices, over, purchase) => {
    useStore.setState({ budgetAndPrices: prices });

    expect(await sent(form(over))).toEqual(
      expect.objectContaining({ purchase }),
    );
  });
});

describe('the row, before the server answers', () => {
  it('shows what the form states beyond the input', async () => {
    const { cache, result } = renderSubmission([created(true)]);

    await act(async () => {
      void result.current.handleConfirm(
        form({
          expirationDate: new Date(2026, 5, 15),
          storageNotes: ' Keep cool ',
          tags: 'dairy, organic',
          minQuantity: '1',
          restockQuantity: '5',
        }),
      );
      await log.requested(CreatePantryItemDocument);
    });

    expect(addedRow(cache)).toMatchObject({
      unit: { id: 'unit-cup' },
      expiresOn: '2026-06-15',
      storageNotes: 'Keep cool',
      tags: ['dairy', 'organic'],
      minQuantity: 1,
      restockQuantity: 5,
    });
  });

  it.each([
    [
      'a picked location as the pantry holds it',
      { selectedStorageLocationId: 'loc-1', storageLocation: 'Chest freezer' },
      { id: 'loc-1', name: 'Chest freezer', type: StorageType.Freezer },
    ],
    [
      'a typed location by its name',
      { storageLocation: ' Garage ' },
      { name: 'Garage', type: StorageType.Custom },
    ],
  ])('shows %s', async (_what, over, location) => {
    const { cache, result } = renderSubmission([created(true)]);

    await act(async () => {
      void result.current.handleConfirm(form(over));
      await log.requested(CreatePantryItemDocument);
    });

    expect(addedRow(cache).storageLocation).toMatchObject(location);
  });
});

describe('the outcome', () => {
  it('closes the form once the item is added', async () => {
    await renderSubmission([created()]).confirm(form());

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('says why a refusal was refused, and keeps the form open', async () => {
    const refused = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'ValidationError',
          code: ErrorCode.ValidationFailed,
          message: 'The server’s own words',
          field: 'shelfLife',
        },
      },
    });

    await renderSubmission([refused]).confirm(form());

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.addItemFailed'),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('sends nothing with no pantry', async () => {
    const create = created();

    await renderSubmission([create], {
      cache: makeCache(),
      pantryId: null,
    }).confirm(form());

    expect(create.fired).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
