import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PantryActionModal } from '../PantryActionModal';
import type { PantryItemFragment } from '#generated';

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

jest.mock('#hooks/pantry/useCompatibleUnits', () => ({
  useCompatibleUnits: () => ({
    groups: [],
    allUnits: [],
    defaultUnit: null,
    loading: false,
    error: undefined,
  }),
}));

jest.mock('#components/molecules/UnitPicker', () => ({
  UnitPicker: () => null,
}));

const makePantryItem = (overrides?: Partial<PantryItemFragment>) =>
  ({
    id: 'pantry-1',
    itemId: 'item-1',
    itemName: 'Flour',
    quantity: 5,
    unit: { id: 'u1', symbol: 'lbs', name: 'Pounds', type: 'WEIGHT', displayAsFraction: false },
    remainingNetWeight: null,
    netWeight: null,
    netWeightUnit: null,
    packageBreakdown: null,
    quantityBreakdown: null,
    lastUsedAt: null,
    item: { defaultConsumeUnitId: null, defaultConsumeIncrement: null },
    ...overrides,
  }) as unknown as PantryItemFragment;

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
    pantryItem: makePantryItem(),
    onClose: jest.fn(),
    title: 'Test Action',
    confirmLabel: 'Confirm',
    onConfirm: jest.fn(),
    renderActionFields: mockRenderActionFields,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the provided title', () => {
    render(<PantryActionModal {...defaultProps} />);
    expect(screen.getByText('Test Action')).toBeTruthy();
  });

  it('displays item name', () => {
    render(<PantryActionModal {...defaultProps} />);
    expect(screen.getByText('Flour')).toBeTruthy();
  });

  it('renders action fields via renderActionFields prop', () => {
    render(<PantryActionModal {...defaultProps} />);
    expect(screen.getByText('Action Fields')).toBeTruthy();
    expect(mockRenderActionFields).toHaveBeenCalled();
  });

  it('calls onClose when cancel is pressed', () => {
    render(<PantryActionModal {...defaultProps} />);
    fireEvent.press(screen.getByTestId('cancel-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is pressed', () => {
    render(<PantryActionModal {...defaultProps} />);
    fireEvent.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('does not render item info when pantryItem is null', () => {
    render(<PantryActionModal {...defaultProps} pantryItem={null} />);
    expect(screen.queryByText('Flour')).toBeNull();
  });

  it('renders confirm button with correct label', () => {
    render(<PantryActionModal {...defaultProps} confirmLabel="Do it" />);
    expect(screen.getByText('Do it')).toBeTruthy();
  });

  it('passes correct trackingQuantity to renderActionFields', () => {
    render(<PantryActionModal {...defaultProps} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.trackingQuantity).toBe(5);
    expect(shared.activeUnitSymbol).toBe('lbs');
  });

  it('passes trackingUnitId to renderActionFields', () => {
    render(<PantryActionModal {...defaultProps} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.trackingUnitId).toBe('u1');
  });

  it('returns 0 for trackingQuantity when pantryItem is null', () => {
    render(<PantryActionModal {...defaultProps} pantryItem={null} />);
    fireEvent.press(screen.getByTestId('confirm-button'));
    const shared = defaultProps.onConfirm.mock.calls[0][0];
    expect(shared.trackingQuantity).toBe(0);
  });

  it('resets notes when modal opens with new pantryItem', () => {
    const { rerender } = render(
      <PantryActionModal {...defaultProps} visible={false} pantryItem={null} />,
    );
    rerender(
      <PantryActionModal {...defaultProps} visible={true} pantryItem={makePantryItem()} />,
    );
    const shared = mockRenderActionFields.mock.calls[mockRenderActionFields.mock.calls.length - 1][0];
    expect(shared.notes).toBe('');
  });

  it('calls onReset when modal opens', () => {
    const onReset = jest.fn();
    const { rerender } = render(
      <PantryActionModal {...defaultProps} visible={false} pantryItem={null} onReset={onReset} />,
    );
    rerender(
      <PantryActionModal {...defaultProps} visible={true} pantryItem={makePantryItem()} onReset={onReset} />,
    );
    expect(onReset).toHaveBeenCalledWith(expect.any(Object), null);
  });
});
