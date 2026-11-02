'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import AddItemForm from '../AddItemForm';
import { drainTimers } from '#/test-utils/drainTimers';

/**
 * `createItemSchema` runs for real here — the sibling suite mocks it away. The
 * net-weight rows are a form FIELD, not component state: held in state and
 * merged only at submit, their rules could never fire and a half-filled row was
 * dropped with nothing reported.
 */

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('#/utils/deviceLocale', () => ({
  ...jest.requireActual('#/utils/deviceLocale'),
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));
const { getDeviceDecimalSeparator } = jest.requireMock('#/utils/deviceLocale');

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
  DynamicFormFields: ({
    fields,
    errors,
  }: {
    fields: { name: string; label: string }[];
    errors: Record<string, { message?: string } | undefined>;
  }) => {
    const { Text, View } = require('react-native');
    return (
      <View testID="dynamic-form-fields">
        {fields.map((field, i: number) => (
          <View key={i}>
            <Text>{field.label}</Text>
            {!!errors[field.name]?.message && (
              <Text>{errors[field.name]?.message}</Text>
            )}
          </View>
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

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AddItemForm — net weight rows', () => {
  it('refuses a weight with no unit instead of dropping it', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-unitless-row'));

    await drainTimers();
    expect(screen.getByText('Unit is required')).toBeTruthy();
  });

  it('clears the message once the row is complete', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-unitless-row'));
    await drainTimers();
    expect(screen.getByText('Unit is required')).toBeTruthy();

    await user.press(screen.getByTestId('complete-row'));

    await drainTimers();
    expect(screen.queryByText('Unit is required')).toBeNull();
  });

  it('says nothing about the blank row "Add" just created', async () => {
    const user = userEvent.setup();
    await openInventory(user);

    await user.press(screen.getByTestId('add-empty-row'));

    expect(screen.queryByText('Unit is required')).toBeNull();
  });
});

describe('AddItemForm — an edit that leaves the net weight alone', () => {
  afterEach(() => {
    getDeviceDecimalSeparator.mockReturnValue('.');
  });

  it('round-trips a three-decimal weight on a comma-separator device', async () => {
    // Seeded as "1.816" on a device that reads "." as a thousands group, the
    // untouched save re-parsed the stored value a thousand times larger.
    getDeviceDecimalSeparator.mockReturnValue(',');
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AddItemForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="directEdit"
        initialData={{
          name: 'Rice',
          netWeights: [{ value: 1.816, unitName: 'kg', unitId: 'unit-kg' }],
        }}
      />,
    );

    const save = screen.getByText('Save Changes');
    await drainTimers();
    expect(save).not.toBeDisabled();
    await user.press(save);

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0]?.[0]?.netWeights).toEqual([
      { value: 1.816, unitName: 'kg', unitId: 'unit-kg' },
    ]);
  });

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

    await user.press(screen.getByText('Save Changes'));

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0]?.[0]?.netWeights).toEqual([
      { value: 500, unitName: 'g', unitId: 'unit-g' },
    ]);
  });
});

describe('AddItemForm — a prefilled field the rules refuse', () => {
  it('reports it on its page instead of disabling Save', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AddItemForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="directEdit"
        initialData={{
          name: 'Rice',
          netWeights: [{ value: 500, unitName: '' }],
        }}
      />,
    );
    // The unitless weight is on Inventory; the form opens on Basics.
    expect(screen.queryByTestId('net-weight-entry-list')).toBeNull();

    const save = screen.getByText('Save Changes');
    expect(save).not.toBeDisabled();
    await user.press(save);

    await drainTimers();
    expect(screen.getByText('Unit is required')).toBeTruthy();
    expect(screen.getByTestId('net-weight-entry-list')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits a catalog name the old character rule refused', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <AddItemForm
        {...defaultProps}
        onSubmit={onSubmit}
        mode="directEdit"
        initialData={{ name: 'Cashew Splits R/s' }}
      />,
    );

    await user.press(screen.getByText('Save Changes'));

    await drainTimers();
    expect(onSubmit).toHaveBeenCalled();
    expect(onSubmit.mock.calls[0]?.[0]?.name).toBe('Cashew Splits R/s');
  });
});

describe('AddItemForm — a barcode the server refuses', () => {
  it('shows the refusal on the barcode field, on the page that has it', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn(async () => ({
      field: 'upc' as const,
      message: 'That barcode isn’t valid.',
    }));
    render(
      <AddItemForm
        {...defaultProps}
        onSubmit={onSubmit}
        initialData={{ name: 'Rice', upc: '012345678901' }}
      />,
    );
    // The barcode field is on the Product page, not the one the form opens on.
    expect(screen.queryByText('UPC/Barcode')).toBeNull();

    const add = screen.getByText('Add Item');
    await drainTimers();
    expect(add).not.toBeDisabled();
    await user.press(add);

    await drainTimers();
    expect(screen.getByText('That barcode isn’t valid.')).toBeTruthy();
    expect(screen.getByText('UPC/Barcode')).toBeTruthy();
  });
});
