'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FormNumberInput } from '#features/catalog/components/FormNumberInput';

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

  // A comma keypad offers no period at all, so stripping the comma leaves the
  // person unable to enter a decimal — `2,5` became `25`.
  it('keeps the comma a European keypad produces', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="decimal-pad" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '2,5');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('2,5');
  });

  it('keeps only the first separator, whichever it is', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="decimal-pad" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '12,5.6');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('12,56');
  });

  it('still refuses letters', () => {
    render(<FormNumberInput {...defaultProps} keyboardType="decimal-pad" />);
    const input = screen.getByTestId('number-input');
    fireEvent.changeText(input, '1a2,5kg');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('12,5');
  });
});
