'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CookingPreferencesSheet } from '../CookingPreferencesSheet';

jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: jest.fn(() => ({})),
}));

jest.mock('#components/molecules/FormInput', () => ({
  FormInput: ({
    label,
    value,
    onChangeText,
    placeholder,
  }: {
    label: string;
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

jest.mock('#components/atoms/BottomSheetHeader', () => ({
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

// Stands in for the tray so the OPTIONS are reachable without driving gorhom's
// present/animate cycle. `stackBehavior` is captured because passing 'push' is
// what keeps this picker from minimizing the sheet it opens from.
const modalPickerProps: { stackBehavior?: string }[] = [];
jest.mock('#components/molecules/ModalPicker', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    ModalPicker: (props: {
      visible: boolean;
      options: { label: string; value: string }[];
      onSelect: (value: string) => void;
      stackBehavior?: string;
    }) => {
      modalPickerProps.push({ stackBehavior: props.stackBehavior });
      if (!props.visible) return null;
      return R.createElement(
        RN.View,
        { testID: 'modal-picker' },
        props.options.map(opt =>
          R.createElement(
            RN.Pressable,
            {
              key: opt.value,
              testID: `modal-picker-option-${opt.value}`,
              onPress: () => props.onSelect(opt.value),
            },
            R.createElement(RN.Text, null, opt.label),
          ),
        ),
      );
    },
  };
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

  it('opens the skill level tray on press and lists every level', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.queryByTestId('modal-picker')).toBeNull();

    fireEvent.press(
      screen.getByTestId('cooking-preferences-skill-level-picker'),
    );

    expect(screen.getByText('Beginner')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
  });

  it('opens the skill tray with stackBehavior="push"', () => {
    // gorhom's default 'switch' minimizes the HOST sheet, which reads as a
    // crash — this picker always opens from inside one.
    modalPickerProps.length = 0;
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(modalPickerProps.length).toBeGreaterThan(0);
    expect(modalPickerProps.every(p => p.stackBehavior === 'push')).toBe(true);
  });

  it('shows the chosen skill level on the trigger and saves it', async () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    fireEvent.press(
      screen.getByTestId('cooking-preferences-skill-level-picker'),
    );
    fireEvent.press(screen.getByTestId('modal-picker-option-Intermediate'));

    // Tray closed, trigger now reads the selection rather than the placeholder.
    expect(screen.queryByTestId('modal-picker')).toBeNull();
    expect(screen.getByText('Intermediate')).toBeTruthy();

    fireEvent.press(screen.getByTestId('save-btn'));
    await screen.findByText('Cooking Preferences');
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ cookingSkillLevel: 'Intermediate' }),
    );
  });

  it('renders without initial values', () => {
    render(
      <CookingPreferencesSheet {...defaultProps} initialValues={undefined} />,
    );
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
  });
});
