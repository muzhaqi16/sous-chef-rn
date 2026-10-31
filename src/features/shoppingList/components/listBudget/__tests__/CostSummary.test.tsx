import React, { type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react-native';
import { formatCurrency } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import type { ListCostToGo } from '#features/shoppingList/hooks/useListCostToGo';
import { CostSummary } from '../CostSummary';

type Props = ComponentProps<typeof CostSummary>;

const usd = (amount: number) => formatCurrency(amount, 'USD');

/** A cost to go of `amount` over `lines` unbought lines, `priced` of them priced. */
const toGo = (amount: number, priced = 1, lines = 1): ListCostToGo => ({
  amount,
  currency: 'USD',
  pricedLines: priced,
  lines,
});

const renderSummary = (overrides: Partial<Props> = {}) =>
  render(
    <CostSummary
      currency="USD"
      budgetAmount={null}
      totalCost={null}
      costToGo={toGo(42)}
      canEdit
      {...overrides}
    />,
  );

const remaining = () =>
  screen.getByTestId(shoppingListTestIDs.budgetRemaining).props.children;

describe('CostSummary', () => {
  // John's list: only Pineapple priced, a suggested $1.29 × 5.
  it('reads one estimate over the unbought lines, and how many it prices', () => {
    renderSummary({ costToGo: toGo(6.45, 1, 5) });

    expect(
      screen.getByTestId(shoppingListTestIDs.costToGo).props.children,
    ).toBe(`≈ ${usd(6.45)}`);
    expect(screen.getByText('Priced 1 of 5 items')).toBeTruthy();
    expect(screen.queryByText(/without a price|no recorded price/)).toBeNull();
  });

  it('says what is left of the budget after spending and the cost to go', () => {
    renderSummary({ budgetAmount: 125, totalCost: 18, costToGo: toGo(42) });

    expect(remaining()).toBe(`${usd(65)} left of ${usd(125)}`);
  });

  it('says by how much the list is over budget', () => {
    renderSummary({ budgetAmount: 50, totalCost: 18, costToGo: toGo(42) });

    expect(remaining()).toBe(`${usd(10)} over budget`);
  });

  it('shows the cost to go and the spend with no budget, and offers to set one', () => {
    renderSummary({ budgetAmount: null, totalCost: 18 });

    expect(screen.getByTestId(shoppingListTestIDs.costToGo)).toBeTruthy();
    expect(screen.getByText(usd(18))).toBeTruthy();
    expect(screen.getByText('No budget set')).toBeTruthy();
    expect(
      screen.getByText("Set a budget limit below to see what's left of it."),
    ).toBeTruthy();
    expect(
      screen.queryByTestId(shoppingListTestIDs.budgetRemaining),
    ).toBeNull();
  });

  it('offers no budget to set to someone who cannot edit the list', () => {
    renderSummary({ budgetAmount: null, canEdit: false });

    expect(screen.getByText('No budget set')).toBeTruthy();
    expect(screen.queryByText(/Set a budget limit below/)).toBeNull();
  });

  it('says the list has no prices yet, never a cost of zero', () => {
    renderSummary({
      budgetAmount: 60,
      costToGo: { amount: null, currency: 'USD', pricedLines: 0, lines: 5 },
    });

    expect(screen.getByText('No prices yet')).toBeTruthy();
    expect(screen.queryByText(usd(0))).toBeNull();
    expect(screen.queryByText(/≈/)).toBeNull();
    expect(screen.queryByText(/Priced/)).toBeNull();
    expect(remaining()).toBe(`${usd(60)} left of ${usd(60)}`);
  });

  it('says nothing is left to buy once every line is bought', () => {
    renderSummary({
      totalCost: 30,
      costToGo: { amount: null, currency: 'USD', pricedLines: 0, lines: 0 },
    });

    expect(screen.getByText('Nothing left to buy')).toBeTruthy();
  });

  it('shows no cost to go until the list is read', () => {
    renderSummary({ costToGo: null, totalCost: 18 });

    expect(screen.queryByTestId(shoppingListTestIDs.costToGo)).toBeNull();
    expect(screen.getByText(usd(18))).toBeTruthy();
  });
});
