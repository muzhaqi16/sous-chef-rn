import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import { PantryActionModal } from '../PantryActionModal';
import { PantryOperation } from '#features/pantry/hooks/useOperationUnits';
import { renderWithApollo, seedCache } from '#/test-utils/apolloMockProvider';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        surface: '#FFF',
        white: '#FFF',
      },
    },
  })),
  BottomSheetModal: ({ children }: any) => children,
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
        { testID: 'bottom-sheet-header' },
        R.createElement(RN.Text, null, title),
        R.createElement(
          RN.Pressable,
          { onPress: onCancel, testID: 'cancel-button' },
          R.createElement(RN.Text, null, 'Cancel'),
        ),
        R.createElement(
          RN.Pressable,
          { onPress: onConfirm, testID: 'confirm-button' },
          R.createElement(RN.Text, null, confirmLabel),
        ),
      ),
  };
});

jest.mock('#components/atoms/FormattedItemSubtitle', () => {
  const RN = require('react-native');
  return {
    FormattedItemSubtitle: ({ quantity, unitSymbol }: any) =>
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
    bottomSheetSectionLabel: {},
    bottomSheetOptionContainer: {},
    bottomSheetOption: {},
    bottomSheetOptionSelected: {},
    bottomSheetOptionText: {},
    bottomSheetOptionTextSelected: {},
  },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#features/pantry/hooks/useOperationUnits', () => ({
  ...jest.requireActual('#features/pantry/hooks/useOperationUnits'),
  useOperationUnits: () => ({
    groups: [],
    allUnits: [],
    defaultUnit: null,
    defaultIncrement: null,
    defaultCommonFractions: null,
    loading: false,
    error: undefined,
  }),
}));

jest.mock('#features/pantry/hooks/useConvertAvailableQuantity', () => ({
  useConvertAvailableQuantity: jest.fn(() => ({
    availableInSelectedUnit: null,
    availableLoading: false,
  })),
}));

jest.mock('#components/molecules/UnitPicker', () => ({
  UnitPicker: () => null,
}));

const PANTRY_ITEM_ID = 'pantry-1';

function makeCache(overrides: Record<string, unknown> = {}) {
  return seedCache([
    {
      __typename: 'PantryItem',
      id: PANTRY_ITEM_ID,
      itemId: 'item-1',
      itemName: 'Flour',
      quantity: 5,
      activeBatchCount: 1,
      netWeight: null,
      remainingNetWeight: null,
      lastUsedAt: null,
      unit: {
        __typename: 'Unit',
        id: 'u1',
        symbol: 'lbs',
        name: 'Pounds',
        type: 'WEIGHT',
        displayAsFraction: false,
      },
      netWeightUnit: null,
      packageBreakdown: null,
      quantityBreakdown: null,
      ...overrides,
    },
  ]);
}

describe('PantryActionModal', () => {
  const mockRenderActionFields = jest.fn<any, [any]>(() => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.Text,
      { testID: 'action-fields' },
      'Action Fields',
    );
  });

  const defaultProps = {
    visible: true,
    pantryItemId: PANTRY_ITEM_ID,
    onClose: jest.fn(),
    title: 'Test Action',
    confirmLabel: 'Confirm',
    operation: PantryOperation.Consume,
    onConfirm: jest.fn(),
    renderActionFields: mockRenderActionFields,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the provided title', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Test Action')).toBeTruthy();
  });

  it('displays item name', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Flour')).toBeTruthy();
  });

  it('renders action fields via renderActionFields prop', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    expect(screen.getByText('Action Fields')).toBeTruthy();
    expect(mockRenderActionFields).toHaveBeenCalled();
  });

  it('calls onClose when cancel is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    await user.press(screen.getByTestId('cancel-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is pressed', async () => {
    const user = userEvent.setup();
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    await user.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('does not render item info when pantryItemId is null', () => {
    renderWithApollo(
      <PantryActionModal {...defaultProps} pantryItemId={null} />,
      { cache: makeCache() },
    );
    expect(screen.queryByText('Flour')).toBeNull();
  });

  it('renders confirm button with correct label', () => {
    renderWithApollo(
      <PantryActionModal {...defaultProps} confirmLabel="Do it" />,
      { cache: makeCache() },
    );
    expect(screen.getByText('Do it')).toBeTruthy();
  });

  it('passes correct trackingQuantity to renderActionFields', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.trackingQuantity).toBe(5);
    expect(shared.activeUnitSymbol).toBe('lbs');
  });

  it('passes trackingUnitId to renderActionFields', () => {
    renderWithApollo(<PantryActionModal {...defaultProps} />, {
      cache: makeCache(),
    });
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.trackingUnitId).toBe('u1');
  });

  it('returns 0 for trackingQuantity when pantryItemId is null', async () => {
    const user = userEvent.setup();
    renderWithApollo(
      <PantryActionModal {...defaultProps} pantryItemId={null} />,
      { cache: makeCache() },
    );
    await user.press(screen.getByTestId('confirm-button'));
    const shared = defaultProps.onConfirm.mock.calls[0][0];
    expect(shared.trackingQuantity).toBe(0);
  });

  it('resets notes when modal opens with new pantryItem', () => {
    const cache = makeCache();
    const { rerender } = renderWithApollo(
      <PantryActionModal
        {...defaultProps}
        visible={false}
        pantryItemId={null}
      />,
      { cache },
    );
    rerender(
      <PantryActionModal
        {...defaultProps}
        visible={true}
        pantryItemId={PANTRY_ITEM_ID}
      />,
    );
    const shared =
      mockRenderActionFields.mock.calls[
        mockRenderActionFields.mock.calls.length - 1
      ][0];
    expect(shared.notes).toBe('');
  });

  it('calls onReset when modal opens', () => {
    const onReset = jest.fn();
    const cache = makeCache();
    const { rerender } = renderWithApollo(
      <PantryActionModal
        {...defaultProps}
        visible={false}
        pantryItemId={null}
        onReset={onReset}
      />,
      { cache },
    );
    rerender(
      <PantryActionModal
        {...defaultProps}
        visible={true}
        pantryItemId={PANTRY_ITEM_ID}
        onReset={onReset}
      />,
    );
    expect(onReset).toHaveBeenCalledWith(expect.any(Object), null, null);
  });
});
