import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActionCard } from '../ActionCard';

describe('ActionCard', () => {
  const defaultProps = {
    icon: 'add',
    label: 'Add Item',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders label text', () => {
    render(<ActionCard {...defaultProps} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(<ActionCard {...defaultProps} testID="action-card" />);
    fireEvent.press(screen.getByTestId('action-card'));
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    render(<ActionCard {...defaultProps} disabled testID="action-card" />);
    fireEvent.press(screen.getByTestId('action-card'));
    expect(defaultProps.onPress).not.toHaveBeenCalled();
  });

  it('applies testID to container', () => {
    render(<ActionCard {...defaultProps} testID="my-card" />);
    expect(screen.getByTestId('my-card')).toBeTruthy();
  });

  it('renders correctly when disabled', () => {
    const { toJSON } = render(<ActionCard {...defaultProps} disabled />);
    expect(toJSON()).toBeTruthy();
  });
});
