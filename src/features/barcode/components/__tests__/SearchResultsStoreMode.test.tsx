import React from 'react';
import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  ErrorCode,
  PriceBasis,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  seedFragment,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { cacheShows } from '#/test-utils/cacheWaits';
import {
  listLine,
  purchaseRecordOf,
  purchaseRecordWatch,
  seedListLines,
  seedPurchaseRecord,
  type ListLine,
} from '#/test-utils/fixtures/shoppingListFixtures';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import {
  HouseholdUsualUnitPriceDocument,
  StorePriceMemoryDocument,
} from '#features/barcode/hooks/useStorePriceMemory.generated';
import {
  StoreShelfPricesDocument,
  type UseStoreShelfPrices_ItemFragment,
} from '#features/catalog/hooks/useStoreShelfPrices.generated';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { UseListAsksPrice_ListFragmentDoc } from '#features/shoppingList/hooks/useListAsksPrice.generated';
import { UseListCurrency_ListFragmentDoc } from '#features/shoppingList/hooks/useListCurrency.generated';
import { localizeNumericHint } from '#/utils/formatters/number';
import { isRecord } from '#/utils/isRecord';
import { SearchResults, type SearchResultsProps } from '../SearchResults';

let log = operationLog();

type ShelfPrice =
  UseStoreShelfPrices_ItemFragment['storePricesConnection']['edges'][number]['node'];
type SimilarPrice =
  UseStoreShelfPrices_ItemFragment['similarStorePrices'][number];

const JAR = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-jar',
  name: 'jar',
  symbol: 'jar',
  type: UnitType.Count,
});
const USD: ShelfPrice['currency'] = {
  __typename: 'Currency',
  id: 'usd',
  code: 'USD',
  decimalPlaces: 2,
};
const SHELF_JAR = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-jar',
  symbol: 'jar',
});
const ITEM: SearchResultsProps['item'] = {
  id: 'jif-creamy',
  conceptIds: ['peanut-butter'],
  name: 'Jif Creamy',
  upc: '051500255162',
  canEdit: false,
  canSuggest: true,
  trackingUnit: JAR,
};
const onScanAnother = jest.fn();
const PROPS: SearchResultsProps = {
  item: ITEM,
  onScanAnother,
  source: 'storeMode',
  shoppingListId: 'list-1',
};

const matchedLine = (bought = false, withUnit = true): ListLine => ({
  ...listLine('line-pb', 'Peanut butter', { bought, quantity: 1 }),
  version: 3,
  item: { __typename: 'Item', version: 1, id: ITEM.id },
  unit: withUnit ? JAR : null,
  unitName: 'jar',
  priceEstimate: { __typename: 'PriceEstimate', estimated: 3.49 },
  suggestedPrice: null,
});

const added = (held = false) =>
  recordMock(BarcodeAddItemToShoppingListDocument, {
    held,
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [],
      },
    },
  });

const addRefused = () =>
  recordMock(BarcodeAddItemToShoppingListDocument, {
    data: {
      addItemsToShoppingList: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'refused',
        field: 'itemName',
      },
    },
  });

const ticked = () =>
  recordMock(UpdateShoppingListItemDocument, {
    dataFor: (
      variables,
    ): MockDataFor<typeof UpdateShoppingListItemDocument> => {
      const input = isRecord(variables.input) ? variables.input : {};
      return {
        updateShoppingListItem: {
          __typename: 'UpdateShoppingListItemPayload',
          shoppingListItem: {
            __typename: 'ShoppingListItem',
            id: typeof input.id === 'string' ? input.id : '',
            version:
              (typeof input.version === 'number' ? input.version : 0) + 1,
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
            },
          },
        },
      };
    },
  });

const tickRefused = () =>
  recordMock(UpdateShoppingListItemDocument, {
    data: {
      updateShoppingListItem: {
        __typename: 'ValidationError',
        code: ErrorCode.ValidationFailed,
        message: 'refused',
        field: 'itemName',
      },
    },
  });

const priceMemory = () =>
  recordMock(StorePriceMemoryDocument, {
    data: {
      item: {
        id: ITEM.id,
        usualUnit: { id: JAR.id },
        householdPriceSummary: {
          currency: USD,
          lastPaid: null,
          usual: {
            basis: PriceBasis.PerKg,
            medianPrice: 7.69,
            unitPrice: 3.49,
          },
        },
        priceComparison: { currency: USD, rows: [] },
      },
      shoppingList: { id: 'list-1', targetStore: null },
    },
  });

const shelfPrice = (): ShelfPrice => ({
  __typename: 'ItemStorePrice',
  store: { __typename: 'Store', id: 's-aldi', name: 'ALDI' },
  price: 1.99,
  regularPrice: 1.99,
  onPromotion: false,
  typicalPrice: 1.99,
  lowestPrice: 1.99,
  coveredDays: 90,
  normalizedPrice: null,
  normalizedBasis: null,
  isCurrent: true,
  confirmedAt: '2026-10-16T18:11:52.922Z',
  aisle: null,
  unit: SHELF_JAR,
  currency: USD,
});

const similarPrice = (): SimilarPrice => ({
  __typename: 'SimilarStorePrice',
  store: { __typename: 'Store', id: 's-kroger', name: 'Kroger' },
  product: {
    __typename: 'Item',
    version: 1,
    id: 'item-kroger-pb',
    name: 'Kroger Creamy Peanut Butter',
  },
  price: 1.79,
  unit: SHELF_JAR,
  packageNetWeight: 16,
  packageNetWeightUnit: asAbbreviation({
    __typename: 'Unit',
    id: 'unit-oz',
    symbol: 'oz',
  }),
  normalizedPrice: 3.95,
  basis: PriceBasis.PerKg,
  currency: USD,
});

const shelfPrices = ({ similar = false } = {}) =>
  recordMock(StoreShelfPricesDocument, {
    data: {
      item: {
        id: ITEM.id,
        storePricesConnection: {
          __typename: 'ItemStorePriceConnection',
          edges: [{ __typename: 'ItemStorePriceEdge', node: shelfPrice() }],
        },
        similarStorePrices: similar ? [similarPrice()] : [],
      },
    },
  });

function openStore({
  lines = [],
  answers = [],
  priceTracking = true,
  props = {},
}: {
  lines?: ListLine[];
  answers?: ReturnType<typeof recordMock>[];
  priceTracking?: boolean;
  props?: Partial<SearchResultsProps>;
} = {}) {
  const cache = makeCache();
  seedListLines(cache, 'list-1', lines);
  for (const line of lines) {
    if (!line.id) throw new Error('a seeded line needs an id');
    seedPurchaseRecord(cache, line.id, {
      isPurchased: line.purchaseInfo?.isPurchased ?? false,
      movedToPantryAt: line.purchaseInfo?.movedToPantryAt ?? null,
    });
  }
  seedFragment(cache, {
    fragment: UseListCurrency_ListFragmentDoc,
    fragmentName: 'useListCurrency_list',
    data: {
      __typename: 'ShoppingList',
      version: 1,
      id: 'list-1',
      currency: 'USD',
    },
  });
  seedFragment(cache, {
    fragment: UseListAsksPrice_ListFragmentDoc,
    fragmentName: 'useListAsksPrice_list',
    data: {
      __typename: 'ShoppingList',
      version: 1,
      id: 'list-1',
      priceTracking,
    },
  });
  const view = renderWithApollo(<SearchResults {...PROPS} {...props} />, {
    cache,
    links: [log.link],
    operationMocks: answers.map(answer => answer.mock),
  });
  return { ...view, cache };
}

const press = async (label: string) => {
  await userEvent.setup().press(screen.getByRole('button', { name: label }));
};

const enterPrice = async (open = true) => {
  if (open) await press(t('barcode.addToCartWithPrice'));
  fireEvent.changeText(
    screen.getByTestId(shoppingListTestIDs.purchaseQuantityInput),
    '2',
  );
  fireEvent.changeText(
    screen.getByTestId(shoppingListTestIDs.purchasePriceInput),
    '7',
  );
};

const confirmPrice = async (open = true) => {
  await enterPrice(open);
  await press(t('labels.save'));
};

const purchaseSettles = (
  cache: ReturnType<typeof makeCache>,
  id: string,
  isPurchased: boolean,
) =>
  cacheShows(
    cache,
    purchaseRecordWatch(id),
    () => purchaseRecordOf(cache, id),
    record => record?.isPurchased === isPurchased,
  );

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    cachedUnits: [JAR],
    selectedHomeId: 'home-1',
    budgetAndPrices: true,
    isOnline: true,
    apiReachable: true,
  });
});

describe('SearchResults from store mode', () => {
  it('offers the add for the list being shopped', () => {
    openStore();

    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });

  it('shows price memory for the list, and none outside store mode', async () => {
    const memory = priceMemory();
    const { unmount } = openStore({ answers: [memory] });
    await log.landed(StorePriceMemoryDocument);

    expect(memory.fired).toEqual([
      { itemId: ITEM.id, homeId: 'home-1', listId: 'list-1' },
    ]);
    expect(screen.getByText(t('barcode.price.usual'))).toBeTruthy();
    unmount();

    const unread = priceMemory();
    openStore({ props: { source: 'shoppingList' }, answers: [unread] });
    await act(async () => undefined);
    expect(unread.fired).toEqual([]);
    expect(screen.queryByText(t('barcode.price.usual'))).not.toBeOnTheScreen();
  });

  it('shows shelf prices for the list, and none outside store mode', async () => {
    const shelf = shelfPrices();
    const { unmount } = openStore({ answers: [shelf] });
    await log.landed(StoreShelfPricesDocument);

    expect(shelf.fired).toEqual([{ itemId: ITEM.id }]);
    expect(screen.getByTestId(barcodeTestIDs.storeShelfPrices)).toBeTruthy();
    expect(screen.getByText(t('storeShelfPrices.title'))).toBeTruthy();
    expect(
      screen.getByTestId(catalogTestIDs.storeShelfPrice('s-aldi')),
    ).toBeTruthy();
    unmount();

    const unread = shelfPrices();
    openStore({ props: { source: 'shoppingList' }, answers: [unread] });
    await act(async () => undefined);
    expect(unread.fired).toEqual([]);
    expect(
      screen.queryByTestId(barcodeTestIDs.storeShelfPrices),
    ).not.toBeOnTheScreen();
  });

  it('shows similar products from the same shelf-price answer', async () => {
    openStore({ answers: [shelfPrices({ similar: true })] });
    await log.landed(StoreShelfPricesDocument);

    expect(screen.getByText(t('storeShelfPrices.similarTitle'))).toBeTruthy();
    expect(
      screen.getByTestId(catalogTestIDs.storeShelfSimilarPrice('s-kroger')),
    ).toBeTruthy();
  });

  it('offers no priced add for a list that does not track prices', () => {
    openStore({ priceTracking: false });

    expect(
      screen.queryByText(t('barcode.addToCartWithPrice')),
    ).not.toBeOnTheScreen();
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });

  describe('with budget and prices off', () => {
    beforeEach(() => useStore.setState({ budgetAndPrices: false }));

    it('reads no prices and offers no priced add', async () => {
      const memory = priceMemory();
      const shelf = shelfPrices();
      openStore({ answers: [memory, shelf] });
      await act(async () => undefined);

      expect(memory.fired).toEqual([]);
      expect(shelf.fired).toEqual([]);
      expect(
        screen.queryByText(t('barcode.price.usual')),
      ).not.toBeOnTheScreen();
      expect(
        screen.queryByText(t('barcode.addToCartWithPrice')),
      ).not.toBeOnTheScreen();
      expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
    });

    it('still ticks the matched line with no price', async () => {
      const tick = ticked();
      const { cache } = openStore({ lines: [matchedLine()], answers: [tick] });

      await press(t('barcode.addToCart'));
      await log.landed(UpdateShoppingListItemDocument);
      await purchaseSettles(cache, 'line-pb', true);

      expect(inputOf(tick.fired[0] ?? {})).toMatchObject({
        id: 'line-pb',
        purchaseTracking: { isPurchased: true },
      });
    });
  });

  it('ticks the matched line with no price', async () => {
    const tick = ticked();
    const add = added();
    const { cache } = openStore({
      lines: [matchedLine()],
      answers: [tick, add],
    });

    await press(t('barcode.addToCart'));
    await log.landed(UpdateShoppingListItemDocument);
    await purchaseSettles(cache, 'line-pb', true);

    expect(add.fired).toEqual([]);
    expect(inputOf(tick.fired[0] ?? {})).toMatchObject({
      id: 'line-pb',
      purchaseTracking: {
        isPurchased: true,
        purchasedItem: { itemId: ITEM.id },
      },
    });
    expect(onScanAnother).toHaveBeenCalledTimes(1);
  });

  it('adds an unlisted product and ticks the new line', async () => {
    const add = added();
    const tick = ticked();
    const { cache } = openStore({ answers: [add, tick] });

    await press(t('barcode.addToCart'));
    await log.landed(BarcodeAddItemToShoppingListDocument);
    await log.landed(UpdateShoppingListItemDocument);
    const input = inputOf(tick.fired[0] ?? {});
    await purchaseSettles(cache, String(input.id), true);

    expect(add.fired).toHaveLength(1);
    expect(input).toMatchObject({
      purchaseTracking: {
        isPurchased: true,
        purchasedItem: { itemId: ITEM.id },
      },
    });
  });

  it('says so when the new line is refused, and ticks nothing', async () => {
    const add = addRefused();
    const tick = ticked();
    openStore({ answers: [add, tick] });

    await press(t('barcode.addToCart'));
    await log.landed(BarcodeAddItemToShoppingListDocument);
    await act(async () => undefined);

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.addItemFailedRetry'),
    );
    expect(tick.fired).toEqual([]);
    expect(onScanAnother).not.toHaveBeenCalled();
  });

  it('offers no priced add while an add is in flight', async () => {
    const add = added(true);
    const tick = ticked();
    openStore({ answers: [add, tick] });
    const priceAction = () =>
      screen.getByRole('button', { name: t('barcode.addToCartWithPrice') });
    expect(priceAction()).not.toBeDisabled();

    await press(t('barcode.addToCart'));
    await log.requested(BarcodeAddItemToShoppingListDocument);
    expect(priceAction()).toBeDisabled();

    add.release();
    await log.landed(BarcodeAddItemToShoppingListDocument);
    await log.landed(UpdateShoppingListItemDocument);
    expect(tick.fired).toHaveLength(1);
  });

  it('records what the purchase sheet took', async () => {
    const tick = ticked();
    const { cache } = openStore({ lines: [matchedLine()], answers: [tick] });

    await confirmPrice();
    await log.landed(UpdateShoppingListItemDocument);
    await purchaseSettles(cache, 'line-pb', true);

    expect(inputOf(tick.fired[0] ?? {})).toMatchObject({
      purchaseTracking: {
        purchasedQuantity: 2,
        purchasedPrice: 3.5,
      },
    });
  });

  it('prices an unlisted product in its own unit, with no estimate', async () => {
    const add = added();
    const tick = ticked();
    openStore({ answers: [add, tick] });

    await press(t('barcode.addToCartWithPrice'));
    expect(
      screen.getByTestId(shoppingListTestIDs.purchasePriceInput).props
        .placeholder,
    ).toBe(localizeNumericHint(t('purchaseAmountSheet.pricePlaceholder')));
    await confirmPrice(false);
    await log.landed(BarcodeAddItemToShoppingListDocument);
    await log.landed(UpdateShoppingListItemDocument);

    expect(inputOf(tick.fired[0] ?? {})).toMatchObject({
      purchaseTracking: { purchasedQuantity: 2, purchasedPrice: 3.5 },
    });
  });

  it("compares a price in the sheet's unit, and offers no comparison without one", async () => {
    const memory = priceMemory();
    const converted = recordMock(HouseholdUsualUnitPriceDocument, {
      held: true,
    });
    const { unmount } = openStore({
      lines: [matchedLine()],
      answers: [memory, converted],
    });
    await log.landed(StorePriceMemoryDocument);
    await enterPrice();
    expect(
      screen.getByTestId(shoppingListTestIDs.purchasePriceNote),
    ).toBeTruthy();
    expect(converted.fired).toEqual([]);
    unmount();

    openStore({ lines: [matchedLine(false, false)] });
    await enterPrice();
    expect(
      screen.queryByTestId(shoppingListTestIDs.purchasePriceNote),
    ).not.toBeOnTheScreen();
  });

  it('offers nothing to add for a product already in the cart', () => {
    openStore({ lines: [matchedLine(true)] });

    expect(screen.getByText(t('barcode.alreadyInCart'))).toBeDisabled();
    expect(
      screen.queryByText(t('barcode.addToCartWithPrice')),
    ).not.toBeOnTheScreen();
  });

  describe('the price sheet', () => {
    it('stays open when the tick is refused', async () => {
      const tick = tickRefused();
      const { cache } = openStore({ lines: [matchedLine()], answers: [tick] });

      await confirmPrice();
      await log.landed(UpdateShoppingListItemDocument);
      await purchaseSettles(cache, 'line-pb', false);

      expect(tick.fired).toHaveLength(1);
      expect(
        screen.getByTestId(shoppingListTestIDs.purchasePriceInput),
      ).toBeOnTheScreen();
      expect(onScanAnother).not.toHaveBeenCalled();
    });

    it('stays open, and says so, when the product cannot be added', async () => {
      const add = addRefused();
      const tick = ticked();
      openStore({ answers: [add, tick] });

      await confirmPrice();
      await log.landed(BarcodeAddItemToShoppingListDocument);
      await act(async () => undefined);

      expect(alertService.alert).toHaveBeenCalledWith(
        t('labels.error'),
        t('errors.addItemFailedRetry'),
      );
      expect(
        screen.getByTestId(shoppingListTestIDs.purchasePriceInput),
      ).toBeOnTheScreen();
      expect(tick.fired).toEqual([]);
    });

    it('closes once the product is in the cart', async () => {
      const tick = ticked();
      openStore({ lines: [matchedLine()], answers: [tick] });

      await confirmPrice();
      await log.landed(UpdateShoppingListItemDocument);
      await act(async () => undefined);

      expect(onScanAnother).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByTestId(shoppingListTestIDs.purchasePriceInput),
      ).not.toBeOnTheScreen();
    });
  });

  it('stays put when the tick is refused', async () => {
    const tick = tickRefused();
    const { cache } = openStore({ lines: [matchedLine()], answers: [tick] });

    await press(t('barcode.addToCart'));
    await log.landed(UpdateShoppingListItemDocument);
    await purchaseSettles(cache, 'line-pb', false);

    expect(tick.fired).toHaveLength(1);
    expect(onScanAnother).not.toHaveBeenCalled();
    expect(screen.getByText(t('barcode.addToCart'))).toBeTruthy();
  });
});
