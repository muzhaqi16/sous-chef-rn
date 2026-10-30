'use no memo';
import React from 'react';
import type { ScannedItem } from '#features/barcode/types';
import {
  ErrorCode,
  NetWeightKind,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  UseHeldStacks_PantryFragmentDoc,
  UseHeldStacks_PantryItemFragmentDoc,
} from '#features/pantry/hooks/useHeldStacks.generated';
import type { HeldStack } from '#features/pantry/hooks/useHeldStacks';
import { SearchResults, type SearchResultsProps } from '../SearchResults';
import {
  renderWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { recordMock } from '#/test-utils/apolloMockProvider';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  ...jest.requireActual('#/apollo/utils/cacheUpdaters'),
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
  createRemoveFromParentConnectionUpdater: jest.fn(() => jest.fn()),
  safeEvict: jest.fn(),
}));

jest.mock('#features/pantry/cache/items', () => {
  const actual = jest.requireActual('#features/pantry/cache/items');
  // Spied, not stubbed: the counting these do is what the assertions rest on,
  // and it is proven against a real cache in `pantryItemLocalWrites.test.ts`.
  return {
    ...actual,
    addPantryItemLocally: jest.fn(actual.addPantryItemLocally),
    revertOptimisticPantryItem: jest.fn(actual.revertOptimisticPantryItem),
  };
});

jest.mock('#features/shoppingList/cache/connections', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#features/shoppingList/cache/items', () => {
  const { buildAddItemsReconcileUpdate } = jest.requireActual(
    '#features/shoppingList/cache/items',
  );
  return {
    buildAddItemsReconcileUpdate,
    addLocalShoppingListItem: jest.fn(),
    createLocalShoppingListItem: jest.fn((id: string) => ({
      __typename: 'ShoppingListItem',
      version: 1,
      id,
    })),
  };
});

// The counting units the device holds: a scan is counted in a piece.
const mockCachedUnits = [
  { id: 'unit-pc', name: 'piece', symbol: 'pc', type: 'COUNT' },
];
let mockUnitsNow: typeof mockCachedUnits = mockCachedUnits;
jest.mock('#store/useAppStore', () => ({
  useCachedUnits: () => mockUnitsNow,
  useAppStore: jest.fn(
    (
      selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
    ) => {
      const state = { setPendingPantryScrollToTop: jest.fn() };
      return selector(state);
    },
  ),
}));

jest.mock('../ProductResultCard', () =>
  require('#/test-utils/searchResultsStubs'),
);
jest.mock('../ActionButtons', () => require('#/test-utils/searchResultsStubs'));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () =>
  require('#/test-utils/searchResultsStubs'),
);

// Alerts have their own tests; here the household has nothing to check.
jest.mock('#features/barcode/hooks/useProductOrigin', () => ({
  useProductOrigin: () => ({ lines: [] }),
}));
jest.mock('#features/barcode/hooks/useProductBrandListings', () => ({
  useProductBrandListings: () => ({ listings: [] }),
}));
const mockAddBrand = jest.fn();
jest.mock('#features/profile/hooks/useBrandLists', () => ({
  useBrandLists: () => ({
    lists: [{ id: 'list-avoid', name: 'Avoid', enabled: true, brands: [] }],
    addBrand: mockAddBrand,
  }),
}));
jest.mock('#features/barcode/hooks/useProductDietaryAlerts', () => ({
  useProductDietaryAlerts: () => ({
    check: 'none',
    alerts: [],
    alternatives: [],
  }),
}));
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: () => false,
}));
jest.mock('#features/barcode/hooks/useStorePriceMemory', () => ({
  useStorePriceMemory: () => ({ lastPaid: null, usual: null, typical: null }),
}));

// Store mode's shelf prices have their own tests; here, which list they are read for.
const mockShelfListIds: (string | null | undefined)[] = [];
jest.mock('#features/catalog/hooks/useStoreShelfPrices', () => ({
  ...jest.requireActual('#features/catalog/hooks/useStoreShelfPrices'),
  useStoreShelfPrices: (_itemId: string, listId: string | null | undefined) => {
    mockShelfListIds.push(listId);
    return { rows: [], similarRows: [] };
  },
}));

/** One package counted in a piece, sized by the record: what a scan adds. */
const ONE_PACKAGE = { packages: { count: 1, unitId: 'unit-pc' } };

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('SearchResults', () => {
  const mockItem = {
    id: 'item-1',
    conceptIds: [],
    name: 'Organic Milk',
    upc: '123456',
    netWeight: 1,
    canEdit: false,
    canSuggest: true,
  };

  const defaultProps: SearchResultsProps = {
    item: mockItem,
    onScanAnother: jest.fn(),
    source: 'pantry',
    pantryId: 'pantry-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUnitsNow = mockCachedUnits;
  });

  it('renders item name', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  it('renders Add to Pantry button for pantry source', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });

  it('reads no shelf prices for a scan from the pantry or a list', () => {
    const { unmount } = renderWithApollo(<SearchResults {...defaultProps} />);
    expect(mockShelfListIds.at(-1)).toBeNull();
    unmount();

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        shoppingListId="list-1"
      />,
    );
    expect(mockShelfListIds.at(-1)).toBeNull();
    expect(screen.queryByTestId(barcodeTestIDs.storeShelfPrices)).toBeNull();
  });

  it('renders Add to shopping list button for shopping list source', () => {
    renderWithApollo(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        shoppingListId="list-1"
      />,
    );
    expect(screen.getByText('Add to shopping list')).toBeTruthy();
  });

  // The header's scan button is the way to the next scan; the body offers only
  // the add, beside what it adds.
  it('offers no second scan button in the body', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.queryByText('Scan Another')).toBeNull();
  });

  // The screen is only reached from a pantry or shopping list, both of which
  // pass a source — but `scan/result` is deep-linkable, so a link can land a
  // user here with no destination. Offering a button that silently no-ops (its
  // handler returns early on `!source`) is worse than offering none.
  it('offers no add action when there is no source to add to', () => {
    renderWithApollo(<SearchResults {...defaultProps} source={undefined} />);
    expect(screen.queryByTestId('primary-btn')).toBeNull();
    // The card still renders.
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  // A 1.89 L carton is ONE container, counted as one: left to the API, a count
  // lands in the item's tracking unit, which can be a measure (1 oz, 1 cup).
  // Its size belongs to the barcode's record, which the add names: a size sent
  // beside it would be stored as the user's own edit.
  it('adds one counted package naming the scanned record, and no size of its own', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{
          ...mockItem,
          variationId: 'esm-1',
          netWeight: 1.89,
          displayUnit: { id: 'unit-litre', name: 'litre', symbol: 'L' },
        }}
      />,
      { operationMocks: [rec.mock] },
    );

    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual(ONE_PACKAGE);
    expect(firedInput.item).toEqual({ variation: 'esm-1' });
    expect(firedInput).not.toHaveProperty('quantity');
    expect(firedInput).not.toHaveProperty('netWeight');
    expect(firedInput).not.toHaveProperty('unit');
    expect(firedInput).not.toHaveProperty('consumeUnit');
  });

  // The device's units are a persisted store, which hydrates after mount.
  it('adds in one tap when the units load after the screen opened', async () => {
    mockUnitsNow = [];
    const rec = recordMock(CreatePantryItemDocument, {
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
    const { rerender } = renderWithApollo(<SearchResults {...defaultProps} />, {
      operationMocks: [rec.mock],
    });

    mockUnitsNow = mockCachedUnits;
    rerender(<SearchResults {...defaultProps} />);
    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual(ONE_PACKAGE);
  });

  it('sends a package size the user changed', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{
          ...mockItem,
          variationId: 'esm-1',
          netWeightKind: NetWeightKind.Package,
          packageSize: {
            __typename: 'Measure',
            value: 1360.78,
            unitId: 'unit-g',
            metric: readingAsAbbreviation({
              __typename: 'MeasureReading',
              value: 1.36,
              unitId: 'unit-kg',
              symbol: 'kg',
              displayAsFraction: false,
              type: UnitType.Weight,
            }),
            imperial: readingAsAbbreviation({
              __typename: 'MeasureReading',
              value: 3,
              unitId: 'unit-lb',
              symbol: 'lb',
              displayAsFraction: false,
              type: UnitType.Weight,
            }),
          },
        }}
      />,
      { operationMocks: [rec.mock] },
    );

    // No settings cached: the API's own fallback, metric.
    expect(screen.getByText('1 pc · 1.36 kg each')).toBeTruthy();
    fireEvent.press(screen.getByTestId(barcodeTestIDs.scanAmountSummary));
    fireEvent.changeText(
      screen.getByTestId(barcodeTestIDs.scanAmountSize),
      '2',
    );
    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual({
      packages: {
        count: 1,
        unitId: 'unit-pc',
        size: { netWeight: 2, netWeightUnitId: 'unit-kg' },
      },
    });
  });

  // USM-4: a "6 x 250mL" six-pack adds as 6 cans of 250 ml, never as one
  // package of the record's 1500 mL.
  it('adds a six-pack as its six cans, each one can’s size', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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
    const volume = (
      value: number,
      unitId: string,
      symbol: string,
    ): NonNullable<ScannedItem['packageSize']>['metric'] =>
      readingAsAbbreviation({
        __typename: 'MeasureReading',
        value,
        unitId,
        symbol,
        displayAsFraction: false,
        type: UnitType.Volume,
      });

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{
          ...mockItem,
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
        }}
      />,
      { operationMocks: [rec.mock] },
    );

    expect(screen.getByText('6 can · 250 ml each')).toBeTruthy();
    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual({
      packages: {
        count: 6,
        unitId: 'unit-can',
        size: { netWeight: 250, netWeightUnitId: 'unit-ml' },
      },
    });
  });

  it('adds nothing while the amount is invalid, and opens it to show why', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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
    renderWithApollo(<SearchResults {...defaultProps} />, {
      operationMocks: [rec.mock],
    });

    fireEvent.press(screen.getByTestId(barcodeTestIDs.scanAmountSummary));
    fireEvent.changeText(
      screen.getByTestId(barcodeTestIDs.scanAmountQuantity),
      '1 1/2',
    );
    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(screen.getByText(t('barcode.amount.wholePackages'))).toBeTruthy();
    expect(rec.fired).toHaveLength(0);
  });

  it('sends the day of the add on the input, for its default expiry', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{ ...mockItem, variationId: 'esm-1' }}
      />,
      { operationMocks: [rec.mock] },
    );

    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const [fired] = rec.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fired?.input).toMatchObject({ today: fired?.today });
  });

  describe('a product from Open Food Facts', () => {
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

    // The size is the user's to add if they know it; unasked, the API counts
    // an unsized package in a counted stack.
    it('adds one counted package without asking for the size it lacks', async () => {
      const rec = created();
      const onScanAnother = jest.fn();
      renderWithApollo(
        <SearchResults
          {...defaultProps}
          onScanAnother={onScanAnother}
          item={{
            ...mockItem,
            source: 'OPENFOODFACTS',
            netWeight: undefined,
            variationId: 'off-1',
          }}
        />,
        { operationMocks: [rec.mock] },
      );

      expect(screen.getByText('1 pc')).toBeTruthy();
      fireEvent.press(screen.getByTestId('primary-btn'));

      await drainTimers();
      expect(rec.fired.length).toBeGreaterThan(0);
      const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
        .input;
      expect(firedInput.amount).toEqual(ONE_PACKAGE);
      expect(firedInput.item).toEqual({ variation: 'off-1' });
      await drainTimers();
      expect(onScanAnother).toHaveBeenCalledTimes(1);
    });

    describe('a refused add', () => {
      const offItem = {
        ...mockItem,
        source: 'OPENFOODFACTS',
        netWeight: undefined,
        variationId: 'off-1',
      };
      const refusedOn = (field: string) =>
        recordMock(CreatePantryItemDocument, {
          data: {
            createPantryItem: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              message: 'refused',
              field,
            },
          },
        });

      it('shows a refused size on the size field, opened, and no alert', async () => {
        const rec = refusedOn('netWeight');
        const onScanAnother = jest.fn();
        renderWithApollo(
          <SearchResults
            {...defaultProps}
            onScanAnother={onScanAnother}
            item={offItem}
          />,
          { operationMocks: [rec.mock] },
        );

        fireEvent.press(screen.getByTestId('primary-btn'));

        await drainTimers();
        expect(screen.getByText(t('errors.field.netWeight'))).toBeTruthy();
        expect(screen.getByTestId(barcodeTestIDs.scanAmountSize)).toBeTruthy();
        const { alertService } = jest.requireMock('#/services/alertService');
        expect(alertService.alert).not.toHaveBeenCalled();
        expect(onScanAnother).not.toHaveBeenCalled();
      });

      it('alerts a refusal no amount field can show', async () => {
        const rec = refusedOn('quantity');
        renderWithApollo(<SearchResults {...defaultProps} item={offItem} />, {
          operationMocks: [rec.mock],
        });

        fireEvent.press(screen.getByTestId('primary-btn'));

        const { alertService } = jest.requireMock('#/services/alertService');
        await drainTimers();
        expect(alertService.alert).toHaveBeenCalled();
        expect(alertService.alert).toHaveBeenCalledTimes(1);
        expect(alertService.alert).toHaveBeenCalledWith(
          t('labels.error'),
          t('errors.field.quantity'),
        );
      });
    });

    it('adds in one tap when the record states its pack size', async () => {
      const rec = created();
      renderWithApollo(
        <SearchResults
          {...defaultProps}
          item={{
            ...mockItem,
            source: 'OPENFOODFACTS',
            netWeight: 16,
            netWeightKind: NetWeightKind.Package,
            variationId: 'off-2',
          }}
        />,
        { operationMocks: [rec.mock] },
      );

      fireEvent.press(screen.getByTestId('primary-btn'));

      await drainTimers();
      expect(rec.fired.length).toBeGreaterThan(0);
      const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
        .input;
      expect(firedInput.amount).toEqual(ONE_PACKAGE);
    });
  });

  it('names the item when the scan found no record for the barcode', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
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

    renderWithApollo(<SearchResults {...defaultProps} />, {
      operationMocks: [rec.mock],
    });

    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    expect(
      (rec.fired[0] as { input: Record<string, unknown> }).input.item,
    ).toEqual({ id: 'item-1' });
  });

  // The record carries the pack's brand and size to the line; a brand or size
  // sent beside it would replace them.
  it("adds a list line naming the record, and neither brand nor size of the scan's", async () => {
    const rec = recordMock(BarcodeAddItemToShoppingListDocument, {
      data: {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results: [],
        },
      },
    });

    renderWithApollo(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        pantryId={undefined}
        shoppingListId="list-1"
        item={{
          ...mockItem,
          variationId: 'esm-1',
          brandId: 'brand-pack',
          brandName: 'Pack Brand',
          displayUnit: { id: 'unit-litre', name: 'litre', symbol: 'L' },
        }}
      />,
      { operationMocks: [rec.mock] },
    );

    fireEvent.press(screen.getByTestId('primary-btn'));

    await drainTimers();
    expect(rec.fired.length).toBeGreaterThan(0);
    const [line] = (
      rec.fired[0] as { input: { items: Record<string, unknown>[] } }
    ).input.items;
    expect(line?.item).toEqual({ variation: 'esm-1' });
    expect(line?.brand).toBeUndefined();
    expect(line?.netWeight).toBeUndefined();
    expect(line?.unit).toBeUndefined();
  });

  it("puts the scanned brand on one of the user's lists", async () => {
    mockAddBrand.mockResolvedValue(true);
    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{ ...mockItem, brandId: 'brand-pack', brandName: 'Pack Brand' }}
      />,
    );

    fireEvent.press(screen.getByTestId(barcodeTestIDs.addBrandToList));
    fireEvent.press(screen.getByText('Avoid'));

    await drainTimers();
    expect(mockAddBrand).toHaveBeenCalledWith(
      'list-avoid',
      { id: 'brand-pack', name: 'Pack Brand' },
      null,
    );
  });

  // Opened from a cold scanner, the pantry's rows land after the card: what an
  // add opens or joins follows them, and an amount typed meanwhile stays.
  it('follows the pantry rows that land after it opened, keeping the typed amount', async () => {
    const cache = makeCache();
    renderWithApollo(<SearchResults {...defaultProps} />, {
      cache,
      operationMocks: [],
    });
    fireEvent.press(screen.getByTestId(barcodeTestIDs.scanAmountSummary));
    fireEvent.changeText(
      screen.getByTestId(barcodeTestIDs.scanAmountQuantity),
      '3',
    );
    // No stack known: the add opens one, which alone takes a consume unit.
    expect(screen.getByText(t('labels.usedIn'))).toBeTruthy();

    const reading: HeldStack['held']['metric'] = readingAsAbbreviation({
      __typename: 'MeasureReading',
      value: 2,
      unitId: 'unit-pc',
      symbol: 'pc',
      displayAsFraction: false,
      type: UnitType.Count,
    });
    act(() => {
      seedFragment(cache, {
        fragment: UseHeldStacks_PantryItemFragmentDoc,
        fragmentName: 'useHeldStacks_pantryItem',
        data: {
          __typename: 'PantryItem',
          version: 1,
          id: 'stack-milk',
          createdAt: '2026-01-01T00:00:00.000Z',
          item: { __typename: 'Item', version: 1, id: mockItem.id },
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
          held: {
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
                  item: { __typename: 'Item', id: mockItem.id },
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

    await drainTimers();
    expect(screen.queryByText(t('labels.usedIn'))).toBeNull();
    expect(
      screen.getByTestId(barcodeTestIDs.scanAmountQuantity).props.value,
    ).toBe('3');
  });

  describe('the pantry item count', () => {
    // The connection write moves the LIST; the header's "N items" reads
    // `Pantry.stats.totalItems`, which the mutation's `update:` callback never
    // touches when the create is queued offline. Publishing and withdrawing
    // both go through the counting helpers so the two cannot drift.
    const { addPantryItemLocally, revertOptimisticPantryItem } =
      jest.requireMock('#features/pantry/cache/items');

    it('moves with the optimistic row, before the server answers', async () => {
      const rec = recordMock(CreatePantryItemDocument, {
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

      renderWithApollo(<SearchResults {...defaultProps} />, {
        operationMocks: [rec.mock],
      });
      fireEvent.press(screen.getByTestId('primary-btn'));

      await drainTimers();
      expect(addPantryItemLocally).toHaveBeenCalledWith(
        expect.anything(),
        defaultProps.pantryId,
        expect.objectContaining({ __typename: 'PantryItem' }),
      );
    });

    it('is taken back when the server refuses the create', async () => {
      const rec = recordMock(CreatePantryItemDocument, {
        data: {
          createPantryItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'nope',
            field: 'quantity',
          },
        },
      });

      renderWithApollo(<SearchResults {...defaultProps} />, {
        operationMocks: [rec.mock],
      });
      fireEvent.press(screen.getByTestId('primary-btn'));

      await drainTimers();
      expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
        expect.anything(),
        defaultProps.pantryId,
        expect.any(String),
      );

      // And the refusal names the input it refused. Under a bare cache this
      // could not be asserted: without `possibleTypes` the
      // `... on ValidationError` inline fragment did not match, `field` was
      // dropped before anything read it, and every refusal of this mutation
      // fell back to the generic retry line — which a test could assert
      // successfully while a real user never saw it.
      const { alertService } = jest.requireMock('#/services/alertService');
      await drainTimers();
      expect(alertService.alert).toHaveBeenCalledWith(
        expect.anything(),
        "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
      );
    });
  });
});
