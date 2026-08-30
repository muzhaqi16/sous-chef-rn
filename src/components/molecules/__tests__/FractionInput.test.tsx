'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FractionInput } from '../FractionInput';

jest.mock('#context/BottomSheetInputContext', () => ({
  useIsBottomSheetInput: jest.fn(() => false),
}));

describe('FractionInput', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    testID: 'fraction-input',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FractionInput {...defaultProps} />);
    expect(screen.getByTestId('fraction-input')).toBeTruthy();
  });

  it('displays label when provided', () => {
    render(<FractionInput {...defaultProps} label="Amount" />);
    expect(screen.getByText('Amount')).toBeTruthy();
  });

  it('displays placeholder text', () => {
    render(<FractionInput {...defaultProps} placeholder="e.g., 1/2" />);
    expect(screen.getByPlaceholderText('e.g., 1/2')).toBeTruthy();
  });

  it('shows error message when error prop is provided', () => {
    render(<FractionInput {...defaultProps} error="Invalid fraction" />);
    expect(screen.getByText('Invalid fraction')).toBeTruthy();
  });

  it('shows a localized format error for an invalid value', () => {
    render(<FractionInput {...defaultProps} value="abc" />);
    expect(screen.getByText('Formats: 1/4, 1 1/4, 0.75, or 2')).toBeTruthy();
  });

  it.each(['1,5', '1.5', '1 1/4', '3/4', '2'])(
    'accepts %s without a format error',
    value => {
      // A comma-locale keypad offers no `.` at all, and
      // `parseFractionalInput` already handles both separators — the field
      // must not reject what the parser accepts.
      render(<FractionInput {...defaultProps} value={value} />);
      expect(screen.queryByText('Formats: 1/4, 1 1/4, 0.75, or 2')).toBeNull();
    },
  );

  it('calls onChangeText when text is entered', () => {
    render(<FractionInput {...defaultProps} />);
    const input = screen.getByTestId('fraction-input');
    fireEvent.changeText(input, '1/2');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('1/2');
  });
});
