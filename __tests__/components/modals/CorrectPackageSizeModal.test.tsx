'use no memo';

import React from 'react';
import { CorrectPackageSizeModal } from '#features/pantry/components/modals/CorrectPackageSizeModal';
import { renderWithApollo, seedCache } from '../../helpers/apolloMockProvider';
import {
  CorrectPackageSizeModal_BatchFragmentDoc,
  CorrectPackageSizeModal_PantryItemFragmentDoc,
} from '#features/pantry/components/modals/CorrectPackageSizeModal.generated';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../src/components/molecules/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: { title?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
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
  FormInput: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));
jest.mock('../../../src/components/molecules/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => null,
}));
jest.mock(
  '../../../src/features/pantry/hooks/usePantryItemTransformation',
  () => ({
    formatNetWeightDisplay: jest.fn((weight, unit) =>
      weight != null && unit ? `${weight} ${unit.symbol}` : null,
    ),
  }),
);

const PANTRY_ITEM_ID = 'pi1';
const BATCH_ID = 'b1';

function makeCache() {
  return seedCache([
    {
      // The production selections the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: CorrectPackageSizeModal_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: PANTRY_ITEM_ID,
        itemName: 'Pasta sauce',
        netWeightUnit: {
          __typename: 'Unit',
          id: 'u-oz',
          name: 'ounce',
          symbol: 'oz',
        },
      },
    },
    {
      fragment: CorrectPackageSizeModal_BatchFragmentDoc,
      data: {
        __typename: 'PantryItemBatch',
        id: BATCH_ID,
        batchNumber: 2,
        netWeight: 32,
        remainingNetWeight: 16,
      },
    },
  ]);
}

describe('CorrectPackageSizeModal', () => {
  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    batchId: BATCH_ID,
    onClose: jest.fn(),
    onConfirm: jest.fn().mockResolvedValue(true),
  };

  const renderModal = () =>
    renderWithApollo(<CorrectPackageSizeModal {...defaultProps} />, {
      cache: makeCache(),
    });

  it('names what it corrects: one package', () => {
    expect(renderModal().getByText('Correct package size')).toBeTruthy();
  });

  it("shows the item and the batch's own size, not the stack's default", () => {
    const { getByText } = renderModal();
    expect(getByText('Pasta sauce')).toBeTruthy();
    expect(getByText('Package size: 32 oz')).toBeTruthy();
    expect(getByText('Remaining: 16 oz')).toBeTruthy();
  });

  it('asks for the actual size and a reason', () => {
    const { getByText } = renderModal();
    expect(getByText('Actual package size')).toBeTruthy();
    expect(getByText('Reason')).toBeTruthy();
  });

  it('renders nothing without a batch', () => {
    const { queryByText } = renderWithApollo(
      <CorrectPackageSizeModal {...defaultProps} batchId={null} />,
      { cache: makeCache() },
    );
    expect(queryByText('Pasta sauce')).toBeNull();
  });
});
