import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import type { ScannedItem } from '#features/barcode/types';
import {
  ErrorCode,
  ErrorDisposition,
  NetWeightKind,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { makeCache } from '#/apollo/cache';
import {
  UseHeldStacks_PantryFragmentDoc,
  UseHeldStacks_PantryItemFragmentDoc,
} from '#features/pantry/hooks/useHeldStacks.generated';
import type { HeldStack } from '#features/pantry/hooks/useHeldStacks';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedFragment,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  AddBrandToListDocument,
  BrandListsDocument,
} from '#features/profile/hooks/useBrandLists.generated';
import { isRecord } from '#/utils/isRecord';
import { StoreShelfPricesDocument } from '#features/catalog/hooks/useStoreShelfPrices.generated';
import { AddToBrandListSheet } from '#features/profile/ui/AddToBrandListSheet';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

let log = operationLog();

/** The counting units the device holds: a scan is counted in a piece. */
const UNITS = [
  { id: 'unit-pc', name: 'piece', symbol: 'pc', type: UnitType.Count },
];

/** One package counted in a piece, sized by the record: what a scan adds. */
const ONE_PACKAGE = { packages: { count: 1, unitId: 'unit-pc' } };

const MILK: ScannedItem = {
  id: 'item-1',
  conceptIds: [],
  name: 'Organic Milk',
  upc: '123456',
  netWeight: 1,
  canEdit: false,
  canSuggest: true,
};

const PROPS: SearchResultsProps = {
  item: MILK,
  onScanAnother: jest.fn(),
  source: 'pantry',
  pantryId: 'pantry-1',
};

const created = () =>
  recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: {
          __typename: 'PantryItem',
          version: 1,
          id: 'pantry-item-new',
        },
      },
    },
  });

const refusedOn = (field: string) =>
  recordMock(CreatePantryItemDocument, {
    data: {
      createPantryItem: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        disposition: ErrorDisposition.Fail,
        message: 'refused',
        field,
      },
    },
  });

function openResults(
  props: Partial<SearchResultsProps> = {},
  {
    answers = [],
    cache,
  }: {
    answers?: ReturnType<typeof recordMock>[];
    cache?: ReturnType<typeof makeCache>;
  } = {},
) {
  return renderWithApollo(<SearchResults {...PROPS} {...props} />, {
    links: [log.link],
    cache,
    operationMocks: answers.map(answer => answer.mock),
  });
}

const addLabel = {
  pantry: () => t('addItemSheet.addToPantry'),
  shoppingList: () => t('labels.addToShoppingList'),
};

/** Presses the add, as the person does. */
const pressAdd = async (label = addLabel.pantry()) => {
  await userEvent.setup().press(screen.getByText(label));
};

/** What the first pantry add sent. */
const sentAdd = (answer: ReturnType<typeof recordMock>) => {
  const [fired] = answer.fired;
  if (!fired) throw new Error('nothing was added');
  return inputOf(fired);
};

const typeInto = (testID: string, text: string) => {
  fireEvent.changeText(screen.getByTestId(testID), text);
};

const openAmount = () => {
  fireEvent.press(screen.getByTestId(barcodeTestIDs.scanAmountSummary));
};

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    cachedUnits: UNITS,
    pendingPantryScrollToTop: false,
    isOnline: true,
    apiReachable: true,
  });
});

describe('a scan', () => {
  it('shows the product and offers the add for where it came from', () => {
    openResults();

    expect(screen.getByText('Organic Milk')).toBeTruthy();
    expect(screen.getByText(addLabel.pantry())).toBeTruthy();
  });

  it('offers the list add from a list', () => {
    openResults({ source: 'shoppingList', shoppingListId: 'list-1' });

    expect(screen.getByText(addLabel.shoppingList())).toBeTruthy();
  });

  // `scan/result` is deep-linkable, so a link can land here with nowhere to add.
  it('offers no add, and no second scan, with nowhere to add to', () => {
    openResults({ source: undefined });

    expect(screen.queryByText(addLabel.pantry())).not.toBeOnTheScreen();
    expect(screen.queryByText(t('labels.scanAnother'))).not.toBeOnTheScreen();
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  it('reads no shelf prices outside store mode', async () => {
    const shelf = recordMock(StoreShelfPricesDocument, { held: true });
    openResults(
      { source: 'shoppingList', shoppingListId: 'list-1' },
      { answers: [shelf] },
    );
    await act(async () => undefined);

    expect(shelf.fired).toEqual([]);
    expect(
      screen.queryByTestId(barcodeTestIDs.storeShelfPrices),
    ).not.toBeOnTheScreen();
  });
});

describe('a pantry add', () => {
  // A 1.89 L carton is ONE container, counted as one; its size belongs to the
  // record the add names, and a size sent beside it would read as an edit.
  it('adds one counted package naming the record, and no size of its own', async () => {
    const add = created();
    openResults(
      {
        item: {
          ...MILK,
          variationId: 'esm-1',
          netWeight: 1.89,
          displayUnit: { id: 'unit-litre', name: 'litre', symbol: 'L' },
        },
      },
      { answers: [add] },
    );

    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    const sent = sentAdd(add);
    expect(sent.amount).toEqual(ONE_PACKAGE);
    expect(sent.item).toEqual({ variation: 'esm-1' });
    for (const key of ['quantity', 'netWeight', 'unit', 'consumeUnit']) {
      expect(sent).not.toHaveProperty(key);
    }
  });

  it('names the item when the scan found no record for the barcode', async () => {
    const add = created();
    openResults({}, { answers: [add] });

    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).item).toEqual({ id: 'item-1' });
  });

  it('sends the day of the add, for its default expiry', async () => {
    const add = created();
    openResults(
      { item: { ...MILK, variationId: 'esm-1' } },
      { answers: [add] },
    );

    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    const [fired] = add.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sentAdd(add)).toMatchObject({ today: fired?.today });
  });

  // The device's units are a persisted store, which hydrates after mount.
  it('adds in one tap when the units load after the screen opened', async () => {
    useStore.setState({ cachedUnits: [] });
    const add = created();
    openResults({}, { answers: [add] });

    act(() => {
      useStore.setState({ cachedUnits: UNITS });
    });
    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).amount).toEqual(ONE_PACKAGE);
  });

  it('sends a package size the person changed', async () => {
    const add = created();
    const reading = (value: number, unitId: string, symbol: string) =>
      readingAsAbbreviation({
        __typename: 'MeasureReading',
        value,
        unitId,
        symbol,
        displayAsFraction: false,
        type: UnitType.Weight,
      });
    openResults(
      {
        item: {
          ...MILK,
          variationId: 'esm-1',
          netWeightKind: NetWeightKind.Package,
          packageSize: {
            __typename: 'Measure',
            value: 1360.78,
            unitId: 'unit-g',
            metric: reading(1.36, 'unit-kg', 'kg'),
            imperial: reading(3, 'unit-lb', 'lb'),
          },
        },
      },
      { answers: [add] },
    );

    // No settings held: the API's own fallback, metric.
    expect(screen.getByText('1 pc of 1.36 kg')).toBeTruthy();
    openAmount();
    typeInto(barcodeTestIDs.scanAmountSize, '2');
    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).amount).toEqual({
      packages: {
        count: 1,
        unitId: 'unit-pc',
        size: { netWeight: 2, netWeightUnitId: 'unit-kg' },
      },
    });
  });

  // A "6 x 250mL" six-pack adds as 6 cans of 250 ml, never one 1500 mL package.
  it('adds a six-pack as its six cans, each one can’s size', async () => {
    const add = created();
    const volume = (value: number, unitId: string, symbol: string) =>
      readingAsAbbreviation({
        __typename: 'MeasureReading',
        value,
        unitId,
        symbol,
        displayAsFraction: false,
        type: UnitType.Volume,
      });
    openResults(
      {
        item: {
          ...MILK,
          variationId: 'esm-six',
          packageSize: {
            __typename: 'Measure',
            value: 1500,
            unitId: 'unit-ml',
            metric: volume(1.5, 'unit-l', 'L'),
            imperial: volume(50.72, 'unit-floz', 'fl oz'),
          },
          packs: {
            __typename: 'PackStatement',
            count: 6,
            each: {
              __typename: 'Measure',
              value: 250,
              unitId: 'unit-ml',
              metric: volume(250, 'unit-ml', 'ml'),
              imperial: volume(8.45, 'unit-floz', 'fl oz'),
            },
            container: asAbbreviation({
              __typename: 'Unit',
              id: 'unit-can',
              symbol: 'can',
            }),
          },
        },
      },
      { answers: [add] },
    );

    expect(screen.getByText('6 can of 250 ml')).toBeTruthy();
    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).amount).toEqual({
      packages: {
        count: 6,
        unitId: 'unit-can',
        size: { netWeight: 250, netWeightUnitId: 'unit-ml' },
      },
    });
  });

  it('adds nothing while the amount is invalid, and opens it to show why', async () => {
    const add = created();
    openResults({}, { answers: [add] });

    openAmount();
    typeInto(barcodeTestIDs.scanAmountQuantity, '1 1/2');
    typeInto(barcodeTestIDs.scanAmountSize, '5');
    await pressAdd();
    await act(async () => undefined);

    expect(screen.getByText(t('packageSize.wholePackages'))).toBeTruthy();
    expect(add.fired).toEqual([]);
  });

  it('moves on once added: the pantry scrolls up and the scanner reopens', async () => {
    const onScanAnother = jest.fn();
    openResults({ onScanAnother }, { answers: [created()] });

    await pressAdd();
    await log.landed(CreatePantryItemDocument);
    await act(async () => undefined);

    expect(onScanAnother).toHaveBeenCalledTimes(1);
    expect(useStore.getState().pendingPantryScrollToTop).toBe(true);
    expect(screen.getByText(t('labels.added'))).toBeTruthy();
  });

  it('is added once however often it is pressed', async () => {
    const add = created();
    openResults({}, { answers: [add] });

    await pressAdd();
    await log.landed(CreatePantryItemDocument);
    await act(async () => undefined);
    await userEvent.setup().press(screen.getByText(t('labels.added')));

    expect(add.fired).toHaveLength(1);
  });

  it('shows on the pantry at once, before the server answers', async () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: UseHeldStacks_PantryFragmentDoc,
      fragmentName: 'useHeldStacks_pantry',
      variables: {
        itemsFirst: undefined,
        itemsCursor: undefined,
        itemsFilter: undefined,
        itemsOrderBy: undefined,
      },
      data: {
        __typename: 'Pantry',
        id: 'pantry-1',
        itemsConnection: {
          __typename: 'PantryItemConnection',
          edges: [],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    });
    openResults(
      {},
      {
        cache,
        answers: [recordMock(CreatePantryItemDocument, { held: true })],
      },
    );

    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    const pantry = cache.readFragment({
      fragment: UseHeldStacks_PantryFragmentDoc,
      fragmentName: 'useHeldStacks_pantry',
      from: 'Pantry:pantry-1',
      optimistic: true,
    });
    expect(pantry?.itemsConnection.edges).toHaveLength(1);
  });
});

describe('a pantry add with no pantry to add to', () => {
  it('says what it is missing, and sends nothing', async () => {
    const add = created();
    openResults({ pantryId: undefined }, { answers: [add] });

    await pressAdd();
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.missingRequiredInfo'),
    );
    expect(add.fired).toEqual([]);
  });
});

describe('a refused pantry add', () => {
  const OFF_ITEM: ScannedItem = {
    ...MILK,
    source: 'OPENFOODFACTS',
    netWeight: undefined,
    variationId: 'off-1',
  };

  it('shows a refused size on the size field, opened, and no alert', async () => {
    const onScanAnother = jest.fn();
    openResults(
      { item: OFF_ITEM, onScanAnother },
      { answers: [refusedOn('netWeight')] },
    );

    await pressAdd();
    await log.landed(CreatePantryItemDocument);
    await act(async () => undefined);

    expect(screen.getByText(t('errors.field.netWeight'))).toBeTruthy();
    expect(screen.getByTestId(barcodeTestIDs.scanAmountSize)).toBeTruthy();
    expect(alertService.alert).not.toHaveBeenCalled();
    expect(onScanAnother).not.toHaveBeenCalled();
    expect(screen.getByText(addLabel.pantry())).toBeTruthy();
  });

  it('alerts a refusal no amount field can show, naming the input', async () => {
    openResults({ item: OFF_ITEM }, { answers: [refusedOn('quantity')] });

    await pressAdd();
    await log.landed(CreatePantryItemDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalledTimes(1);
    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.field.quantity'),
    );
  });
});

describe('a product from Open Food Facts', () => {
  // The size is the person's to add if they know it; unasked, the API counts
  // an unsized package in a counted stack.
  it('adds one counted package without asking for the size it lacks', async () => {
    const add = created();
    openResults(
      {
        item: {
          ...MILK,
          source: 'OPENFOODFACTS',
          netWeight: undefined,
          variationId: 'off-1',
        },
      },
      { answers: [add] },
    );

    expect(screen.getByText('1 pc')).toBeTruthy();
    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).amount).toEqual(ONE_PACKAGE);
    expect(sentAdd(add).item).toEqual({ variation: 'off-1' });
  });

  it('adds in one tap when the record states its pack size', async () => {
    const add = created();
    openResults(
      {
        item: {
          ...MILK,
          source: 'OPENFOODFACTS',
          netWeight: 16,
          netWeightKind: NetWeightKind.Package,
          variationId: 'off-2',
        },
      },
      { answers: [add] },
    );

    await pressAdd();
    await log.requested(CreatePantryItemDocument);

    expect(sentAdd(add).amount).toEqual(ONE_PACKAGE);
  });
});

describe('a list add', () => {
  const LIST: Partial<SearchResultsProps> = {
    source: 'shoppingList',
    shoppingListId: 'list-1',
  };
  const addedToList = () =>
    recordMock(BarcodeAddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [],
        },
      },
    });

  // The record carries the pack's brand and size to the line.
  it("names the record, and neither brand nor size of the scan's", async () => {
    const add = addedToList();
    openResults(
      {
        ...LIST,
        pantryId: undefined,
        item: {
          ...MILK,
          variationId: 'esm-1',
          brandId: 'brand-pack',
          brandName: 'Pack Brand',
          displayUnit: { id: 'unit-litre', name: 'litre', symbol: 'L' },
        },
      },
      { answers: [add] },
    );

    await pressAdd(addLabel.shoppingList());
    await log.requested(BarcodeAddItemToShoppingListDocument);

    const { items } = sentAdd(add);
    const [line] = Array.isArray(items) ? items : [];
    if (!isRecord(line)) throw new Error('no line was sent');
    expect(line.item).toEqual({ variation: 'esm-1' });
    expect(line.brand).toBeUndefined();
    expect(line.netWeight).toBeUndefined();
    expect(line.unit).toBeUndefined();
  });

  it('moves on once added', async () => {
    const onScanAnother = jest.fn();
    openResults(
      { ...LIST, pantryId: undefined, onScanAnother },
      { answers: [addedToList()] },
    );

    await pressAdd(addLabel.shoppingList());
    await log.landed(BarcodeAddItemToShoppingListDocument);
    await act(async () => undefined);

    expect(onScanAnother).toHaveBeenCalledTimes(1);
  });
});

describe('the scanned brand', () => {
  it("is put on one of the person's lists", async () => {
    const lists: MockDataFor<typeof BrandListsDocument> = {
      brandLists: [
        {
          __typename: 'BrandList',
          id: 'list-avoid',
          name: 'Avoid',
          enabled: true,
          entries: [],
        },
      ],
    };
    const add = recordMock(AddBrandToListDocument, { held: true });
    openResults(
      { item: { ...MILK, brandId: 'brand-pack', brandName: 'Pack Brand' } },
      { answers: [recordMock(BrandListsDocument, { data: lists }), add] },
    );
    await log.landed(BrandListsDocument);
    const user = userEvent.setup();

    await user.press(screen.getByTestId(barcodeTestIDs.addBrandToList));
    expect(screen.UNSAFE_getByType(AddToBrandListSheet).props.visible).toBe(
      true,
    );
    await user.press(screen.getByText('Avoid'));
    await log.requested(AddBrandToListDocument);

    expect(inputOf(add.fired[0] ?? {})).toMatchObject({
      brandListId: 'list-avoid',
      brandId: 'brand-pack',
    });
  });
});

// Opened from a cold scanner, the pantry's rows land after the card: what an
// add joins follows them, and an amount typed meanwhile stays.
describe('pantry rows that land after it opened', () => {
  it('are followed, keeping the typed amount', async () => {
    const cache = makeCache();
    openResults({}, { cache });
    openAmount();
    typeInto(barcodeTestIDs.scanAmountQuantity, '3');
    const reading: HeldStack['amountLeft']['metric'] = readingAsAbbreviation({
      __typename: 'MeasureReading',
      value: 2,
      unitId: 'unit-pc',
      symbol: 'pc',
      displayAsFraction: false,
      type: UnitType.Count,
    });

    await act(async () => {
      seedFragment(cache, {
        fragment: UseHeldStacks_PantryItemFragmentDoc,
        fragmentName: 'useHeldStacks_pantryItem',
        data: {
          __typename: 'PantryItem',
          version: 1,
          id: 'stack-milk',
          createdAt: '2026-01-01T00:00:00.000Z',
          item: { __typename: 'Item', version: 1, id: MILK.id },
          unit: {
            __typename: 'Unit',
            id: 'unit-pc',
            type: UnitType.Count,
            displayAsFraction: false,
          },
          displayAmount: {
            __typename: 'DisplayAmount',
            quantity: 2,
            localizedSymbol: 'pc',
            fraction: null,
            unit: asAbbreviation({
              __typename: 'Unit',
              id: 'unit-pc',
              symbol: 'pc',
            }),
          },
          amountLeft: {
            __typename: 'Measure',
            value: 2,
            unitId: 'unit-pc',
            metric: reading,
            imperial: reading,
          },
        },
      });
      seedFragment(cache, {
        fragment: UseHeldStacks_PantryFragmentDoc,
        fragmentName: 'useHeldStacks_pantry',
        variables: {
          itemsFirst: undefined,
          itemsCursor: undefined,
          itemsFilter: undefined,
          itemsOrderBy: undefined,
        },
        data: {
          __typename: 'Pantry',
          id: 'pantry-1',
          itemsConnection: {
            __typename: 'PantryItemConnection',
            edges: [
              {
                __typename: 'PantryItemEdge',
                node: {
                  __typename: 'PantryItem',
                  id: 'stack-milk',
                  item: { __typename: 'Item', id: MILK.id },
                },
              },
            ],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
          },
        },
      });
    });
    await act(async () => undefined);

    expect(
      screen.getByTestId(barcodeTestIDs.scanAmountQuantity).props.value,
    ).toBe('3');
  });
});
