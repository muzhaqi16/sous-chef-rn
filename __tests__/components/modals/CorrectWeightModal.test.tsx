'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { CorrectWeightModal } from '../../../src/components/modals/CorrectWeightModal';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: { colors: {} },
  }),
  BottomSheetModal: ({ children }: any) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.title}</Text>;
  },
}));
jest.mock('../../../src/components/atoms/BottomSheetKeyboardAwareScrollView', () => ({
  BottomSheetKeyboardAwareScrollView: ({ children }: any) => children,
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: (props: any) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../src/components/molecules/AutocompleteField/UnitAutocompleteField', () => ({
  UnitAutocompleteField: () => null,
}));
jest.mock('../../../src/components/atoms/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => null,
}));
jest.mock('../../../src/features/pantry/hooks/usePantryItemTransformation', () => ({
  formatNetWeightDisplay: jest.fn((weight, unit) =>
    weight != null && unit ? `${weight} ${unit.symbol}` : null,
  ),
}));

describe('CorrectWeightModal', () => {
  const pantryItem = {
    id: 'pi1',
    itemName: 'Flour',
    quantity: 1,
    netWeight: 500,
    remainingNetWeight: 450,
    netWeightUnit: { id: 'u1', name: 'grams', symbol: 'g' },
    unit: { id: 'u2', symbol: 'bag', displayAsFraction: false },
  };

  const defaultProps = {
    visible: true,
    pantryItem: pantryItem as any,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<CorrectWeightModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Correct Weight title', () => {
    const { getByText } = render(<CorrectWeightModal {...defaultProps} />);
    expect(getByText('Correct Weight')).toBeTruthy();
  });

  it('shows item name', () => {
    const { getByText } = render(<CorrectWeightModal {...defaultProps} />);
    expect(getByText('Flour')).toBeTruthy();
  });

  it('renders New Net Weight field', () => {
    const { getByText } = render(<CorrectWeightModal {...defaultProps} />);
    expect(getByText('New Net Weight')).toBeTruthy();
  });

  it('renders Reason field', () => {
    const { getByText } = render(<CorrectWeightModal {...defaultProps} />);
    expect(getByText('Reason')).toBeTruthy();
  });
});
