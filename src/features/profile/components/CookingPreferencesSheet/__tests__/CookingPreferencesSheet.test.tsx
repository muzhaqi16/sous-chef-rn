'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CookingPreferencesSheet } from '#features/profile/components/CookingPreferencesSheet/CookingPreferencesSheet';
import { drainTimers } from '#/test-utils/drainTimers';

jest.mock('#hooks/ui/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: jest.fn(() => ({})),
}));

jest.mock('#components/atoms/FormInput', () => ({
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CookingPreferencesSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSave: jest.fn(() => Promise.resolve(true)),
    initialValues: {},
  };

  /** The sheet as it opens over a stored limit: its field is seeded then. */
  const openWith = (stored: { maxCookTimeMinutes?: number | null }) => {
    const { rerender } = render(
      <CookingPreferencesSheet
        {...defaultProps}
        visible={false}
        initialValues={stored}
      />,
    );
    rerender(
      <CookingPreferencesSheet {...defaultProps} initialValues={stored} />,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks only for the longest cooking time', () => {
    render(<CookingPreferencesSheet {...defaultProps} />);
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
    expect(screen.getAllByTestId(/^input-/)).toHaveLength(1);
  });

  it('saves a cook time typed in', async () => {
    openWith({});
    fireEvent.changeText(screen.getAllByTestId(/^input-/)[0]!, '40');

    fireEvent.press(screen.getByTestId('save-btn'));
    await drainTimers();

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      maxCookTimeMinutes: 40,
    });
  });

  // The API reads null as "clear it", so an emptied limit is removed, not kept.
  it('clears a limit emptied from its stored value', async () => {
    openWith({ maxCookTimeMinutes: 60 });
    fireEvent.changeText(screen.getByDisplayValue('60'), '');

    fireEvent.press(screen.getByTestId('save-btn'));
    await drainTimers();

    expect(defaultProps.onSave).toHaveBeenCalledWith({
      maxCookTimeMinutes: null,
    });
  });

  it('sends nothing for a limit left blank', async () => {
    openWith({});

    fireEvent.press(screen.getByTestId('save-btn'));
    await drainTimers();

    expect(defaultProps.onSave).toHaveBeenCalledWith({});
  });

  it('renders without initial values', () => {
    render(
      <CookingPreferencesSheet {...defaultProps} initialValues={undefined} />,
    );
    expect(screen.getByText('Cooking Preferences')).toBeTruthy();
  });
});
