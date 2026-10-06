'use no memo';
import React from 'react';
import {
  ErrorCode,
  ExternalSource,
  NetWeightKind,
} from '#/graphql/generated/schemaTypes';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SearchResults, type SearchResultsProps } from '../SearchResults';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { recordMock } from '#/test-utils/apolloMockProvider';
import { BarcodeAddItemToShoppingListDocument } from '#features/barcode/hooks/useAddScannedItem.generated';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { t } from '#/i18n';
import type { PackSizeOutcome } from '../PackSizeSheet';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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
  const { settledStatus } = jest.requireActual('#/apollo/utils/settleMutation');
  const { buildAddItemsReconcileUpdate } = jest.requireActual(
    '#features/shoppingList/cache/items',
  );
  const revertOptimisticShoppingListItem = jest.fn();
  return {
    buildAddItemsReconcileUpdate,
    revertOptimisticShoppingListItem,
    addLocalShoppingListItem: jest.fn(),
    createLocalShoppingListItem: jest.fn((id: string) => ({
      __typename: 'ShoppingListItem',
      id,
    })),
    // Mirror the real reconciler (real classify + mocked revert) so the
    // keep/revert decision under test matches production.
    reconcileShoppingCreate: jest.fn(
      (cache: unknown, listId: string, id: string, result: unknown) => {
        if (settledStatus(result) === 'failed') {
          revertOptimisticShoppingListItem(cache, listId, id);
          return 'reverted';
        }
        return 'kept';
      },
    ),
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

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(
    (
      selector: (state: { setPendingPantryScrollToTop: () => void }) => unknown,
    ) => {
      const state = { setPendingPantryScrollToTop: jest.fn() };
      return selector(state);
    },
  ),
}));

// Use the real wrappers so pressing the add button actually runs the async
// handler (the auto-mock would no-op the callbacks and never fire the mutation).
jest.mock('#/utils/finallyHelpers', () =>
  jest.requireActual('#/utils/finallyHelpers'),
);

jest.mock('../ProductResultCard', () => ({
  ProductResultCard: ({ item }: { item: { name: string } }) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, item.name);
  },
}));

// The sheet's own form is pinned in `PackSizeSheet.test.tsx`; here it hands
// back a size when shown, and closes as the real one does: only on `done`.
const mockPackSizeOutcomes: PackSizeOutcome[] = [];
jest.mock('../PackSizeSheet', () => ({
  PackSizeSheet: ({
    visible,
    onConfirm,
    onDismiss,
  }: {
    visible: boolean;
    onConfirm: (size: {
      netWeight: number;
      netWeightUnitId: string;
    }) => Promise<PackSizeOutcome>;
    onDismiss: () => void;
  }) => {
    if (!visible) return null;
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.Pressable,
      {
        testID: 'pack-size-stub',
        onPress: async () => {
          const outcome = await onConfirm({
            netWeight: 32,
            netWeightUnitId: 'unit-oz',
          });
          mockPackSizeOutcomes.push(outcome);
          if (outcome.status === 'done') onDismiss();
        },
      },
      R.createElement(RN.Text, null, 'size'),
    );
  },
}));

type MockAction = { label: string; onPress: () => void };
jest.mock('../ActionButtons', () => ({
  ActionButtons: ({
    primaryAction,
    secondaryAction,
  }: {
    primaryAction?: MockAction;
    secondaryAction: MockAction;
  }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      null,
      primaryAction
        ? R.createElement(
            RN.Pressable,
            { onPress: primaryAction.onPress, testID: 'primary-btn' },
            R.createElement(RN.Text, null, primaryAction.label),
          )
        : null,
      R.createElement(
        RN.Pressable,
        { onPress: secondaryAction.onPress, testID: 'secondary-btn' },
        R.createElement(RN.Text, null, secondaryAction.label),
      ),
    );
  },
}));

describe('SearchResults', () => {
  const mockItem = {
    id: 'item-1',
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
    mockPackSizeOutcomes.length = 0;
  });

  it('renders item name', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  it('renders Add to Pantry button for pantry source', () => {
    renderWithApollo(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });

  it('renders Add to Shopping List button for shopping list source', () => {
    renderWithApollo(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        shoppingListId="list-1"
      />,
    );
    expect(screen.getByText('Add to Shopping List')).toBeTruthy();
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

  // A 1.89 L carton is ONE container. Its size belongs to the barcode's record,
  // which the add names: a netWeight sent beside it would be stored as the
  // user's own edit.
  it('adds one container naming the scanned record, and no size of its own', async () => {
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
    expect(firedInput.quantity).toBe(1);
    expect(firedInput.item).toEqual({ variation: 'esm-1' });
    expect(firedInput).not.toHaveProperty('netWeight');
    expect(firedInput).not.toHaveProperty('unit');
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

    it('asks for the pack size it lacks, then stores the one entered', async () => {
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

      fireEvent.press(screen.getByTestId('primary-btn'));
      // Nothing is added until the size is given.
      expect(rec.fired).toHaveLength(0);

      fireEvent.press(screen.getByTestId('pack-size-stub'));

      await waitFor(() => expect(rec.fired.length).toBeGreaterThan(0));
      const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
        .input;
      expect(firedInput.netWeight).toEqual({
        netWeight: 32,
        netWeightUnitId: 'unit-oz',
      });
      expect(firedInput.item).toEqual({ variation: 'off-1' });
      // The prompt closes only once the add has landed.
      await waitFor(() =>
        expect(mockPackSizeOutcomes).toEqual([{ status: 'done' }]),
      );
      expect(screen.queryByTestId('pack-size-stub')).toBeNull();
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

      it('keeps the prompt open with the reason on the size, and no alert', async () => {
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
        fireEvent.press(screen.getByTestId('pack-size-stub'));

        await waitFor(() =>
          expect(mockPackSizeOutcomes).toEqual([
            { status: 'refused', sizeError: t('errors.field.netWeight') },
          ]),
        );
        expect(screen.getByTestId('pack-size-stub')).toBeTruthy();
        const { alertService } = jest.requireMock('#/services/alertService');
        expect(alertService.alert).not.toHaveBeenCalled();
        expect(onScanAnother).not.toHaveBeenCalled();
      });

      it('alerts any other refusal, with the prompt still open', async () => {
        const rec = refusedOn('quantity');
        renderWithApollo(<SearchResults {...defaultProps} item={offItem} />, {
          operationMocks: [rec.mock],
        });

        fireEvent.press(screen.getByTestId('primary-btn'));
        fireEvent.press(screen.getByTestId('pack-size-stub'));

        await waitFor(() =>
          expect(mockPackSizeOutcomes).toEqual([{ status: 'refused' }]),
        );
        expect(screen.getByTestId('pack-size-stub')).toBeTruthy();
        const { alertService } = jest.requireMock('#/services/alertService');
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
      expect(screen.queryByTestId('pack-size-stub')).toBeNull();
      const firedInput = (rec.fired[0] as { input: Record<string, unknown> })
        .input;
      expect(firedInput).not.toHaveProperty('netWeight');
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
