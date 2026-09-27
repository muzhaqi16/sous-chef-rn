import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import type { PantryItemBatchFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { BatchListItem } from '../BatchListItem';

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
  portionsPerTrackingUnit: null,
  createdAt: '2026-08-01',
  updatedAt: '2026-08-01',
  wasteReason: null,
  pantryItemId: 'pi1',
  currency: null,
  store: null,
});

describe('BatchListItem', () => {
  it('renders a fractional batch quantity as a cooking fraction', () => {
    renderWithApollo(<BatchListItem batch={batch(1.25)} unitSymbol="cup" />);
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
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
});
