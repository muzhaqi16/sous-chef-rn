import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { AdjustQuantityModal } from '#features/pantry/components/modals/AdjustQuantityModal';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';
import { AdjustQuantityModal_PantryItemFragmentDoc } from '#features/pantry/components/modals/AdjustQuantityModal.generated';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
  })),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetKeyboardAwareScrollView: (
      props: React.ComponentProps<
        typeof import('#components/atoms/BottomSheetKeyboardAwareScrollView').BottomSheetKeyboardAwareScrollView
      >,
    ) => require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/molecules/BottomSheetHeader', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    BottomSheetHeader: ({
      title,
      onCancel,
      onConfirm,
      confirmLabel,
    }: React.ComponentProps<
      typeof import('#components/molecules/BottomSheetHeader').BottomSheetHeader
    >) =>
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
    FractionInput: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: React.ComponentProps<
      typeof import('#components/molecules/FractionInput').FractionInput
    >) =>
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

jest.mock('#components/atoms/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: React.ComponentProps<
      typeof import('#components/atoms/FormInput').FormInput
    >) =>
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

jest.mock('#components/molecules/FormattedItemSubtitle', () => {
  const RN = require('react-native');
  return {
    FormattedItemSubtitle: ({
      quantity,
      unitSymbol,
    }: React.ComponentProps<
      typeof import('#components/molecules/FormattedItemSubtitle').FormattedItemSubtitle
    >) =>
      require('react').createElement(
        RN.Text,
        null,
        `${quantity} ${unitSymbol || ''}`,
      ),
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

jest.mock('#features/pantry/hooks/usePantryItemTransformation', () => ({
  formatNetWeightDisplay: (
    ...[weight, unit]: Parameters<
      typeof import('#features/pantry/hooks/usePantryItemTransformation').formatNetWeightDisplay
    >
  ) => (weight != null ? `${weight} ${unit?.symbol || ''}` : ''),
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (input: string) => {
    const val = parseFloat(input);
    return isNaN(val) ? null : val;
  },
}));

const PANTRY_ITEM_ID = 'pantry-1';

function makeCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      // The production selection the consumer reads, so a thin fixture fails
      // here instead of defining its own idea of complete.
      fragment: AdjustQuantityModal_PantryItemFragmentDoc,
      data: {
        __typename: 'PantryItem',
        id: PANTRY_ITEM_ID,
        itemName: 'Sugar',
        quantity: 3,
        lastUsedAt: null,
        remainingNetWeight: null,
        unit: {
          __typename: 'Unit',
          id: 'u1',
          symbol: 'cups',
          displayAsFraction: false,
        },
        netWeightUnit: null,
        ...overrides,
      },
    },
  ]);
}

describe('AdjustQuantityModal', () => {
  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Adjust Quantity title', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Adjust Quantity')).toBeTruthy();
  });

  it('displays item name', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Sugar')).toBeTruthy();
  });

  it('renders New Quantity input', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('New Quantity')).toBeTruthy();
  });

  it('renders Reason input', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Reason')).toBeTruthy();
  });

  it('renders Adjust confirm button', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Adjust')).toBeTruthy();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    await user.press(screen.getByTestId('cancel-btn'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not render item info when pantryItemId is null', () => {
    renderWithApollo(
      <AdjustQuantityModal {...defaultProps} pantryItemId={null} />,
      { cache: makeCache() },
    );
    expect(screen.queryByText('Sugar')).toBeNull();
  });

  it('shows current quantity info', () => {
    renderWithApollo(<AdjustQuantityModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText(/3 cups/)).toBeTruthy();
  });
});
