'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { MacroTargetsSheet } from '../MacroTargetsSheet';

jest.mock('#components/atoms/GlobalBottomSheetBackdrop', () => ({
  GlobalBottomSheetBackdrop: () => null,
}));

jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: jest.fn(() => ({})),
}));

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({ label, value, onChangeText, placeholder }: any) => {
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

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) => {
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

jest.mock('#/constants/dietary', () => ({
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
