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

const makePantryItem = (overrides?: Partial<PantryItemFragment>) =>
  ({
    id: 'pantry-1',
    itemName: 'Flour',
    quantity: 5,
    unit: { id: 'u1', symbol: 'lbs', name: 'Pounds', displayAsFraction: false },
    remainingNetWeight: null,
    netWeight: null,
    netWeightUnit: null,
    packageBreakdown: null,
    quantityBreakdown: null,
    lastUsedAt: null,
    ...overrides,
  }) as unknown as PantryItemFragment;

describe('PantryActionModal', () => {
  const mockRenderActionFields = jest.fn((_shared) => {
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

  it('does not show unit toggle for non-dual-tracked items', () => {
    render(<PantryActionModal {...defaultProps} />);
    expect(screen.queryByText('Use by')).toBeNull();
  });

  it('passes correct availableQuantity to renderActionFields', () => {
    render(<PantryActionModal {...defaultProps} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.availableQuantity).toBe(5);
    expect(shared.activeUnitSymbol).toBe('lbs');
  });

  it('shows unit toggle for dual-tracked items', () => {
    const dualTrackedItem = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={dualTrackedItem} />);
    expect(screen.getByText('Use by')).toBeTruthy();
  });

  it('passes isDualTracked=true for items with weight tracking', () => {
    const dualTrackedItem = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={dualTrackedItem} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.isDualTracked).toBe(true);
  });

  it('passes hasContentUnit=true when packageBreakdown has perUnitNetWeight', () => {
    const item = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
      packageBreakdown: {
        perUnitNetWeight: 100,
        contentUnit: { id: 'cu1', symbol: 'oz', name: 'Ounces' },
      } as any,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={item} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.hasContentUnit).toBe(true);
  });

  it('passes hasContentUnit=false when perUnitNetWeight is 0', () => {
    const item = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
      packageBreakdown: {
        perUnitNetWeight: 0,
        contentUnit: { id: 'cu1', symbol: 'oz', name: 'Ounces' },
      } as any,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={item} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.hasContentUnit).toBe(false);
  });

  it('computes contentUnitCount from totalContentUnits when available', () => {
    const item = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
      packageBreakdown: {
        perUnitNetWeight: 100,
        contentUnit: { id: 'cu1', symbol: 'oz', name: 'Ounces' },
      } as any,
      quantityBreakdown: {
        totalContentUnits: 7.5,
        fullPackages: 1,
        looseContentUnits: 1.5,
        contentUnit: { symbol: 'oz' },
      } as any,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={item} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.contentUnitCount).toBe(7);
  });

  it('computes contentUnitCount by division when totalContentUnits is null', () => {
    const item = makePantryItem({
      remainingNetWeight: 500,
      netWeightUnit: { id: 'wu1', symbol: 'g', name: 'Grams' } as any,
      packageBreakdown: {
        perUnitNetWeight: 100,
        contentUnit: { id: 'cu1', symbol: 'oz', name: 'Ounces' },
      } as any,
      quantityBreakdown: null,
    });
    render(<PantryActionModal {...defaultProps} pantryItem={item} />);
    const shared = mockRenderActionFields.mock.calls[0][0];
    expect(shared.contentUnitCount).toBe(5); // 500 / 100
  });

  it('returns 0 for availableQuantity when pantryItem is null', () => {
    render(<PantryActionModal {...defaultProps} pantryItem={null} />);
    // renderActionFields is not called when pantryItem is null
    // but onConfirm can still be pressed
    fireEvent.press(screen.getByTestId('confirm-button'));
    const shared = defaultProps.onConfirm.mock.calls[0][0];
    expect(shared.availableQuantity).toBe(0);
  });

  it('resets notes and selectedUnit when modal opens with new pantryItem', () => {
    const { rerender } = render(
      <PantryActionModal {...defaultProps} visible={false} pantryItem={null} />,
    );
    rerender(
      <PantryActionModal {...defaultProps} visible={true} pantryItem={makePantryItem()} />,
    );
    const shared = mockRenderActionFields.mock.calls[mockRenderActionFields.mock.calls.length - 1][0];
    expect(shared.notes).toBe('');
    expect(shared.selectedUnit).toBe('tracking');
  });

  it('calls onReset when modal opens', () => {
    const onReset = jest.fn();
    const { rerender } = render(
      <PantryActionModal {...defaultProps} visible={false} pantryItem={null} onReset={onReset} />,
    );
    rerender(
      <PantryActionModal {...defaultProps} visible={true} pantryItem={makePantryItem()} onReset={onReset} />,
    );
    expect(onReset).toHaveBeenCalledWith(expect.any(Object), expect.any(Function));
  });
});
