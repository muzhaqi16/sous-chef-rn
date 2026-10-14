import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ReceiptLineSheet } from '../ReceiptLineSheet';
import { receiptsTestIDs } from '../../testIDs';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';

jest.mock('#components/templates/Sheet', () => {
  const { View } = require('react-native');
  return {
    Sheet: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('#components/organisms/Header', () => {
  const { Pressable, View } = require('react-native');
  return {
    Header: ({
      rightActions = [],
    }: {
      rightActions?: { onPress: () => void; testID?: string }[];
    }) => (
      <View>
        {rightActions.map(action => (
          <Pressable
            key={action.testID}
            testID={action.testID}
            onPress={action.onPress}
          />
        ))}
      </View>
    ),
  };
});

jest.mock('#features/catalog/ui/autocomplete/ItemAutocompleteField', () => ({
  ItemAutocompleteField: () => null,
}));

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));

jest.mock('#components/molecules/FractionInput', () => ({
  FractionInput: () => null,
}));

jest.mock('#components/atoms/FormInput', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      error,
    }: {
      label: string;
      value?: string;
      onChangeText?: (text: string) => void;
      error?: string;
    }) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          testID={`field-${label}`}
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID={`field-${label}-error`}>{error}</Text> : null}
      </View>
    ),
  };
});

const INVALID_PAID = 'Enter the amount paid, like 3.49, or leave it empty.';

const renderSheet = () => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <ReceiptLineSheet
      visible
      line={{ index: 0, printed: 'MILK 2%', price: 2.5 }}
      choice={lineChoice({ price: 2.5 })}
      candidates={[]}
      listItemNameFor={() => undefined}
      onPickItem={jest.fn()}
      opening={1}
      onClose={onClose}
      onSave={onSave}
      onRemove={jest.fn()}
    />,
  );
  return { onSave, onClose };
};

const typeTotal = (text: string) =>
  fireEvent.changeText(screen.getByTestId('field-Total paid'), text);

describe('the total paid on a receipt line', () => {
  it.each(['-3', '4,99x'])(
    'refuses %p on the field and does not save',
    async typed => {
      const { onSave } = renderSheet();

      typeTotal(typed);
      fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

      expect(
        await screen.findByTestId('field-Total paid-error'),
      ).toHaveTextContent(INVALID_PAID);
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('saves a usable total as the line price', async () => {
    const { onSave, onClose } = renderSheet();

    typeTotal('3.49');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ price: 3.49 }),
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a cleared total as unknown', async () => {
    const { onSave } = renderSheet();

    typeTotal('');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ price: null }),
      ),
    );
  });
});
