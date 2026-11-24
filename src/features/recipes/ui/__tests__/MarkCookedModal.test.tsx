import React from 'react';
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { MarkCookedModal } from '../MarkCookedModal';

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

const renderModal = (
  onConfirm = jest.fn(),
  { wholeServings = false }: { wholeServings?: boolean } = {},
) => {
  render(
    <MarkCookedModal
      visible
      recipeName="Soup"
      defaultServings={4}
      wholeServings={wholeServings}
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

  // A recipe cook's servings are a Float: half a batch scales the deduction.
  it.each([
    ['1.5', 1.5],
    ['1 1/2', 1.5],
  ])('cooks %s servings of a recipe', (fractional, servings) => {
    const onConfirm = renderModal();

    fireEvent.changeText(screen.getByTestId('servings'), fractional);
    fireEvent.press(screen.getByTestId('confirm'));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ servings }),
    );
  });

  it('refuses zero servings on the field', () => {
    const onConfirm = renderModal();

    fireEvent.changeText(screen.getByTestId('servings'), '0');

    expect(screen.getByTestId('servings-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // A planned meal's servings are an Int: a fraction refuses the whole request.
  it.each(['1.5', '1 1/2'])(
    'refuses %s servings of a planned meal on the field and disables confirm',
    fractional => {
      const onConfirm = renderModal(jest.fn(), { wholeServings: true });

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

// The sheet holds what was entered until the cook is taken.
describe('MarkCookedModal while the cook settles', () => {
  const renderWith = (
    onConfirm: jest.Mock,
    { hasPantry = true }: { hasPantry?: boolean } = {},
  ) => {
    const onClose = jest.fn();
    render(
      <MarkCookedModal
        visible
        recipeName="Soup"
        defaultServings={4}
        hasPantry={hasPantry}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    return onClose;
  };
  // The confirm awaits the cook's answer, which the press lets settle.
  const confirm = () => userEvent.setup().press(screen.getByTestId('confirm'));

  it('closes once the cook is taken', async () => {
    const onClose = renderWith(jest.fn().mockResolvedValue('done'));

    await confirm();

    expect(onClose).toHaveBeenCalled();
  });

  it('stays open with what was entered when the cook is refused', async () => {
    const onConfirm = jest.fn().mockResolvedValue('retry');
    const onClose = renderWith(onConfirm);

    fireEvent.changeText(screen.getByTestId('servings'), '3');
    await confirm();

    expect(onConfirm).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('servings').props.value).toBe('3');
  });

  // Confirmed again, the cook deducts unreviewed, as the sheet then says.
  it('turns the review off and says why when it could not load', async () => {
    const onConfirm = jest.fn().mockResolvedValue('reviewUnavailable');
    const onClose = renderWith(onConfirm);

    await confirm();

    expect(
      screen.getByTestId(recipesTestIDs.cookReviewUnavailable),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByLabelText(t('markCookedModal.smartDeduction')),
    ).toHaveProp('value', false);
    onConfirm.mockResolvedValue('done');
    await confirm();
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenLastCalledWith(
      expect.objectContaining({ useGranularDeduction: false }),
    );
  });
});
