'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { CookingPreferencesSheet } from '../CookingPreferencesSheet';

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
    return R.createElement(RN.View, null,
      R.createElement(RN.Text, null, label),
      R.createElement(RN.TextInput, { value, onChangeText, placeholder, testID: `input-${label}` }),
    );
  },
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(RN.View, { testID: 'header' },
      R.createElement(RN.Text, null, title),
      R.createElement(RN.Pressable, { onPress: onCancel, testID: 'cancel-btn' }, R.createElement(RN.Text, null, 'Cancel')),
      R.createElement(RN.Pressable, { onPress: onConfirm, testID: 'save-btn' }, R.createElement(RN.Text, null, confirmLabel)),
    );
  },
}));

jest.mock('@react-native-picker/picker', () => {
  const RN = require('react-native');
  const R = require('react');
  const Picker = ({ children }: any) =>
    R.createElement(RN.View, { testID: 'picker' }, children);
  Picker.Item = ({ label, value }: any) =>
    R.createElement(RN.Text, { key: value }, label);
  return { Picker };
});

jest.mock('#/constants/dietary', () => ({
  SKILL_LEVELS: ['Beginner', 'Intermediate', 'Advanced'],
  DIETARY_LIMITS: {
    prepTime: { min: 0, max: 480 },
    cookTime: { min: 0, max: 480 },
    budget: { min: 0, max: 1000 },
  },
}));

describe('CookingPreferencesSheet', () => {
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
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
  });

  it('renders skill level picker section', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Cooking Skill Level')).toBeTruthy();
  });

  it('renders all form inputs', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Max Prep Time (minutes)')).toBeTruthy();
    expect(screen.getByText('Max Cook Time (minutes)')).toBeTruthy();
    expect(screen.getByText('Budget per Meal ($)')).toBeTruthy();
  });

  it('renders save button', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders skill level options', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
  });

  it('renders without initial values', () => {
    render(<CookingPreferencesSheet {...defaultProps} initialValues={undefined} />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
  });
});
