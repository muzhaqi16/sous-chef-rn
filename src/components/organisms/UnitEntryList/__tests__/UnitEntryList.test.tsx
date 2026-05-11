import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { UnitEntryList, UnitEntry } from '../UnitEntryList';

jest.mock('#utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#/components/molecules/FormInput', () => {
  const { View, Text, TextInput } = require('react-native');
  return {
    FormInput: ({ label, value, onChangeText, placeholder }: any) => (
      <View>
        <Text>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          testID={`input-${label}`}
        />
      </View>
    ),
  };
});

jest.mock(
  '#/components/molecules/AutocompleteField/UnitAutocompleteField',
  () => {
    const { View, Text, TextInput } = require('react-native');
    return {
      UnitAutocompleteField: ({
        label,
        value,
        onChangeText,
        placeholder,
      }: any) => (
        <View>
          <Text>{label}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            testID={`autocomplete-${label}`}
          />
        </View>
      ),
    };
  },
);

jest.mock('#/components/base/Button', () => {
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ children, onPress, disabled }: any) => (
      <Pressable onPress={onPress} disabled={disabled} testID="add-unit-btn">
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

describe('UnitEntryList', () => {
  const defaultEntries: UnitEntry[] = [
    { id: 'entry-1', unitName: 'kg', packageSize: '1', isDefault: true },
    { id: 'entry-2', unitName: 'lbs', packageSize: '2.2', isDefault: false },
  ];

  const defaultProps = {
    entries: defaultEntries,
    onEntriesChanged: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders section title', () => {
    render(<UnitEntryList {...defaultProps} />);
    expect(screen.getByText('Units')).toBeTruthy();
  });

  it('renders all entries', () => {
    render(<UnitEntryList {...defaultProps} />);
    // First entry has "Unit (Default)" label, second has "Unit"
    expect(screen.getByText('Unit (Default)')).toBeTruthy();
    expect(screen.getByText('Unit')).toBeTruthy();
  });

  it('renders "Add Unit" button', () => {
    render(<UnitEntryList {...defaultProps} />);
    expect(screen.getByText('Add Unit')).toBeTruthy();
  });

  it('calls onEntriesChanged with new entry when Add Unit pressed', async () => {
    const user = userEvent.setup();
    render(<UnitEntryList {...defaultProps} />);
    await user.press(screen.getByTestId('add-unit-btn'));
    expect(defaultProps.onEntriesChanged).toHaveBeenCalledTimes(1);
    const newEntries = defaultProps.onEntriesChanged.mock.calls[0][0];
    expect(newEntries).toHaveLength(3);
  });

  it('renders Size input for each entry', () => {
    render(<UnitEntryList {...defaultProps} />);
    expect(screen.getAllByText('Size')).toHaveLength(2);
  });

  it('renders empty list with Add Unit button', () => {
    render(
      <UnitEntryList
        entries={[]}
        onEntriesChanged={defaultProps.onEntriesChanged}
      />,
    );
    expect(screen.getByText('Add Unit')).toBeTruthy();
    expect(screen.queryByText('Size')).toBeNull();
  });

  it('marks first added entry as default when list is empty', async () => {
    const user = userEvent.setup();
    render(
      <UnitEntryList
        entries={[]}
        onEntriesChanged={defaultProps.onEntriesChanged}
      />,
    );
    await user.press(screen.getByTestId('add-unit-btn'));
    const newEntries = defaultProps.onEntriesChanged.mock.calls[0][0];
    expect(newEntries).toHaveLength(1);
    expect(newEntries[0].isDefault).toBe(true);
  });
});
