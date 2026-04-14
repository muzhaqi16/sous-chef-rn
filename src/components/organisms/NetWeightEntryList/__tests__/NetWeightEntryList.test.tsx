'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NetWeightEntryList, NetWeightEntry } from '../NetWeightEntryList';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/components/molecules/FormInput', () => ({
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

jest.mock(
  '#/components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    UnitAutocompleteField: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: any) => {
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
          testID: `unit-input-${label}`,
        }),
      );
    },
  }),
);

jest.mock('#/components/base/Button', () => ({
  Button: ({ children, onPress, disabled }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.Pressable,
      { onPress, disabled, testID: 'add-btn' },
      R.createElement(RN.Text, null, children),
    );
  },
}));

describe('NetWeightEntryList', () => {
  const defaultEntries: NetWeightEntry[] = [
    { id: 'e1', value: '3.4', unitName: 'oz' },
  ];

  const defaultProps = {
    entries: defaultEntries,
    onEntriesChanged: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the section title', () => {
    render(<NetWeightEntryList {...defaultProps} />);
    expect(screen.getByText('Net Weights')).toBeTruthy();
  });

  it('renders existing entries', () => {
    render(<NetWeightEntryList {...defaultProps} />);
    expect(screen.getByDisplayValue('3.4')).toBeTruthy();
    expect(screen.getByDisplayValue('oz')).toBeTruthy();
  });

  it('renders Add Net Weight button', () => {
    render(<NetWeightEntryList {...defaultProps} />);
    expect(screen.getByText('Add Net Weight')).toBeTruthy();
  });

  it('calls onEntriesChanged when adding new entry', () => {
    render(<NetWeightEntryList {...defaultProps} />);
    fireEvent.press(screen.getByText('Add Net Weight'));
    expect(defaultProps.onEntriesChanged).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'e1' }),
        expect.objectContaining({ id: expect.any(String) }),
      ]),
    );
  });

  it('renders empty when no entries', () => {
    render(<NetWeightEntryList {...defaultProps} entries={[]} />);
    expect(screen.getByText('Net Weights')).toBeTruthy();
    expect(screen.getByText('Add Net Weight')).toBeTruthy();
  });

  it('renders Weight and Unit fields for each entry', () => {
    render(<NetWeightEntryList {...defaultProps} />);
    expect(screen.getByText('Weight')).toBeTruthy();
    expect(screen.getByText('Unit')).toBeTruthy();
  });
});
