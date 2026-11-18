import { act } from '@testing-library/react-native';
import type { InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { displayedLine } from '#/test-utils/fixtures/shoppingListFixtures';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { getDeviceDecimalSeparator } from '#/utils/deviceLocale';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { Telemetry } from '#services/telemetry';
import {
  EntryImageSource,
  ErrorCode,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  UseQuantityEditModal_ItemFragmentDoc,
  type UseQuantityEditModal_ItemFragment,
} from '../useQuantityEditModal.generated';
import { useQuantityEditModal } from '../useQuantityEditModal';

// The device's decimal separator is the device's.
jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

type Answer = MockDataFor<
  typeof UpdateShoppingListItemDocument
>['updateShoppingListItem'];

const GALLON = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-1',
  name: 'gallon',
  symbol: 'gal',
  type: UnitType.Volume,
});

/** Two gallons of milk, as the list hands the sheet a line. */
const listed = (overrides: Partial<ShoppingListItemDisplayFragment> = {}) =>
  displayedLine({ unitName: 'gallon', unit: GALLON, ...overrides });

/** The same line as the cache holds it, which the open sheet reads live. */
function cachedLine(
  cache: InMemoryCache,
  overrides: Partial<UseQuantityEditModal_ItemFragment> = {},
) {
  seedFragment(cache, {
    fragment: UseQuantityEditModal_ItemFragmentDoc,
    fragmentName: 'useQuantityEditModal_item',
    data: {
      __typename: 'ShoppingListItem',
      id: 'line-1',
      itemName: 'Milk',
      quantity: 2,
      category: 'Dairy',
      unitName: 'gallon',
      version: 3,
      unit: GALLON,
      amount: null,
      image: null,
      item: null,
      ...overrides,
    },
  });
}

const quantityOf = (cache: InMemoryCache) =>
  cache.readFragment({
    id: cache.identify({ __typename: 'ShoppingListItem', id: 'line-1' }),
    fragment: UseQuantityEditModal_ItemFragmentDoc,
    fragmentName: 'useQuantityEditModal_item',
    optimistic: true,
  })?.quantity;

const applied: Answer = {
  __typename: 'UpdateShoppingListItemPayload',
  shoppingListItem: { __typename: 'ShoppingListItem', id: 'line-1' },
};

interface Sheet {
  items?: ShoppingListItemDisplayFragment[];
  answer?: Answer;
  error?: Error;
  held?: boolean;
  cache?: InMemoryCache;
  open?: string | null;
}

/** The quantity sheet over a list, opened on a line. */
function openSheet({
  items = [listed()],
  answer = applied,
  error,
  held = false,
  cache = makeCache(),
  open = 'line-1',
}: Sheet = {}) {
  const sent = error
    ? recordMock(UpdateShoppingListItemDocument, { error, held })
    : recordMock(UpdateShoppingListItemDocument, {
        data: { updateShoppingListItem: answer },
        held,
      });
  const { result } = renderHookWithApollo(
    () => useQuantityEditModal({ items }),
    { cache, operationMocks: [sent.mock] },
  );
  if (open) {
    act(() => {
      result.current.openForItem(open);
    });
  }
  return { sheet: result, sent, cache };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getDeviceDecimalSeparator).mockReturnValue('.');
});

describe('the quantity sheet', () => {
  it('opens on the line as the list shows it, its unit the one offered', () => {
    const { sheet } = openSheet();

    expect(sheet.current.visible).toBe(true);
    expect(sheet.current.isLoading).toBe(false);
    expect(sheet.current.selectedItem).toEqual({
      id: 'line-1',
      itemName: 'Milk',
      quantity: 2,
      unitName: 'gal',
      unitId: 'unit-1',
      category: 'Dairy',
      imageUrl: null,
      version: 3,
      itemUnits: [
        {
          id: 'unit-1',
          unit: expect.objectContaining({ symbol: 'gal' }),
          isDefault: true,
          isPreferred: true,
        },
      ],
    });
  });

  it('opens on nothing for a line it was not given', () => {
    const { sheet } = openSheet({ open: 'line-9' });

    expect(sheet.current.visible).toBe(false);
    expect(sheet.current.selectedItem).toBeNull();
  });

  it.each([
    ['no quantity, as none', { quantity: null }, { quantity: 0 }],
    ['no name, as an item', { itemName: '' }, { itemName: t('labels.item') }],
    [
      'no unit, by the name typed, offering none',
      { unit: null, unitName: 'kilogram' },
      { unitName: 'kilogram', unitId: null, itemUnits: [] },
    ],
  ])('opens a line with %s', (_, line, opened) => {
    const { sheet } = openSheet({ items: [listed(line)] });

    expect(sheet.current.selectedItem).toMatchObject(opened);
  });

  it("shows the household's photo rather than the catalog's", () => {
    const cache = makeCache();
    cachedLine(cache, {
      image: {
        __typename: 'EntryImage',
        url: 'https://cdn.example.com/household/milk.jpg',
        source: EntryImageSource.Household,
        catalogImageId: null,
      },
      item: {
        __typename: 'Item',
        id: 'milk',
        imageUrl: 'https://cdn.example.com/catalog/milk.jpg',
        images: [],
      },
    });

    const { sheet } = openSheet({ cache });

    expect(sheet.current.selectedItem?.imageUrl).toBe(
      'https://cdn.example.com/household/milk.jpg',
    );
  });

  it('closes', () => {
    const { sheet } = openSheet();

    act(() => {
      sheet.current.close();
    });

    expect(sheet.current.visible).toBe(false);
    expect(sheet.current.selectedItem).toBeNull();
  });
});

describe('saving a quantity', () => {
  it.each([
    [
      'in the unit picked',
      '5',
      'unit-1',
      { quantity: '5', unit: { id: 'unit-1' } },
    ],
    // An omitted unit is left as it is; a null one would clear it.
    [
      'leaving the unit alone when none is picked',
      '5',
      null,
      { quantity: '5' },
    ],
    [
      'with a comma decimal made a point',
      '1,5',
      'unit-1',
      { quantity: '1.5', unit: { id: 'unit-1' } },
    ],
    [
      'with a mixed number as typed',
      '2 1/3',
      'unit-1',
      { quantity: '2 1/3', unit: { id: 'unit-1' } },
    ],
  ])('sends it %s, at the line’s version', async (_, typed, unitId, input) => {
    const { sheet, sent } = openSheet();

    await act(async () => {
      await sheet.current.save(typed, unitId);
    });

    expect(sent.fired).toEqual([
      {
        input: {
          idempotencyKey: expect.any(String),
          id: 'line-1',
          version: 3,
          ...input,
        },
      },
    ]);
  });

  it.each([
    ['saved', applied],
    ['queued', null],
  ])('closes once %s, saying nothing, and records it', async (_, answer) => {
    const { sheet } = openSheet({ answer });

    await act(async () => {
      await sheet.current.save('5', null);
    });

    expect(sheet.current.visible).toBe(false);
    expect(sheet.current.selectedItem).toBeNull();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'shopping_item_quantity_updated',
      { item_id: 'line-1', quantity: '5' },
    );
  });

  // A comma device turns `1,125` into `1.125`, and a second pass would read
  // that point as grouping: the line would hold a thousand-fold.
  it('shows what was typed at once, and says it is saving until it is', async () => {
    jest.mocked(getDeviceDecimalSeparator).mockReturnValue(',');
    const cache = makeCache();
    cachedLine(cache);
    const { sheet, sent } = openSheet({ cache, held: true });

    let saving: Promise<void> = Promise.resolve();
    await act(async () => {
      saving = sheet.current.save('1,125', 'unit-1');
    });

    expect(quantityOf(cache)).toBeCloseTo(1.125, 3);
    expect(sheet.current.isLoading).toBe(true);
    await act(async () => {
      sent.release();
      await saving;
    });
    expect(sheet.current.isLoading).toBe(false);
  });

  it('stays open on a refusal, saying why in its own words, and puts the quantity back', async () => {
    const cache = makeCache();
    cachedLine(cache);
    const { sheet } = openSheet({
      cache,
      answer: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'Invalid fraction format',
        field: 'quantity',
      },
    });

    await act(async () => {
      await sheet.current.save('5', null);
    });

    expect(sheet.current.visible).toBe(true);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.field.quantity'),
    );
    expect(quantityOf(cache)).toBe(2);
  });

  it('stays open when it cannot be sent, saying so once', async () => {
    const { sheet } = openSheet({ error: new Error('network down') });

    await act(async () => {
      await sheet.current.save('5', null);
    });

    expect(sheet.current.visible).toBe(true);
    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.adjustQuantityFailed'),
    );
  });

  it('sends nothing with no line open', async () => {
    const { sheet, sent } = openSheet({ open: null });

    await act(async () => {
      await sheet.current.save('5', null);
    });

    expect(sent.fired).toEqual([]);
  });
});

// The sheet opens on what the row shows, and saves what is typed in that unit.
describe('a line the reader sees in another unit', () => {
  const reading = (value: number, unitId: string, symbol: string) =>
    readingAsAbbreviation({
      __typename: 'MeasureReading',
      value,
      unitId,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });

  /** A 2 lb line, which a metric reader sees as 0.91 kg; its answer held. */
  function twoPounds(system: UnitSystem) {
    const cache = makeCache();
    cachedLine(cache, {
      itemName: 'Beef',
      quantity: 2,
      unitName: 'lb',
      unit: asAbbreviation({
        __typename: 'Unit',
        id: 'unit-lb',
        name: 'pound',
        symbol: 'lb',
      }),
      amount: {
        __typename: 'Measure',
        value: 2,
        unitId: 'unit-lb',
        metric: reading(0.91, 'unit-kg', 'kg'),
        imperial: reading(2, 'unit-lb', 'lb'),
      },
    });
    writeUnitSystemSettings(cache, system, system);
    return openSheet({
      cache,
      held: true,
      items: [listed({ itemName: 'Beef', unitName: 'lb' })],
    });
  }

  it('opens on the reading a metric reader sees', () => {
    const { sheet } = twoPounds(UnitSystem.Metric);

    expect(sheet.current.selectedItem).toMatchObject({
      quantity: 0.91,
      unitName: 'kg',
      unitId: 'unit-kg',
      itemUnits: [
        expect.objectContaining({
          id: 'unit-kg',
          unit: expect.objectContaining({ symbol: 'kg' }),
        }),
      ],
    });
  });

  // Written ahead, 1 would read "1 lb" until the server answers.
  it.each([
    [
      'in another unit only once the server answers',
      UnitSystem.Metric,
      'unit-kg',
      2,
    ],
    ['in its own unit at once', UnitSystem.Imperial, 'unit-lb', 3],
  ])('writes a figure %s', async (_, system, unitId, shown) => {
    const { sheet, sent, cache } = twoPounds(system);

    let saving: Promise<void> = Promise.resolve();
    await act(async () => {
      saving = sheet.current.save(unitId === 'unit-kg' ? '1' : '3', unitId);
    });

    expect(quantityOf(cache)).toBe(shown);
    await act(async () => {
      sent.release();
      await saving;
    });
  });
});
