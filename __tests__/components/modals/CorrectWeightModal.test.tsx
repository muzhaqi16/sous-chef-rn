'use no memo';

import React from 'react';
import { CorrectWeightModal } from '../../../src/components/modals/CorrectWeightModal';
import {
  renderWithApollo,
  seedCache,
} from '../../helpers/apolloMockProvider';

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
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
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
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock(
  '../../../src/components/molecules/AutocompleteField/UnitAutocompleteField',
  () => ({
    UnitAutocompleteField: () => null,
  }),
);
jest.mock('../../../src/components/atoms/FormattedItemSubtitle', () => ({
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

function makeCache() {
  return seedCache([
    {
      __typename: 'PantryItem',
      id: PANTRY_ITEM_ID,
      itemName: 'Flour',
      quantity: 1,
      netWeight: 500,
      remainingNetWeight: 450,
      netWeightUnit: {
        __typename: 'Unit',
        id: 'u1',
        name: 'grams',
        symbol: 'g',
      },
      unit: {
        __typename: 'Unit',
        id: 'u2',
        symbol: 'bag',
        displayAsFraction: false,
      },
    },
  ]);
}

describe('CorrectWeightModal', () => {
  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = renderWithApollo(
      <CorrectWeightModal {...defaultProps} />,
      { cache: makeCache() },
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows Correct Weight title', () => {
    const { getByText } = renderWithApollo(
      <CorrectWeightModal {...defaultProps} />,
      { cache: makeCache() },
    );
    expect(getByText('Correct Weight')).toBeTruthy();
  });

  it('shows item name', () => {
    const { getByText } = renderWithApollo(
      <CorrectWeightModal {...defaultProps} />,
      { cache: makeCache() },
    );
    expect(getByText('Flour')).toBeTruthy();
  });

  it('renders New Net Weight field', () => {
    const { getByText } = renderWithApollo(
      <CorrectWeightModal {...defaultProps} />,
      { cache: makeCache() },
    );
    expect(getByText('New Net Weight')).toBeTruthy();
  });

  it('renders Reason field', () => {
    const { getByText } = renderWithApollo(
      <CorrectWeightModal {...defaultProps} />,
      { cache: makeCache() },
    );
    expect(getByText('Reason')).toBeTruthy();
  });
});
