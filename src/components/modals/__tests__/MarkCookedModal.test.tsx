import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { MarkCookedModal } from '../MarkCookedModal';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        surface: '#FFF',
        surfaceVariant: '#F5F5F5',
        border: '#CCC',
        white: '#FFF',
        background: '#FFF',
      },
      spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24 },
    },
  })),
  BottomSheetModal: ({ children }: any) => children,
}));

jest.mock('#components/atoms/BottomSheetFormScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetFormScrollView: (props: any) =>
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

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (input: string) => {
    const val = parseFloat(input);
    return isNaN(val) ? null : val;
  },
}));

describe('MarkCookedModal', () => {
  const defaultProps = {
    visible: true,
    recipeName: 'Spaghetti Bolognese',
    defaultServings: 4,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    hasPantry: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the correct title', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('I Cooked This!')).toBeTruthy();
  });

  it('displays the recipe name', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('Spaghetti Bolognese')).toBeTruthy();
  });

  it('renders Servings Made input', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('Servings Made')).toBeTruthy();
  });

  it('renders Deduct from Pantry toggle', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('Deduct from Pantry')).toBeTruthy();
  });

  it('renders notes input', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('Notes (Optional)')).toBeTruthy();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const user = userEvent.setup();
    render(<MarkCookedModal {...defaultProps} />);
    await user.press(screen.getByTestId('cancel-button'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onConfirm and onClose when Mark Cooked is pressed', async () => {
    const user = userEvent.setup();
    render(<MarkCookedModal {...defaultProps} />);
    await user.press(screen.getByTestId('confirm-button'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not show Smart Deduction when hasPantry is false', () => {
    render(<MarkCookedModal {...defaultProps} hasPantry={false} />);
    expect(screen.queryByText('Smart Deduction')).toBeNull();
  });

  it('shows Smart Deduction when hasPantry is true', () => {
    render(<MarkCookedModal {...defaultProps} hasPantry={true} />);
    expect(screen.getByText('Smart Deduction')).toBeTruthy();
  });

  it('renders confirm button with Mark Cooked label', () => {
    render(<MarkCookedModal {...defaultProps} />);
    expect(screen.getByText('Mark Cooked')).toBeTruthy();
  });
});
