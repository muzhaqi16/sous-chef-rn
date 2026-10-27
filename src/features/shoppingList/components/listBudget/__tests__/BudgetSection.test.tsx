import React, { type ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UNKNOWN_AMOUNT, formatCurrency } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { BudgetSection } from '../BudgetSection';

type Props = ComponentProps<typeof BudgetSection>;

const renderSection = (overrides: Partial<Props> = {}) =>
  render(
    <BudgetSection
      currency="USD"
      budgetAmount={null}
      estimatedTotal={12.5}
      totalCost={8}
      unpricedItems={0}
      priceTracking={false}
      canEdit
      onBudgetDone={() => true}
      onPriceTrackingChange={jest.fn()}
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

  it("says what's left of the budget once the estimate is spent", () => {
    renderSection({ budgetAmount: 60, totalCost: null, estimatedTotal: 22 });

    expect(
      screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children,
    ).toBe(`${formatCurrency(38, 'USD')} left`);
  });

  it('says how far over the budget the estimate goes', () => {
    renderSection({ budgetAmount: 30, totalCost: null, estimatedTotal: 42.1 });

    expect(
      screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children,
    ).toBe(`${formatCurrency(12.1, 'USD')} over budget`);
  });

  // The estimate covers bought lines too, so a recorded spend replaces it.
  it('measures a completed list by what it cost, never spend plus estimate', () => {
    renderSection({ budgetAmount: 60, totalCost: 70, estimatedTotal: 22 });

    expect(
      screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children,
    ).toBe(`${formatCurrency(10, 'USD')} over budget`);
  });

  it('shows no budget as not set, with nothing left to work out', () => {
    renderSection({ budgetAmount: null, canEdit: false });

    expect(screen.getAllByText('No budget set').length).toBeGreaterThan(0);
    expect(
      screen.queryByTestId(shoppingListTestIDs.budgetRemaining),
    ).toBeNull();
  });

  // Reported on the field, never through an alert.
  it('says on the field when the budget is not a number', () => {
    const onBudgetDone = jest.fn(() => false);
    renderSection({ onBudgetDone });

    const field = screen.getByTestId(shoppingListTestIDs.budgetInput);
    fireEvent.changeText(field, 'abc');
    fireEvent(field, 'endEditing');

    expect(onBudgetDone).toHaveBeenCalledWith('abc');
    expect(
      screen.getByText('Enter a budget, like 60, or leave it empty.'),
    ).toBeTruthy();
  });

  // The owner reads the limit in the field itself, not twice.
  it('shows the owner the limit once, in its field', () => {
    renderSection({ budgetAmount: 60 });

    expect(
      screen.getByTestId(shoppingListTestIDs.budgetInput).props.value,
    ).toBe('60');
    expect(screen.queryByText(formatCurrency(60, 'USD'))).toBeNull();
  });

  it('shows the figures without controls to someone who cannot edit the list', () => {
    renderSection({ canEdit: false, budgetAmount: 60 });

    expect(screen.getByText(formatCurrency(60, 'USD'))).toBeTruthy();
    expect(screen.queryByTestId(shoppingListTestIDs.budgetInput)).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.priceTrackingSwitch),
    ).toBeNull();
  });
});
