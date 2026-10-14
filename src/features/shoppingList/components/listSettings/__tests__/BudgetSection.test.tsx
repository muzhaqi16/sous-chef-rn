import React, { type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react-native';
import { UNKNOWN_AMOUNT, formatCurrency } from '#/utils/formatters/number';
import { BudgetSection } from '../BudgetSection';

type Props = ComponentProps<typeof BudgetSection>;

const renderSection = (overrides: Partial<Props> = {}) =>
  render(
    <BudgetSection
      budgetInput=""
      currency="USD"
      estimatedTotal={12.5}
      handleTogglePriceTracking={jest.fn()}
      isOwner
      listId="list-1"
      priceTracking={false}
      setBudgetInput={jest.fn()}
      totalCost={8}
      unpricedItems={0}
      {...overrides}
    />,
  );

describe('BudgetSection', () => {
  it('shows a total nobody recorded as unknown, never as zero', () => {
    renderSection({ estimatedTotal: null, totalCost: null });

    expect(screen.getAllByText(UNKNOWN_AMOUNT)).toHaveLength(2);
    expect(screen.queryByText(formatCurrency(0, 'USD'))).toBeNull();
  });

  it('shows a recorded zero as zero', () => {
    renderSection({ estimatedTotal: 0, totalCost: null });

    expect(screen.getByText(formatCurrency(0, 'USD'))).toBeTruthy();
    expect(screen.getAllByText(UNKNOWN_AMOUNT)).toHaveLength(1);
  });

  it('says nothing about unpriced lines when every line is priced', () => {
    renderSection({ unpricedItems: 0 });

    expect(screen.getByText(formatCurrency(12.5, 'USD'))).toBeTruthy();
    expect(screen.queryByText(/without a price/)).toBeNull();
  });

  it('states how many lines the estimate leaves out', () => {
    renderSection({ unpricedItems: 3 });

    expect(screen.getByText(formatCurrency(12.5, 'USD'))).toBeTruthy();
    expect(screen.getByText('3 items without a price')).toBeTruthy();
  });

  it('counts a single unpriced line in the singular', () => {
    renderSection({ unpricedItems: 1 });

    expect(screen.getByText('1 item without a price')).toBeTruthy();
  });

  it('keeps the unpriced note beside an unknown estimate', () => {
    renderSection({ estimatedTotal: null, unpricedItems: 3 });

    expect(screen.getByText(UNKNOWN_AMOUNT)).toBeTruthy();
    expect(screen.getByText('3 items without a price')).toBeTruthy();
  });
});
