'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EditableCounter } from '../EditableCounter';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: 'Icon',
  Ionicons: 'Icon',
}));

jest.mock('#/utils/fractionUtils', () => ({
  parseFractionalInput: (input: string) => {
    const val = parseFloat(input);
    return isNaN(val) ? null : val;
  },
}));

jest.mock('#components/atoms/Label', () => ({
  Label: ({ children }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, children);
  },
}));

describe('EditableCounter', () => {
  const defaultProps = {
    value: '5',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the correct value', () => {
    render(<EditableCounter {...defaultProps} />);
    expect(screen.getByDisplayValue('5')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<EditableCounter {...defaultProps} label="Quantity" />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('has adjustable accessibility role', () => {
    render(<EditableCounter {...defaultProps} />);
    expect(screen.getByRole('adjustable')).toBeTruthy();
  });

  it('calls onChangeText when increment is pressed', () => {
    render(<EditableCounter {...defaultProps} />);
    const incrementBtn = screen.getByLabelText('Increase quantity');
    fireEvent.press(incrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('6');
  });

  it('calls onChangeText when decrement is pressed', () => {
    render(<EditableCounter {...defaultProps} />);
    const decrementBtn = screen.getByLabelText('Decrease quantity');
    fireEvent.press(decrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('4');
  });

  it('does not go below min value on decrement', () => {
    render(<EditableCounter {...defaultProps} value="0" min={0} />);
    const decrementBtn = screen.getByLabelText('Decrease quantity');
    fireEvent.press(decrementBtn);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('0');
  });

  it('does not call callbacks when disabled', () => {
    render(<EditableCounter {...defaultProps} disabled />);
    const incrementBtn = screen.getByLabelText('Increase quantity');
    fireEvent.press(incrementBtn);
    expect(defaultProps.onChangeText).not.toHaveBeenCalled();
  });

  it('updates value on direct text input', () => {
    render(<EditableCounter {...defaultProps} />);
    const input = screen.getByDisplayValue('5');
    fireEvent.changeText(input, '10');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('10');
  });
});
