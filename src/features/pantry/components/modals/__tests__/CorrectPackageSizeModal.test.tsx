import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  renderWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { drainTimers } from '#/test-utils/drainTimers';
import { CorrectPackageSizeModal } from '../CorrectPackageSizeModal';
import {
  CorrectPackageSizeModal_BatchFragmentDoc,
  CorrectPackageSizeModal_PantryItemFragmentDoc,
} from '../CorrectPackageSizeModal.generated';

jest.mock('#hooks/settings/useReadingSystem', () => ({
  useReadingSystem: () => 'IMPERIAL',
}));
jest.mock('#components/templates/Sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('#features/pantry/ui/PackageContentsFields', () => {
  const { Pressable, TextInput, View } = require('react-native');
  const { Text: RnText } = require('react-native');
  return {
    PackageContentsFields: ({
      size,
      onSizeChange,
      sizeError,
      onUnitSelected,
    }: {
      size: string;
      onSizeChange: (text: string) => void;
      sizeError?: string;
      onUnitSelected: (id: string, name: string, type: string) => void;
    }) => (
      <View>
        <TextInput testID="size" value={size} onChangeText={onSizeChange} />
        <Pressable
          testID="pick-can"
          onPress={() => onUnitSelected('u-can', 'can', 'COUNT')}
        />
        <Pressable
          testID="pick-lb"
          onPress={() => onUnitSelected('u-lb', 'lb', 'WEIGHT')}
        />
        {sizeError ? <RnText>{sizeError}</RnText> : null}
      </View>
    ),
  };
});

const open = (onConfirm: jest.Mock, portionUnitId: string | null = null) => {
  const cache = makeCache();
  seedFragment(cache, {
    fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_pantryItem',
    data: {
      __typename: 'PantryItem',
      id: 'pi-1',
      itemName: 'Diet Coke Mini',
      portionUnitId,
      netWeightUnit: { __typename: 'Unit', id: 'u-floz', symbol: 'fl oz' },
      unit: { __typename: 'Unit', id: 'u-case' },
    },
  });
  seedFragment(cache, {
    fragment: CorrectPackageSizeModal_BatchFragmentDoc,
    fragmentName: 'CorrectPackageSizeModal_batch',
    data: {
      __typename: 'PantryItemBatch',
      id: 'b-1',
      batchNumber: 1,
      netWeight: 75,
      remainingNetWeight: 75,
      packageSize: null,
      remaining: null,
    },
  });
  return renderWithApollo(
    <CorrectPackageSizeModal
      visible
      pantryItemId="pi-1"
      batchId="b-1"
      onClose={jest.fn()}
      onConfirm={onConfirm}
    />,
    { cache },
  );
};

const confirm = async () => {
  fireEvent.press(screen.getByText('Correct'));
  await drainTimers();
};

describe('CorrectPackageSizeModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends a measure as a size, with its reason', async () => {
    const onConfirm = jest.fn().mockResolvedValue(null);
    open(onConfirm);

    fireEvent.press(screen.getByTestId('pick-lb'));
    fireEvent.changeText(screen.getByTestId('size'), '5');
    fireEvent.changeText(
      screen.getByPlaceholderText('Why is the size being corrected?'),
      'Label misread',
    );
    await confirm();

    expect(onConfirm).toHaveBeenCalledWith({
      amount: 5,
      unitId: 'u-lb',
      unitType: UnitType.Weight,
      reason: 'Label misread',
    });
  });

  it('sends a count with no reason to give', async () => {
    const onConfirm = jest.fn().mockResolvedValue(null);
    open(onConfirm);

    fireEvent.press(screen.getByTestId('pick-can'));
    fireEvent.changeText(screen.getByTestId('size'), '10');
    await drainTimers();
    expect(
      screen.queryByPlaceholderText('Why is the size being corrected?'),
    ).toBeNull();
    await confirm();

    expect(onConfirm).toHaveBeenCalledWith({
      amount: 10,
      unitId: 'u-can',
      unitType: UnitType.Count,
      reason: '',
    });
  });

  it('still asks why when correcting the count a stack already has', async () => {
    const onConfirm = jest.fn().mockResolvedValue(null);
    open(onConfirm, 'u-can');

    fireEvent.press(screen.getByTestId('pick-can'));
    fireEvent.changeText(screen.getByTestId('size'), '12');
    await drainTimers();
    await confirm();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText('Please provide a reason for the correction'),
    ).toBeTruthy();
  });

  it('shows a refusal on the field and stays open', async () => {
    const onConfirm = jest.fn().mockResolvedValue('That size won’t work');
    open(onConfirm);

    fireEvent.press(screen.getByTestId('pick-can'));
    fireEvent.changeText(screen.getByTestId('size'), '10');
    await confirm();

    expect(screen.getByText('That size won’t work')).toBeTruthy();
    expect(screen.getByTestId('size')).toBeTruthy();
  });
});
