import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { PackSizeSheet, type PackSizeOutcome } from '../PackSizeSheet';

jest.mock('#components/atoms/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({
      value,
      onChangeText,
      error,
      testID,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      error?: string;
      testID?: string;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.TextInput, { testID, value, onChangeText }),
        error
          ? R.createElement(RN.Text, { testID: `${testID}-error` }, error)
          : null,
      ),
  };
});

// The unit list loads over the network; a pick is all the sheet reads of it.
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    UnitAutocompleteField: ({
      onChangeText,
      onUnitSelected,
    }: {
      onChangeText: (text: string) => void;
      onUnitSelected: (unitId: string | null, unitName?: string) => void;
    }) =>
      R.createElement(
        RN.Pressable,
        {
          testID: 'pick-unit',
          onPress: () => {
            onChangeText('mL');
            onUnitSelected('unit-ml', 'mL');
          },
        },
        R.createElement(RN.Text, null, 'Pick mL'),
      ),
  };
});

/** Enters 500 mL and confirms, the add settling as `outcome`. */
const confirmSize = (outcome: PackSizeOutcome) => {
  const onConfirm = jest.fn(async () => outcome);
  const onDismiss = jest.fn();
  renderWithApollo(
    <PackSizeSheet
      visible
      itemName="Oat Milk"
      onDismiss={onDismiss}
      onConfirm={onConfirm}
    />,
  );
  fireEvent.changeText(screen.getByTestId(barcodeTestIDs.packSizeInput), '500');
  fireEvent.press(screen.getByTestId('pick-unit'));
  fireEvent.press(screen.getByTestId(barcodeTestIDs.packSizeConfirm));
  return { onConfirm, onDismiss };
};

const sizeInput = () => screen.getByTestId(barcodeTestIDs.packSizeInput);
const sizeError = () =>
  screen.queryByTestId(`${barcodeTestIDs.packSizeInput}-error`);

describe('PackSizeSheet', () => {
  it('sends the size entered, in the unit picked', async () => {
    const { onConfirm } = confirmSize({ status: 'done' });

    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        netWeight: 500,
        netWeightUnitId: 'unit-ml',
      }),
    );
  });

  it('closes, emptied, once the add has landed', async () => {
    const { onDismiss } = confirmSize({ status: 'done' });

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(sizeInput().props.value).toBe('');
  });

  it('stays open on a refused size, with the reason on the field and the entry kept', async () => {
    const { onDismiss } = confirmSize({
      status: 'refused',
      sizeError: 'That size cannot be stored.',
    });

    await waitFor(() =>
      expect(sizeError()).toHaveTextContent('That size cannot be stored.'),
    );
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sizeInput().props.value).toBe('500');
  });

  it('stays open on any other refusal, which was told elsewhere', async () => {
    const { onConfirm, onDismiss } = confirmSize({ status: 'refused' });

    await waitFor(() => expect(onConfirm).toHaveBeenCalled());
    await waitFor(() => expect(sizeInput().props.value).toBe('500'));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(sizeError()).toBeNull();
  });
});
