'use no memo';
import React from 'react';
import {
  ErrorCode,
  ExternalSource,
  NetWeightKind,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SearchResults, type SearchResultsProps } from '../SearchResults';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { recordMock } from '#/test-utils/apolloMockProvider';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';

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
      id,
    })),
  };
});

jest.mock('#domain/pantryItemDuplicate', () => {
  const isDup = jest.fn().mockReturnValue(false);
  const getInfo = jest.fn().mockReturnValue(null);
  const getInfoFromPayload = jest.fn().mockReturnValue(null);
  return {
    isPantryItemDuplicateError: isDup,
    getPantryItemDuplicateInfo: getInfo,
    getPantryItemDuplicateInfoFromPayload: getInfoFromPayload,
    promptPantryDuplicate: jest.fn(),
    getPantryItemDuplicateFromResult: jest.fn(
      (payload: { __typename?: string } | null | undefined, error: unknown) => {
        if (payload?.__typename === 'DuplicatePantryItemError') {
          const info = getInfoFromPayload(payload);
          if (info) return info;
        }
        if (error != null && isDup(error)) return getInfo(error);
        return null;
      },
    ),
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
const mockRefreshListings = jest.fn();
jest.mock('#features/barcode/hooks/useProductBrandListings', () => ({
  useProductBrandListings: () => ({
    listings: [],
    refresh: mockRefreshListings,
  }),
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
jest.mock('#features/barcode/hooks/useStorePriceMemory', () => ({
  useStorePriceMemory: () => ({ lastPaid: null, usual: null, typical: null }),
}));

/** One package counted in a piece, sized by the record: what a scan adds. */
const ONE_PACKAGE = { packages: { count: 1, unitId: 'unit-pc' } };

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

  it('renders Scan Another button', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Scan Another')).toBeTruthy();
  });

  // The screen is only reached from a pantry or shopping list, both of which
  // pass a source — but `scan/result` is deep-linkable, so a link can land a
  // user here with no destination. Offering a button that silently no-ops (its
  // handler returns early on `!source`) is worse than offering none.
  it('offers no add action when there is no source to add to', () => {
    renderWithApollo(<SearchResults {...defaultProps} source={undefined} />);
    expect(screen.queryByTestId('primary-btn')).toBeNull();
    // The card and the escape hatch still render.
    expect(screen.getByText('Scan Another')).toBeTruthy();
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
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
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

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual(ONE_PACKAGE);
    expect(firedInput.item).toEqual({ variation: 'esm-1' });
    expect(firedInput).not.toHaveProperty('quantity');
    expect(firedInput).not.toHaveProperty('netWeight');
    expect(firedInput).not.toHaveProperty('unit');
  });

  // The device's units are a persisted store, which hydrates after mount.
  it('adds in one tap when the units load after the screen opened', async () => {
    mockUnitsNow = [];
    const rec = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
        },
      },
    });
    const { rerender } = renderWithApollo(<SearchResults {...defaultProps} />, {
      operationMocks: [rec.mock],
    });

    mockUnitsNow = mockCachedUnits;
    rerender(<SearchResults {...defaultProps} />);
    fireEvent.press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
    const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
      .input;
    expect(firedInput.amount).toEqual(ONE_PACKAGE);
  });

  it('sends a package size the user changed', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
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
            unit: { __typename: 'Unit', id: 'unit-g' },
            metric: {
              __typename: 'MeasureReading',
              value: 1.36,
              unit: {
                __typename: 'Unit',
                id: 'unit-kg',
                symbol: 'kg',
                displayAsFraction: false,
                type: UnitType.Weight,
              },
            },
            imperial: {
              __typename: 'MeasureReading',
              value: 3,
              unit: {
                __typename: 'Unit',
                id: 'unit-lb',
                symbol: 'lb',
                displayAsFraction: false,
                type: UnitType.Weight,
              },
            },
            declared: null,
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

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
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

  it('adds nothing while the amount is invalid, and opens it to show why', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
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

    expect(
      await screen.findByText(t('barcode.amount.wholePackages')),
    ).toBeTruthy();
    expect(rec.fired).toHaveLength(0);
  });

  it('sends the day of the add on the input, for its default expiry', async () => {
    const rec = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
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

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
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
            pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
          },
        },
      });

    const notice = {
      source: ExternalSource.Openfoodfacts,
      notice: 'Product data from Open Food Facts, available under the ODbL.',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      sourceUrl: 'https://world.openfoodfacts.org/product/123456',
    };

    it('shows the notice its data asks for', () => {
      renderWithApollo(
        <SearchResults
          {...defaultProps}
          item={{
            ...mockItem,
            source: 'OPENFOODFACTS',
            dataAttributions: [notice],
          }}
        />,
      );
      expect(screen.getByText(notice.notice)).toBeTruthy();
    });

    it('credits nobody for an item whose data asks for no notice', () => {
      renderWithApollo(<SearchResults {...defaultProps} />);
      expect(screen.queryByText(/Open Food Facts/)).toBeNull();
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

      await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
      const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
        .input;
      expect(firedInput.amount).toEqual(ONE_PACKAGE);
      expect(firedInput.item).toEqual({ variation: 'off-1' });
      await waitFor(() => expect(onScanAnother).toHaveBeenCalledTimes(1));
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

        expect(
          await screen.findByText(t('errors.field.netWeight')),
        ).toBeTruthy();
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
        await waitFor(() => expect(alertService.alert).toHaveBeenCalled());
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

      await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
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
          pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
        },
      },
    });

    renderWithApollo(<SearchResults {...defaultProps} />, {
      operationMocks: [rec.mock],
    });

    fireEvent.press(screen.getByTestId('primary-btn'));

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
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

    await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
    const [line] = (
      rec.fired[0] as { input: { items: Record<string, unknown>[] } }
    ).input.items;
    expect(line?.item).toEqual({ variation: 'esm-1' });
    expect(line?.brand).toBeUndefined();
    expect(line?.netWeight).toBeUndefined();
    expect(line?.unit).toBeUndefined();
  });

  it("puts the scanned brand on one of the user's lists, then re-reads its listings", async () => {
    mockAddBrand.mockResolvedValue(true);
    renderWithApollo(
      <SearchResults
        {...defaultProps}
        item={{ ...mockItem, brandId: 'brand-pack', brandName: 'Pack Brand' }}
      />,
    );

    fireEvent.press(screen.getByTestId(barcodeTestIDs.addBrandToList));
    fireEvent.press(screen.getByText('Avoid'));

    await waitFor(() => expect(mockRefreshListings).toHaveBeenCalled());
    expect(mockAddBrand).toHaveBeenCalledWith(
      'list-avoid',
      { id: 'brand-pack', name: 'Pack Brand' },
      null,
    );
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
            pantryItem: { __typename: 'PantryItem', id: 'pantry-item-new' },
          },
        },
      });

      renderWithApollo(<SearchResults {...defaultProps} />, {
        operationMocks: [rec.mock],
      });
      fireEvent.press(screen.getByTestId('primary-btn'));

      await waitFor(() =>
        expect(addPantryItemLocally).toHaveBeenCalledWith(
          expect.anything(),
          defaultProps.pantryId,
          expect.objectContaining({ __typename: 'PantryItem' }),
        ),
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

      await waitFor(() =>
        expect(revertOptimisticPantryItem).toHaveBeenCalledWith(
          expect.anything(),
          defaultProps.pantryId,
          expect.any(String),
        ),
      );

      // And the refusal names the input it refused. Under a bare cache this
      // could not be asserted: without `possibleTypes` the
      // `... on ValidationError` inline fragment did not match, `field` was
      // dropped before anything read it, and every refusal of this mutation
      // fell back to the generic retry line — which a test could assert
      // successfully while a real user never saw it.
      const { alertService } = jest.requireMock('#/services/alertService');
      await waitFor(() =>
        expect(alertService.alert).toHaveBeenCalledWith(
          expect.anything(),
          "That quantity isn't valid. Try a number like 2, 0.5 or 1 1/2.",
        ),
      );
    });
  });
});
