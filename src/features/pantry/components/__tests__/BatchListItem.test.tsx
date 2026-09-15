import React from 'react';
import { screen } from '@testing-library/react-native';
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
  expiresAt: null,
  expiresAtIsManual: false,
  costPerUnit: null,
  totalCost: null,
  notes: null,
  isOpened: false,
  openedAt: null,
  depletedAt: null,
  remainingNetWeight: null,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
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

  it('rounds a batch quantity no fraction fits to three decimals', () => {
    renderWithApollo(<BatchListItem batch={batch(177.4412)} unitSymbol="mL" />);
    expect(screen.getByText('177.441 mL')).toBeTruthy();
  });
});
