'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler, TextInput } from 'react-native';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { ShoppingListDetailsStep } from '../ShoppingListDetailsStep';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { drainTimers } from '#/test-utils/drainTimers';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));

const mockAddItem = jest.fn();
jest.mock('#features/shoppingList/hooks/mutations/useAddShoppingItem', () => ({
  useAddShoppingItem: () => ({ addItem: mockAddItem }),
}));

// The keyboard-aware sheet scroll view builds on gorhom internals the global
// mock does not export; the form's inputs are what matter here.
jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: { children?: React.ReactNode }) =>
    children,
}));

// The remaining pickers each own an Apollo lazy query and are not what this
// step's tests exercise.
jest.mock('#features/catalog/ui/autocomplete/BrandAutocompleteField', () => ({
  BrandAutocompleteField: () => null,
}));
jest.mock(
  '#features/catalog/ui/autocomplete/CategoryAutocompleteField',
  () => ({ CategoryAutocompleteField: () => null }),
);
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));
jest.mock('#features/catalog/ui/autocomplete/StoreAutocompleteField', () => ({
  StoreAutocompleteField: () => null,
}));
jest.mock('#components/molecules/SegmentedControl', () => ({
  SegmentedControl: () => null,
}));
jest.mock('#components/atoms/Icon', () => ({ Icon: () => null }));

const renderStep = (
  overrides: Partial<React.ComponentProps<typeof ShoppingListDetailsStep>> = {},
) =>
  render(
    <ShoppingListDetailsStep
      shoppingListId="list-1"
      onClose={jest.fn()}
      onSuccess={jest.fn()}
      {...overrides}
    />,
  );

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ShoppingListDetailsStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem.mockResolvedValue(true);
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  });

  it('asks for an estimated price only with prices turned on', () => {
    renderStep();
    expect(screen.getByText('Estimated Price')).toBeTruthy();
  });

  it('adds the line with no price, and asks for none, with prices turned off', async () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    const onSuccess = jest.fn();
    renderStep({ onSuccess });

    expect(screen.queryByText('Estimated Price')).toBeNull();
    fireEvent.changeText(
      screen.getByTestId('add-shopping-item-name-input'),
      'Bananas',
    );
    fireEvent.press(screen.getByTestId('add-shopping-item-submit-button'));

    await drainTimers();
    expect(onSuccess).toHaveBeenCalled();
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedPrice: undefined }),
    );
  });

  it('pre-fills the item name from the search term', () => {
    renderStep({ prefilledItemName: 'Vanilla ice cream' });
    expect(screen.getByTestId('add-shopping-item-name-input').props.value).toBe(
      'Vanilla ice cream',
    );
  });

  it('treats the item name as a plain field — typing opens no picker', () => {
    renderStep({ prefilledItemName: 'Vanilla ice cream' });
    const name = screen.getByTestId('add-shopping-item-name-input');

    fireEvent.changeText(name, 'Vanilla ice cream bar');

    // A `variant="modal"` autocomplete would mount its own search field under
    // `${testID}-search`; the user chose "Add manually" to get away from that.
    expect(
      screen.queryByTestId('add-shopping-item-name-input-search'),
    ).toBeNull();
    expect(screen.getByTestId('add-shopping-item-name-input').props.value).toBe(
      'Vanilla ice cream bar',
    );
  });

  it('submits the typed name and quantity', async () => {
    const onSuccess = jest.fn();
    renderStep({ onSuccess });

    fireEvent.changeText(
      screen.getByTestId('add-shopping-item-name-input'),
      'Bananas',
    );
    fireEvent.changeText(
      screen.getByTestId('add-shopping-item-quantity-input'),
      '2',
    );
    fireEvent.press(screen.getByTestId('add-shopping-item-submit-button'));

    await drainTimers();
    expect(onSuccess).toHaveBeenCalled();
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemName: 'Bananas', quantityInput: '2' }),
    );
  });

  it('stays open with the typed input when the add is refused', async () => {
    // The hook has already alerted the refusal; closing would drop the input.
    mockAddItem.mockResolvedValue(false);
    const onSuccess = jest.fn();
    renderStep({ onSuccess, prefilledItemName: 'Bananas' });

    fireEvent.press(screen.getByTestId('add-shopping-item-submit-button'));

    await drainTimers();
    expect(mockAddItem).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-shopping-item-name-input').props.value).toBe(
      'Bananas',
    );
  });

  // The mock's one `focus` is shared by every input; its `this` says which.
  const input = (props: Record<string, string>) =>
    expect.objectContaining({ props: expect.objectContaining(props) });

  // react-hook-form's `setFocus` focuses on the next tick.
  const pressReturn = async (field: ReturnType<typeof screen.getByTestId>) => {
    fireEvent(field, 'submitEditing');
    await drainTimers();
  };

  it('moves the return key through the typed fields in order', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    renderStep();

    await pressReturn(screen.getByTestId('add-shopping-item-name-input'));
    expect(focus.mock.contexts.at(-1)).toEqual(
      input({ testID: 'add-shopping-item-quantity-input' }),
    );

    await pressReturn(screen.getByTestId('add-shopping-item-quantity-input'));
    expect(focus.mock.contexts.at(-1)).toEqual(
      input({ placeholder: 'e.g., 500' }),
    );

    await pressReturn(screen.getByPlaceholderText('e.g., 500'));
    expect(focus.mock.contexts.at(-1)).toEqual(
      input({ placeholder: 'e.g., 4.99' }),
    );

    await pressReturn(screen.getByPlaceholderText('e.g., 4.99'));
    expect(focus.mock.contexts.at(-1)).toEqual(
      input({ placeholder: 'Any special notes...' }),
    );
    focus.mockRestore();
  });

  it('skips the price on the way to Notes with prices turned off', async () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    renderStep();

    await pressReturn(screen.getByPlaceholderText('e.g., 500'));

    expect(focus.mock.contexts.at(-1)).toEqual(
      input({ placeholder: 'Any special notes...' }),
    );
    focus.mockRestore();
  });

  it('focuses Item Name when a submit fails on it', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus');
    renderStep();

    fireEvent.press(screen.getByTestId('add-shopping-item-submit-button'));
    await drainTimers();

    expect(mockAddItem).not.toHaveBeenCalled();
    expect(focus.mock.contexts).toContainEqual(
      input({ testID: 'add-shopping-item-name-input' }),
    );
    focus.mockRestore();
  });

  describe('Cancel', () => {
    it('closes an untouched form at once', () => {
      const alert = jest.spyOn(alertService, 'alert');
      const onClose = jest.fn();
      renderStep({ onClose, prefilledItemName: 'Bananas' });

      fireEvent.press(screen.getByTestId('add-shopping-item-cancel-button'));

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(alert).not.toHaveBeenCalled();
      alert.mockRestore();
    });

    it('asks before dropping what was typed, and holds the sheet open', async () => {
      const alert = jest.spyOn(alertService, 'alert');
      const onClose = jest.fn();
      const onHoldOpen = jest.fn();
      renderStep({ onClose, onHoldOpen });

      fireEvent.changeText(
        screen.getByTestId('add-shopping-item-name-input'),
        'Bananas',
      );
      await drainTimers();
      fireEvent.press(screen.getByTestId('add-shopping-item-cancel-button'));

      expect(onHoldOpen).toHaveBeenLastCalledWith(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith(
        t('confirmations.discardChangesTitle'),
        t('confirmations.discardChanges'),
        expect.any(Array),
      );
      alert.mockRestore();
    });

    it("asks on Android's Back too while input would be lost", async () => {
      const alert = jest.spyOn(alertService, 'alert');
      const added = jest.spyOn(BackHandler, 'addEventListener');
      renderStep();

      fireEvent.changeText(
        screen.getByTestId('add-shopping-item-name-input'),
        'Bananas',
      );
      await drainTimers();
      const [, onBack] = added.mock.calls.at(-1) ?? [];
      expect(onBack?.({ type: 'hardwareBackPress', timeStamp: 0 })).toBe(true);

      expect(alert).toHaveBeenCalledWith(
        t('confirmations.discardChangesTitle'),
        t('confirmations.discardChanges'),
        expect.any(Array),
      );
      alert.mockRestore();
      added.mockRestore();
    });
  });
});
