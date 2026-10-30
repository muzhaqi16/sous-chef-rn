import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReceiptLineSheet } from '../ReceiptLineSheet';
import { receiptsTestIDs } from '../../testIDs';
import { lineChoice } from '../../__tests__/helpers/receiptFixtures';
import { drainTimers } from '#/test-utils/drainTimers';

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

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => {
  const { Text, TextInput, View } = require('react-native');
  return {
    UnitAutocompleteField: ({
      value,
      onChangeText,
      error,
    }: {
      value?: string;
      onChangeText?: (text: string) => void;
      error?: string;
    }) => (
      <View>
        <TextInput
          testID="field-unit"
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID="field-unit-error">{error}</Text> : null}
      </View>
    ),
  };
});

// The units the device holds: "lb" resolves, anything else does not.
jest.mock('#features/catalog/hooks/useResolveUnit', () => ({
  useResolveUnit: () => ({
    resolveUnitId: async (current: string | null, text: string) =>
      current ?? (text === 'lb' ? 'unit-lb' : null),
  }),
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

const TOTAL_NEEDED = 'Enter what you paid for this line.';

const MILK = { index: 0, printed: 'MILK 2%', price: 2.5 };

const renderSheet = (line: typeof MILK & { discount?: number } = MILK) => {
  const onSave = jest.fn();
  const onClose = jest.fn();
  render(
    <ReceiptLineSheet
      visible
      line={line}
      choice={lineChoice({ price: line.price })}
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the total paid on a receipt line', () => {
  it.each(['-3', '4,99x'])(
    'refuses %p on the field and does not save',
    async typed => {
      const { onSave } = renderSheet();

      typeTotal(typed);
      fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

      await drainTimers();
      expect(screen.getByTestId('field-Total paid-error')).toHaveTextContent(
        TOTAL_NEEDED,
      );
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('saves a usable total as the line price', async () => {
    const { onSave, onClose } = renderSheet();

    typeTotal('3.49');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ price: 3.49 }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it.each(['', '0'])(
    'asks for what was paid when the total is %p',
    async typed => {
      const { onSave } = renderSheet();

      typeTotal(typed);
      fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

      await drainTimers();
      expect(screen.getByTestId('field-Total paid-error')).toHaveTextContent(
        TOTAL_NEEDED,
      );
      expect(onSave).not.toHaveBeenCalled();
    },
  );

  it('saves a line its discount made free at nothing paid', async () => {
    const { onSave } = renderSheet({ ...MILK, price: 0, discount: 2.5 });

    typeTotal('0');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ price: 0 }));
  });
});

describe('the unit of a receipt line', () => {
  it('saves a typed unit as the unit it resolves to', async () => {
    const { onSave } = renderSheet();

    fireEvent.changeText(screen.getByTestId('field-unit'), 'lb');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ unitId: 'unit-lb', unitText: 'lb' }),
    );
  });

  it('refuses a unit it cannot resolve on the field, and does not save', async () => {
    const { onSave } = renderSheet();

    fireEvent.changeText(screen.getByTestId('field-unit'), 'tin');
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(screen.getByTestId('field-unit-error')).toHaveTextContent(
      '"tin" isn\'t a unit we recognise. Pick one from the list.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('a receipt line not for the pantry', () => {
  it('saves the switch onto the line', async () => {
    const { onSave } = renderSheet();

    fireEvent(
      screen.getByTestId(receiptsTestIDs.lineNotStocked),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByTestId(receiptsTestIDs.lineSave));

    await drainTimers();
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ notStocked: true }),
    );
  });
});
