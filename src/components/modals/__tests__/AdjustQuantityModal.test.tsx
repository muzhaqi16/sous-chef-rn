import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { AdjustQuantityModal } from '../AdjustQuantityModal';
import type { PantryItemFragment } from '#generated';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
  })),
}));

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetKeyboardAwareScrollView: (props: any) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/atoms/BottomSheetHeader', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BottomSheetHeader: ({ title, onCancel, onConfirm, confirmLabel }: any) =>
      R.createElement(
        RN.View,
        { testID: 'header' },
        R.createElement(RN.Text, null, title),
        R.createElement(
          RN.Pressable,
          { onPress: onCancel, testID: 'cancel-btn' },
          R.createElement(RN.Text, null, 'Cancel'),
        ),
        R.createElement(
          RN.Pressable,
          { onPress: onConfirm, testID: 'confirm-btn' },
          R.createElement(RN.Text, null, confirmLabel),
        ),
      ),
  };
});

jest.mock('#components/molecules/FractionInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FractionInput: ({ label, value, onChangeText, placeholder }: any) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          value,
          onChangeText,
          placeholder,
          testID: 'fraction-input',
        }),
      ),
  };
});

jest.mock('#components/molecules/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({ label, value, onChangeText, placeholder }: any) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          value,
          onChangeText,
          placeholder,
          testID: `form-input-${label?.replace(/\s+/g, '-').toLowerCase()}`,
        }),
      ),
  };
});

jest.mock('#components/atoms/FormattedItemSubtitle', () => {
  const RN = require('react-native');
  return {
    FormattedItemSubtitle: ({ quantity, unitSymbol }: any) =>
      require('react').createElement(RN.Text, null, `${quantity} ${unitSymbol || ''}`),
  };
});

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    bottomSheetScrollView: {},
    bottomSheetContent: {},
    bottomSheetItemInfo: {},
    bottomSheetItemName: {},
    bottomSheetItemRow: {},
    bottomSheetItemLabel: {},
    bottomSheetSection: {},
  },
}));

jest.mock('#hooks/pantry/usePantryItemTransformation', () => ({
  formatNetWeightDisplay: (weight: any, unit: any) =>
    weight != null ? `${weight} ${unit?.symbol || ''}` : '',
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (input: string) => {
    const val = parseFloat(input);
    return isNaN(val) ? null : val;
  },
}));

const makePantryItem = (overrides?: Partial<PantryItemFragment>) =>
  ({
    id: 'pantry-1',
    itemName: 'Sugar',
    quantity: 3,
    unit: { id: 'u1', symbol: 'cups', name: 'Cups', displayAsFraction: false },
    remainingNetWeight: null,
    netWeight: null,
    netWeightUnit: null,
    lastUsedAt: null,
    ...overrides,
  }) as unknown as PantryItemFragment;

describe('AdjustQuantityModal', () => {
  const defaultProps = {
    visible: true,
    pantryItem: makePantryItem(),
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Adjust Quantity title', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText('Adjust Quantity')).toBeTruthy();
  });

  it('displays item name', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText('Sugar')).toBeTruthy();
  });

  it('renders New Quantity input', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText('New Quantity')).toBeTruthy();
  });

  it('renders Reason input', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText('Reason')).toBeTruthy();
  });

  it('renders Adjust confirm button', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText('Adjust')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    fireEvent.press(screen.getByTestId('cancel-btn'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render item info when pantryItem is null', () => {
    render(<AdjustQuantityModal {...defaultProps} pantryItem={null} />);
    expect(screen.queryByText('Sugar')).toBeNull();
  });

  it('shows current quantity info', () => {
    render(<AdjustQuantityModal {...defaultProps} />);
    expect(screen.getByText(/3 cups/)).toBeTruthy();
  });
});
