import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MarkCookedModal } from '../MarkCookedModal';

jest.mock('#components/templates/Sheet', () => {
  const { View } = require('react-native');
  return {
    Sheet: ({ children }: { children?: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('#components/molecules/BottomSheetHeader', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BottomSheetHeader: ({
      onConfirm,
      confirmDisabled,
    }: {
      onConfirm?: () => void;
      confirmDisabled?: boolean;
    }) => (
      <Pressable
        testID="confirm"
        disabled={confirmDisabled}
        accessibilityState={{ disabled: !!confirmDisabled }}
        onPress={confirmDisabled ? undefined : onConfirm}
      >
        <Text>confirm</Text>
      </Pressable>
    ),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const { TextInput, Text, View } = require('react-native');
  return {
    FractionInput: ({
      value,
      onChangeText,
      error,
    }: {
      value?: string;
      onChangeText?: (next: string) => void;
      error?: string;
    }) => (
      <View>
        <TextInput
          testID="servings"
          value={value}
          onChangeText={onChangeText}
        />
        {error ? <Text testID="servings-error">{error}</Text> : null}
      </View>
    ),
  };
});

const renderModal = (onConfirm = jest.fn()) => {
  render(
    <MarkCookedModal
      visible
      recipeName="Soup"
      defaultServings={4}
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />,
  );
  return onConfirm;
};

describe('MarkCookedModal servings', () => {
  // The parser reports a value it cannot read with the same `null` the empty
  // field uses, so the guard against it has to separate the two — otherwise
  // the pantry is deducted for a serving count nobody entered.
  it.each(['1 1/', '1/2/3', 'a pinch', '3/0'])(
    'reports %s on the field instead of cooking the default',
    unreadable => {
      const onConfirm = renderModal();

      fireEvent.changeText(screen.getByTestId('servings'), unreadable);

      expect(screen.getByTestId('servings-error')).toBeTruthy();
      fireEvent.press(screen.getByTestId('confirm'));
      expect(onConfirm).not.toHaveBeenCalled();
    },
  );

  it('cooks the recipe default when the field is left empty', () => {
    const onConfirm = renderModal();

    fireEvent.changeText(screen.getByTestId('servings'), '');
    fireEvent.press(screen.getByTestId('confirm'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ servings: 4 }),
    );
  });

  // A sloppy separator run is READ, not refused: the locale-aware normalizer
  // settles it, so this is not the unreadable case.
  it('reads a doubled decimal separator rather than refusing it', () => {
    const onConfirm = renderModal();

    fireEvent.changeText(screen.getByTestId('servings'), '2..0');
    fireEvent.press(screen.getByTestId('confirm'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ servings: 2 }),
    );
  });

  it('cooks the entered amount when it can be read', () => {
    const onConfirm = renderModal();

    fireEvent.changeText(screen.getByTestId('servings'), '3');
    fireEvent.press(screen.getByTestId('confirm'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ servings: 3 }),
    );
  });

  // `servingsMade` is an Int: a fraction refuses the whole request.
  it.each(['1.5', '1 1/2'])(
    'refuses %s servings on the field and disables confirm',
    fractional => {
      const onConfirm = renderModal();

      fireEvent.changeText(screen.getByTestId('servings'), fractional);

      expect(screen.getByTestId('servings-error')).toBeTruthy();
      expect(screen.getByTestId('confirm').props.accessibilityState).toEqual({
        disabled: true,
      });
      fireEvent.press(screen.getByTestId('confirm'));
      expect(onConfirm).not.toHaveBeenCalled();
    },
  );
});
