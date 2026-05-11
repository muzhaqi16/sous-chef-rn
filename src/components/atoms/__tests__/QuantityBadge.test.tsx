import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { QuantityBadge } from '../QuantityBadge';

describe('QuantityBadge', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders formatted quantity', () => {
    render(<QuantityBadge quantity={3} onPress={mockOnPress} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders quantity with unit', () => {
    render(<QuantityBadge quantity={2} unit="lb" onPress={mockOnPress} />);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('lb')).toBeTruthy();
  });

  it('prefers quantityInput over formatted quantity', () => {
    render(
      <QuantityBadge
        quantity={0.25}
        quantityInput="1/4"
        onPress={mockOnPress}
      />,
    );
    expect(screen.getByText('1/4')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    render(<QuantityBadge quantity={1} onPress={mockOnPress} />);
    await user.press(screen.getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const user = userEvent.setup();
    render(<QuantityBadge quantity={1} onPress={mockOnPress} disabled />);
    await user.press(screen.getByRole('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when isPurchased', async () => {
    const user = userEvent.setup();
    render(<QuantityBadge quantity={1} onPress={mockOnPress} isPurchased />);
    await user.press(screen.getByRole('button'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('has correct accessibility label', () => {
    render(<QuantityBadge quantity={5} unit="oz" onPress={mockOnPress} />);
    expect(screen.getByLabelText('Quantity: 5 oz. Tap to edit')).toBeTruthy();
  });

  it('has correct accessibility label without unit', () => {
    render(<QuantityBadge quantity={3} onPress={mockOnPress} />);
    expect(screen.getByLabelText('Quantity: 3. Tap to edit')).toBeTruthy();
  });
});
