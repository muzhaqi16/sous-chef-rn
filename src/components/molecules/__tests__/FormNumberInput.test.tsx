'use no memo';
import React from 'react';
import { fireEvent, render, screen} from '@testing-library/react-native';
import { FormNumberInput } from '../FormNumberInput';

describe('FormNumberInput', () => {
  const defaultProps = {
    label: 'Quantity',
    value: '',
    onChangeText: jest.fn(),
    testID: 'number-input',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FormNumberInput {...defaultProps} />);
    expect(screen.getByText('Quantity')).toBeTruthy();
  });

  it('displays the label', () => {
    render(<FormNumberInput {...defaultProps} label="Amount" />);
    expect(screen.getByText('Amount')).toBeTruthy();
  });

  it('displays error message when error prop is provided', () => {
    render(<FormNumberInput {...defaultProps} error="Must be a number" />);
    expect(screen.getByText('Must be a number')).toBeTruthy();
  });

  it('strips non-numeric characters for numeric keyboardType', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="numeric" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '12abc34');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('1234');
  });

  it('allows decimal point for decimal-pad keyboardType', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="decimal-pad" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '12.5');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('12.5');
  });

  it('prevents multiple decimal points for decimal-pad', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="decimal-pad" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '12.5.6');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('12.56');
  });
});
