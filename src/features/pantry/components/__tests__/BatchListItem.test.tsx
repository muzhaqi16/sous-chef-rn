import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import { makeCache } from '#/apollo/cache';
import {
  BatchStatus,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { BatchListItem } from '../BatchListItem';
import { BatchListItem_PantryItemFragmentDoc } from '../BatchListItem.generated';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));

const batch = (quantity: number): PantryItemBatchFragment => ({
  __typename: 'PantryItemBatch',
  id: 'b1',
  batchNumber: 1,
  quantity,
  status: BatchStatus.Active,
  expiresOn: null,
  expiresAtIsManual: false,
  costPerUnit: null,
  totalCost: null,
  notes: null,
  isOpened: false,
  openedAt: null,
  depletedAt: null,
  netWeight: null,
  remainingNetWeight: null,
  packageSize: null,
  remaining: null,
  portionsPerTrackingUnit: null,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
  wasteReason: null,
  pantryItemId: 'pi1',
  currency: null,
  store: null,
  purchase: null,
});

describe('BatchListItem', () => {
  it('renders a fractional batch quantity as a cooking fraction', () => {
    renderWithApollo(<BatchListItem batch={batch(1.25)} unitSymbol="cup" />);
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
  });

  describe('what a batch cost', () => {
    afterEach(() => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
    });

    const priced = { ...batch(2), costPerUnit: 1.25, totalCost: 2.5 };

    it('shows the cost per unit with budget & prices on', () => {
      renderWithApollo(<BatchListItem batch={priced} unitSymbol="pc" />);
      expect(screen.getByText('$1.25/unit')).toBeTruthy();
    });

    it('shows no cost with budget & prices off, and still the batch', () => {
      jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
      renderWithApollo(<BatchListItem batch={priced} unitSymbol="pc" />);

      expect(screen.queryByText(/1\.25/)).toBeNull();
      expect(screen.getByText('2 pc')).toBeTruthy();
    });
  });

  it("shows the batch's own package size", () => {
    renderWithApollo(
      <BatchListItem
        batch={{ ...batch(1), netWeight: 22 }}
        netWeightUnitSymbol="oz"
      />,
    );
    expect(screen.getByText('Package: 22 oz')).toBeTruthy();
  });

  it('offers a size correction on a weighed batch only', () => {
    const onCorrectSize = jest.fn();
    const { rerender } = renderWithApollo(
      <BatchListItem batch={batch(1)} onCorrectSize={onCorrectSize} />,
    );
    expect(screen.queryByLabelText('Correct package size')).toBeNull();

    rerender(
      <BatchListItem
        batch={{ ...batch(1), netWeight: 32 }}
        onCorrectSize={onCorrectSize}
      />,
    );
    fireEvent.press(screen.getByLabelText('Correct package size'));
    expect(onCorrectSize).toHaveBeenCalledWith('b1');
  });

  it('rounds a batch quantity no fraction fits to three decimals', () => {
    renderWithApollo(<BatchListItem batch={batch(177.4412)} unitSymbol="mL" />);
    expect(screen.getByText('177.441 mL')).toBeTruthy();
  });

  describe('on a stack of pieces shown in dozens', () => {
    const eggsCache = () => {
      const cache = makeCache();
      cache.writeFragment({
        fragment: BatchListItem_PantryItemFragmentDoc,
        fragmentName: 'BatchListItem_pantryItem',
        data: {
          __typename: 'PantryItem',
          id: 'pi1',
          unit: { __typename: 'Unit', id: 'pc', symbol: 'pc' },
          displayUnit: {
            __typename: 'Unit',
            id: 'doz',
            symbol: 'doz',
            type: UnitType.Count,
            hasStandardCountFactor: true,
            baseUnitId: 'pc',
            conversionFactor: 12,
            commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
          },
        },
      });
      return cache;
    };

    it('shows a whole dozen or a common fraction of one in dozens', () => {
      renderWithApollo(<BatchListItem batch={batch(18)} unitSymbol="pc" />, {
        cache: eggsCache(),
      });
      expect(screen.getByText('1 1/2 doz')).toBeTruthy();
    });

    it('shows any other count in pieces, never a decimal of a dozen', () => {
      renderWithApollo(<BatchListItem batch={batch(11)} unitSymbol="pc" />, {
        cache: eggsCache(),
      });
      expect(screen.getByText('11 pc')).toBeTruthy();
    });
  });

  // A can of Unmeat tuna: 180 g as stored; the API reads its label's "6.35 oz".
  it('shows the package size in the user\u2019s unit system', () => {
    type BatchSize = NonNullable<PantryItemBatchFragment['packageSize']>;
    const reading = (
      value: number,
      id: string,
      symbol: string,
    ): BatchSize['metric'] => ({
      __typename: 'MeasureReading',
      value,
      unitId: id,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });
    const packageSize: BatchSize = {
      __typename: 'Measure',
      value: 180,
      unitId: 'unit-g',
      metric: reading(180, 'unit-g', 'g'),
      imperial: reading(6.35, 'unit-oz', 'oz'),
    };
    const cache = makeCache();
    writeUnitSystemSettings(cache, UnitSystem.System, UnitSystem.Imperial);

    renderWithApollo(
      <BatchListItem
        batch={{ ...batch(1), netWeight: 180, packageSize }}
        netWeightUnitSymbol="g"
        netWeightUnitId="unit-g"
      />,
      { cache },
    );
    expect(screen.getByText('Package: 6.35 oz')).toBeTruthy();
  });
});
