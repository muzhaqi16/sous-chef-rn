import React, { type ComponentProps } from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { formatCurrency } from '#/utils/formatters/number';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { ListPriceSettings } from '../ListPriceSettings';

jest.mock('#/services/errorService');

type Props = ComponentProps<typeof ListPriceSettings>;

const STORE = { id: 'store-1', name: 'Giant Eagle' };

const renderSettings = (overrides: Partial<Props> = {}) => {
  const props: Props = {
    currency: 'USD',
    budgetAmount: null,
    store: STORE,
    priceTracking: true,
    canEdit: true,
    onBudgetDone: jest.fn(() => true),
    onPickStore: jest.fn(),
    onPriceTrackingChange: jest.fn(),
    ...overrides,
  };
  renderWithApollo(<ListPriceSettings {...props} />, { operationMocks: [] });
  return props;
};

describe('ListPriceSettings', () => {
  it('says what the per-list switch does', () => {
    renderSettings();

    expect(screen.getByText('Ask for prices on this list')).toBeTruthy();
    expect(
      screen.getByText('Recording a purchase on this list asks what you paid.'),
    ).toBeTruthy();
    expect(screen.queryByText(/Price Tracking/i)).toBeNull();
  });

  it('saves the switch as it is flipped', () => {
    const { onPriceTrackingChange } = renderSettings();

    fireEvent(
      screen.getByTestId(shoppingListTestIDs.priceTrackingSwitch),
      'valueChange',
      false,
    );

    expect(onPriceTrackingChange).toHaveBeenCalledWith(false);
  });

  // Reported on the field, never through an alert.
  it('says on the field when the budget is not a number', () => {
    const onBudgetDone = jest.fn(() => false);
    renderSettings({ onBudgetDone });

    const field = screen.getByTestId(shoppingListTestIDs.budgetInput);
    fireEvent.changeText(field, 'abc');
    fireEvent(field, 'endEditing');

    expect(onBudgetDone).toHaveBeenCalledWith('abc');
    expect(
      screen.getByText('Enter a budget, like 60, or leave it empty.'),
    ).toBeTruthy();
  });

  // The editor reads the limit in the field itself, not twice.
  it('shows an editor the limit once, in its field', () => {
    renderSettings({ budgetAmount: 60 });

    expect(
      screen.getByTestId(shoppingListTestIDs.budgetInput).props.value,
    ).toBe('60');
    expect(screen.queryByText(formatCurrency(60, 'USD'))).toBeNull();
  });

  // Retyping a store sends only its pick, never a clear on the way.
  it('keeps the store while its field is emptied, and clears it once finished', () => {
    const { onPickStore } = renderSettings();
    const field = screen.getByTestId(shoppingListTestIDs.listBudgetStore);

    fireEvent.changeText(field, '');
    expect(onPickStore).not.toHaveBeenCalled();

    fireEvent(field, 'endEditing');
    expect(onPickStore).toHaveBeenCalledWith(null);
  });

  it('keeps the store when a typed name is finished without a pick', () => {
    const { onPickStore } = renderSettings();
    const field = screen.getByTestId(shoppingListTestIDs.listBudgetStore);

    fireEvent.changeText(field, 'K');
    fireEvent(field, 'endEditing');

    expect(onPickStore).not.toHaveBeenCalled();
  });

  it('sends nothing when a field with no store is finished empty', () => {
    const { onPickStore } = renderSettings({ store: null });

    fireEvent(
      screen.getByTestId(shoppingListTestIDs.listBudgetStore),
      'endEditing',
    );

    expect(onPickStore).not.toHaveBeenCalled();
  });

  it('shows someone who cannot edit the list every value, with no control', () => {
    renderSettings({
      canEdit: false,
      budgetAmount: 60,
      store: null,
      priceTracking: false,
    });

    expect(screen.getByText(formatCurrency(60, 'USD'))).toBeTruthy();
    expect(screen.getByText('No store chosen')).toBeTruthy();
    expect(screen.getByText('Ask for prices on this list')).toBeTruthy();
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.queryByTestId(shoppingListTestIDs.budgetInput)).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.listBudgetStore),
    ).toBeNull();
    expect(
      screen.queryByTestId(shoppingListTestIDs.priceTrackingSwitch),
    ).toBeNull();
  });

  it('reads an unset budget as not set', () => {
    renderSettings({ canEdit: false });

    expect(screen.getByText('No budget set')).toBeTruthy();
  });
});
