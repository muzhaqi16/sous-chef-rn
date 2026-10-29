'use no memo';

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { CorrectPackageSizeModal } from '#features/pantry/components/modals/CorrectPackageSizeModal';
import { renderWithApollo, seedCache } from '../../helpers/apolloMockProvider';
import { writeUnitSystemSettings } from '../../helpers/fixtures/userSettingsFixtures';
import {
  CorrectPackageSizeModal_BatchFragmentDoc,
  CorrectPackageSizeModal_PantryItemFragmentDoc,
  type CorrectPackageSizeModal_BatchFragment,
  type CorrectPackageSizeModal_PantryItemFragment,
} from '#features/pantry/components/modals/CorrectPackageSizeModal.generated';
import { UnitSystem, UnitType } from '#/graphql/generated/schemaTypes';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';

jest.mock('../../../src/hooks/ui/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../src/components/molecules/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: { title?: string; onConfirm?: () => void }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <>
        <Text>{props.title}</Text>
        <Pressable accessibilityLabel="confirm" onPress={props.onConfirm} />
      </>
    );
  },
}));
jest.mock(
  '../../../src/components/atoms/BottomSheetKeyboardAwareScrollView',
  () => ({
    BottomSheetKeyboardAwareScrollView: ({
      children,
    }: {
      children: React.ReactNode;
    }) => children,
  }),
);
jest.mock('../../../src/components/atoms/FormInput', () => ({
  FormInput: (props: {
    label?: string;
    value?: string;
    onChangeText?: (text: string) => void;
  }) => {
    const { Text, TextInput } = require('react-native');
    return (
      <>
        <Text>{props.label}</Text>
        <TextInput
          accessibilityLabel={props.label}
          value={props.value}
          onChangeText={props.onChangeText}
        />
      </>
    );
  },
}));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: (props: { value?: string }) => {
    const { Text } = require('react-native');
    return <Text testID="unit-field">{props.value}</Text>;
  },
}));
jest.mock('../../../src/components/molecules/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => null,
}));

const PANTRY_ITEM_ID = 'pi1';
const BATCH_ID = 'b1';

type Batch = CorrectPackageSizeModal_BatchFragment;
type Reading = NonNullable<Batch['remaining']>['metric'];

const reading = (value: number, id: string, symbol: string): Reading =>
  readingAsAbbreviation({
    __typename: 'MeasureReading',
    value,
    unitId: id,
    symbol,
    displayAsFraction: false,
    type: UnitType.Weight,
  });

const measure = (
  value: number,
  metric: Reading,
  imperial: Reading,
): NonNullable<Batch['packageSize']> => ({
  __typename: 'Measure',
  value,
  unitId: 'u-g',
  metric,
  imperial,
});

const ounces: CorrectPackageSizeModal_PantryItemFragment = {
  __typename: 'PantryItem',
  id: PANTRY_ITEM_ID,
  itemName: 'Pasta sauce',
  netWeightUnit: asAbbreviation({
    __typename: 'Unit',
    id: 'u-oz',
    name: 'ounce',
    symbol: 'oz',
  }),
  unit: { __typename: 'Unit', id: 'u-jar' },
};

const grams: CorrectPackageSizeModal_PantryItemFragment = {
  ...ounces,
  itemName: 'Honey',
  netWeightUnit: asAbbreviation({
    __typename: 'Unit',
    id: 'u-g',
    name: 'gram',
    symbol: 'g',
  }),
};

// A 3 LB honey jar, stored in the stack's grams, half used.
const honeyJar: Batch = {
  __typename: 'PantryItemBatch',
  id: BATCH_ID,
  batchNumber: 2,
  netWeight: 1360.78,
  remainingNetWeight: 680.39,
  packageSize: measure(
    1360.78,
    reading(1.36, 'u-kg', 'kg'),
    reading(3, 'u-lb', 'lb'),
  ),
  remaining: measure(
    680.39,
    reading(680, 'u-g', 'g'),
    reading(1.5, 'u-lb', 'lb'),
  ),
};

function makeCache(
  pantryItem: CorrectPackageSizeModal_PantryItemFragment,
  batch: Batch,
) {
  // The production selections the consumer reads, so a thin fixture fails
  // here instead of defining its own idea of complete.
  return seedCache([
    {
      fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
      data: pantryItem,
    },
    { fragment: CorrectPackageSizeModal_BatchFragmentDoc, data: batch },
  ]);
}

const sauceJar: Batch = {
  __typename: 'PantryItemBatch',
  id: BATCH_ID,
  batchNumber: 2,
  netWeight: 32,
  remainingNetWeight: 16,
  packageSize: null,
  remaining: null,
};

describe('CorrectPackageSizeModal', () => {
  const onConfirm = jest.fn().mockResolvedValue(true);
  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    batchId: BATCH_ID,
    onClose: jest.fn(),
    onConfirm,
  };

  const renderModal = (
    pantryItem = ounces,
    batch = sauceJar,
    system?: UnitSystem,
  ) => {
    const cache = makeCache(pantryItem, batch);
    if (system) writeUnitSystemSettings(cache, system, system);
    return renderWithApollo(<CorrectPackageSizeModal {...defaultProps} />, {
      cache,
    });
  };

  beforeEach(() => jest.clearAllMocks());

  it('names what it corrects: one package', () => {
    renderModal();
    expect(screen.getByText('Correct package size')).toBeTruthy();
  });

  it("shows the item and the batch's own size, not the stack's default", () => {
    renderModal();
    expect(screen.getByText('Pasta sauce')).toBeTruthy();
    expect(screen.getByText('Package size: 32 oz')).toBeTruthy();
    expect(screen.getByText('Remaining: 16 oz')).toBeTruthy();
  });

  it('asks for the actual size and a reason', () => {
    renderModal();
    expect(screen.getByText('Actual package size')).toBeTruthy();
    expect(screen.getByText('Reason')).toBeTruthy();
  });

  it('renders nothing without a batch', () => {
    renderWithApollo(
      <CorrectPackageSizeModal {...defaultProps} batchId={null} />,
      { cache: makeCache(ounces, sauceJar) },
    );
    expect(screen.queryByText('Pasta sauce')).toBeNull();
  });

  describe('in the user’s unit system', () => {
    it('opens on the size as it reads, never the stored grams', async () => {
      renderModal(grams, honeyJar, UnitSystem.Imperial);
      expect(await screen.findByText('Package size: 3 lb')).toBeTruthy();
      expect(screen.getByText('Remaining: 1.5 lb')).toBeTruthy();
      expect(screen.getByLabelText('Actual package size').props.value).toBe(
        '3',
      );
      expect(screen.getByTestId('unit-field')).toHaveTextContent('lb');
    });

    it('opens on kilograms for a metric user', async () => {
      renderModal(grams, honeyJar, UnitSystem.Metric);
      expect(await screen.findByText('Package size: 1.36 kg')).toBeTruthy();
      expect(screen.getByLabelText('Actual package size').props.value).toBe(
        '1.36',
      );
    });

    it('saves 2.5 lb as typed, for the server to convert', async () => {
      renderModal(grams, honeyJar, UnitSystem.Imperial);
      await screen.findByText('Package size: 3 lb');

      fireEvent.changeText(screen.getByLabelText('Actual package size'), '2.5');
      fireEvent.changeText(screen.getByLabelText('Reason'), 'Misread label');
      fireEvent.press(screen.getByLabelText('confirm'));

      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith({
          netWeight: 2.5,
          netWeightUnitId: 'u-lb',
          reason: 'Misread label',
        }),
      );
    });

    // The server keeps the stack's grams (1133.98 g) and reads them back.
    it('reads the corrected size back as 2.5 lb', async () => {
      renderModal(
        grams,
        {
          ...honeyJar,
          netWeight: 1133.98,
          packageSize: measure(
            1133.98,
            reading(1.13, 'u-kg', 'kg'),
            reading(2.5, 'u-lb', 'lb'),
          ),
        },
        UnitSystem.Imperial,
      );
      expect(await screen.findByText('Package size: 2.5 lb')).toBeTruthy();
      expect(screen.getByLabelText('Actual package size').props.value).toBe(
        '2.5',
      );
    });

    it('opens on the stored figure where the reading is the tracking unit', async () => {
      renderModal(
        { ...grams, unit: { __typename: 'Unit', id: 'u-lb' } },
        honeyJar,
        UnitSystem.Imperial,
      );
      await screen.findByText('Package size: 3 lb');
      expect(screen.getByLabelText('Actual package size').props.value).toBe(
        '1360.78',
      );
      expect(screen.getByTestId('unit-field')).toHaveTextContent('g');
    });
  });
});
