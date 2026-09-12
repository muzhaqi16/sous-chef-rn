'use no memo';
import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import AddItemForm from '../AddItemForm';

/**
 * `createItemSchema` runs for real here — the sibling suite mocks it away. The
 * net-weight rows are a form FIELD, not component state: held in state and
 * merged only at submit, their rules could never fire and a half-filled row was
 * dropped with nothing reported, while Save stayed gated on `isValid`.
 */

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#features/catalog/components/MultiImagePicker', () => ({
  MultiImagePicker: () => null,
}));

jest.mock('#features/catalog/ui/UnitEntryList/UnitEntryList', () => ({
  UnitEntryList: () => {
    const { View } = require('react-native');
    return <View testID="unit-entry-list" />;
  },
}));

jest.mock('#features/catalog/ui/NetWeightEntryList/NetWeightEntryList', () => ({
  NetWeightEntryList: ({
    onEntriesChanged,
  }: {
    onEntriesChanged: (entries: Array<Record<string, string>>) => void;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="net-weight-entry-list">
        <Pressable
          testID="add-empty-row"
          onPress={() => onEntriesChanged([{ id: 'row-1' }])}
        >
          <Text>Add row</Text>
        </Pressable>
        <Pressable
          testID="add-unitless-row"
          onPress={() => onEntriesChanged([{ id: 'row-1', value: '500' }])}
        >
          <Text>Type a weight</Text>
        </Pressable>
        <Pressable
          testID="complete-row"
          onPress={() =>
            onEntriesChanged([{ id: 'row-1', value: '500', unitName: 'g' }])
          }
        >
          <Text>Pick a unit</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('#components/molecules/DynamicFormFields', () => ({
  DynamicFormFields: ({ fields }: { fields: { label: string }[] }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="dynamic-form-fields">
        {fields.map((field, i: number) => (
          <Text key={i}>{field.label}</Text>
        ))}
      </View>
    );
  },
}));

const defaultProps = {
  onSubmit: jest.fn(),
  onClose: jest.fn(),
};

const openInventory = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<AddItemForm {...defaultProps} />);
  await user.press(screen.getByText('Inventory'));
};

describe('AddItemForm — net weight rows', () => {
  it('refuses a weight with no unit instead of dropping it', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-unitless-row'));

    expect(await screen.findByText('Unit is required')).toBeTruthy();
  });

  it('clears the message once the row is complete', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-unitless-row'));
    await screen.findByText('Unit is required');

    await user.press(screen.getByTestId('complete-row'));

    await waitFor(() =>
      expect(screen.queryByText('Unit is required')).toBeNull(),
    );
  });

  it('says nothing about the blank row "Add" just created', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-empty-row'));

    expect(screen.queryByText('Unit is required')).toBeNull();
  });
});

describe('AddItemForm — an edit that leaves the net weight alone', () => {
  it('still carries the seeded weight into the payload', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AddItemForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="directEdit"
        initialData={{
          name: 'Rice',
          netWeights: [{ value: 500, unitName: 'g', unitId: 'unit-g' }],
        }}
      />,
    );

    // Save is gated on whole-schema `isValid`, which settles a tick after mount.
    const save = screen.getByText('Save Changes');
    await waitFor(() => expect(save).not.toBeDisabled());
    await user.press(save);

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]?.netWeights).toEqual([
      { value: 500, unitName: 'g', unitId: 'unit-g' },
    ]);
  });
});
