'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ShoppingListDetailsStep } from '../ShoppingListDetailsStep';

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
jest.mock('#/utils/iconUtils', () => ({ Icon: () => null }));
jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const renderStep = (
  overrides: Partial<React.ComponentProps<typeof ShoppingListDetailsStep>> = {},
) =>
  render(
    <ShoppingListDetailsStep
      shoppingListId="list-1"
      refetch={jest.fn().mockResolvedValue(undefined)}
      onClose={jest.fn()}
      onSuccess={jest.fn()}
      {...overrides}
    />,
  );

describe('ShoppingListDetailsStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem.mockResolvedValue(undefined);
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

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockAddItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemName: 'Bananas', quantityInput: '2' }),
    );
  });
});
