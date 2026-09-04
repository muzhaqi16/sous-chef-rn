'use no memo';
import React from 'react';
import {
  render,
  screen,
  fireEvent,
  userEvent,
} from '@testing-library/react-native';
import { MacroTargetsSheet } from '#features/profile/components/MacroTargetsSheet/MacroTargetsSheet';

jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: jest.fn(() => ({})),
}));

jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({
    label,
    value,
    onChangeText,
    placeholder,
  }: {
    label?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
  }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      null,
      R.createElement(RN.Text, null, label),
      R.createElement(RN.TextInput, {
        value,
        onChangeText,
        placeholder,
        testID: `input-${label}`,
      }),
    );
  },
}));

jest.mock('#components/molecules/BottomSheetHeader', () => ({
  BottomSheetHeader: ({
    title,
    onCancel,
    onConfirm,
    confirmLabel,
  }: {
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
  }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      { testID: 'header' },
      R.createElement(RN.Text, null, title),
      R.createElement(
        RN.Pressable,
        { onPress: onCancel, testID: 'cancel-btn' },
        R.createElement(RN.Text, null, 'Cancel'),
      ),
      R.createElement(
        RN.Pressable,
        { onPress: onConfirm, testID: 'save-btn' },
        R.createElement(RN.Text, null, confirmLabel),
      ),
    );
  },
}));

jest.mock('#domain/dietary', () => ({
  DIETARY_LIMITS: {
    calories: { min: 500, max: 10000 },
    protein: { min: 0, max: 500 },
    carbs: { min: 0, max: 1000 },
    fat: { min: 0, max: 500 },
  },
}));

describe('MacroTargetsSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(() => Promise.resolve(true)),
    initialValues: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('re-seeding while open', () => {
    // The screen builds `initialValues` as a literal, so every profile refetch
    // hands the sheet a new object describing the same targets.
    it('keeps typed input when the same targets arrive as a new object', () => {
      const { rerender } = render(
        <MacroTargetsSheet
          {...defaultProps}
          initialValues={{ calorieTarget: 2000 }}
        />,
      );

      fireEvent.changeText(
        screen.getByTestId('input-Daily Calories (kcal)'),
        '2500',
      );

      rerender(
        <MacroTargetsSheet
          {...defaultProps}
          initialValues={{ calorieTarget: 2000 }}
        />,
      );

      expect(
        screen.getByTestId('input-Daily Calories (kcal)').props.value,
      ).toBe('2500');
    });

    it('seeds from the targets when it opens', () => {
      const { rerender } = render(
        <MacroTargetsSheet
          {...defaultProps}
          visible={false}
          initialValues={{ calorieTarget: 1800 }}
        />,
      );

      rerender(
        <MacroTargetsSheet
          {...defaultProps}
          visible={true}
          initialValues={{ calorieTarget: 1800 }}
        />,
      );

      expect(
        screen.getByTestId('input-Daily Calories (kcal)').props.value,
      ).toBe('1800');
    });
  });

  it('renders the title', () => {
    render(<MacroTargetsSheet {...defaultProps} />);
    expect(screen.getByText('Macro Targets')).toBeTruthy();
  });

  it('renders description text', () => {
    render(<MacroTargetsSheet {...defaultProps} />);
    expect(
      screen.getByText('Set your daily nutrition goals (optional)'),
    ).toBeTruthy();
  });

  it('renders all four macro input fields', () => {
    render(<MacroTargetsSheet {...defaultProps} />);
    expect(screen.getByText('Daily Calories (kcal)')).toBeTruthy();
    expect(screen.getByText('Protein (g)')).toBeTruthy();
    expect(screen.getByText('Carbs (g)')).toBeTruthy();
    expect(screen.getByText('Fat (g)')).toBeTruthy();
  });

  it('renders save button', () => {
    render(<MacroTargetsSheet {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders without initial values', () => {
    render(<MacroTargetsSheet {...defaultProps} initialValues={undefined} />);
    expect(screen.getByText('Macro Targets')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<MacroTargetsSheet {...defaultProps} />);
    const cancelBtn = screen.getByTestId('cancel-btn');
    await user.press(cancelBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
