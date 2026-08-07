'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  fireEvent,
} from '@testing-library/react-native';
import { NetWeightEntryList, NetWeightEntry } from '../NetWeightEntryList';

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/components/molecules/FormInput', () => ({
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

jest.mock(
  '#/components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    // Mirrors the real component: a keystroke reports the text AND invalidates
    // any previous selection via `onUnitSelected(null, null, null)`.
    UnitAutocompleteField: ({
      label,
      value,
      onChangeText,
      onUnitSelected,
      placeholder,
    }: {
      label?: string;
      value: string;
      onChangeText: (text: string) => void;
      onUnitSelected?: (
        unitId: string | null,
        unitName: string | null,
        unitType?: string | null,
      ) => void;
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
          onChangeText: (text: string) => {
            onChangeText(text);
            onUnitSelected?.(null, null, null);
          },
          placeholder,
          testID: `unit-input-${label}`,
        }),
      );
    },
  }),
);

jest.mock('#/components/base/Button', () => ({
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children?: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
  }) => {
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

  it('calls onEntriesChanged when adding new entry', async () => {
    const user = userEvent.setup();
    render(<NetWeightEntryList {...defaultProps} />);
    await user.press(screen.getByText('Add Net Weight'));
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

  // A typed unit that is never picked from the dropdown still has to reach the
  // submitted entry: the keystroke reports the text and then clears the stale
  // selection, and the clear must not wipe the text alongside the ids.
  it('keeps a typed unit name when no suggestion is selected', () => {
    render(
      <NetWeightEntryList
        {...defaultProps}
        entries={[{ id: 'e1', unitId: 'u-old', unitName: 'lb' }]}
      />,
    );

    fireEvent.changeText(screen.getByTestId('unit-input-Unit'), 'oz');

    const finalEntries = defaultProps.onEntriesChanged.mock.calls.at(
      -1,
    )?.[0] as NetWeightEntry[];
    expect(finalEntries[0].unitName).toBe('oz');
    // Typing invalidates the previously selected unit.
    expect(finalEntries[0].unitId).toBeUndefined();
  });
});
