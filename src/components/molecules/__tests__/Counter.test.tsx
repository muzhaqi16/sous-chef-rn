import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Counter } from '../Counter';

// Mock icon and haptic service
jest.mock('@react-native-vector-icons/ionicons', () => 'Icon');
jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

describe('Counter', () => {
  const defaultProps = {
    count: 5,
    onIncrement: jest.fn(),
    onDecrement: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the current count', () => {
    render(<Counter {...defaultProps} />);
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('has adjustable accessibility role', () => {
    render(<Counter {...defaultProps} />);
    expect(screen.getByRole('adjustable')).toBeTruthy();
  });

  it('displays custom label in accessibility', () => {
    render(<Counter {...defaultProps} label="servings" />);
    const container = screen.getByRole('adjustable');
    expect(container.props.accessibilityLabel).toContain('servings');
  });

  it('calls onIncrement when increase button is pressed', () => {
    render(<Counter {...defaultProps} />);
    const increaseButton = screen.getByLabelText('Increase quantity');
    fireEvent(increaseButton, 'press', { stopPropagation: jest.fn() });
    expect(defaultProps.onIncrement).toHaveBeenCalledTimes(1);
  });

  it('calls onDecrement when decrease button is pressed', () => {
    render(<Counter {...defaultProps} />);
    const decreaseButton = screen.getByLabelText('Decrease quantity');
    fireEvent(decreaseButton, 'press', { stopPropagation: jest.fn() });
    expect(defaultProps.onDecrement).toHaveBeenCalledTimes(1);
  });

  it('does not call callbacks when disabled', () => {
    render(<Counter {...defaultProps} disabled />);
    const increaseButton = screen.getByLabelText('Increase quantity');
    const decreaseButton = screen.getByLabelText('Decrease quantity');

    fireEvent(increaseButton, 'press', { stopPropagation: jest.fn() });
    fireEvent(decreaseButton, 'press', { stopPropagation: jest.fn() });

    expect(defaultProps.onIncrement).not.toHaveBeenCalled();
    expect(defaultProps.onDecrement).not.toHaveBeenCalled();
  });

  it('sets disabled accessibility state when disabled', () => {
    render(<Counter {...defaultProps} disabled />);
    const increaseButton = screen.getByLabelText('Increase quantity');
    expect(increaseButton.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
